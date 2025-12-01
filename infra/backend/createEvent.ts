import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyHandler } from "aws-lambda";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";

// 初始化 AWS SDK 客户端
const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);

// 从 CDK 注入的环境变量中获取配置表名
const CONFIG_TABLE_NAME = process.env.EVENTS_CONFIG_TABLE_NAME!;

/**
 * Normalize event name: convert to lowercase and remove spaces.
 */
const getEventId = (name: string): string => {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '');
};

// ----------------------------------------------------------------------
// API Gateway 主处理函数
// ----------------------------------------------------------------------
export const handler: APIGatewayProxyHandler = async (event) => {
    try {
        if (!event.body) {
            return { statusCode: 400, body: JSON.stringify({ message: "Missing request body" }) };
        }
        
        const { eventName } = JSON.parse(event.body); 

        if (!eventName) {
            return { statusCode: 400, body: JSON.stringify({ message: "Missing required field: eventName" }) };
        }

        const eventId = getEventId(eventName);
        
        // 构造配置项
        const eventConfigItem = {
            // Primary Key
            eventId: eventId, 
            // Metadata
            eventName: eventName,
            createdAt: new Date().toISOString(),
            dataType: 'CONFIG',
        };
        
        const command = new PutCommand({
            TableName: CONFIG_TABLE_NAME,
            Item: eventConfigItem,
            // 核心逻辑：确保 Event ID 是唯一的，如果已存在则失败
            ConditionExpression: 'attribute_not_exists(eventId)', 
        });

        await ddbDocClient.send(command);

        return {
            statusCode: 201, // 201 Created
            body: JSON.stringify({ message: "Event created successfully.", eventId }),
        };

    } catch (error) {
        if (error instanceof ConditionalCheckFailedException) {
            // 捕获到重复创建的错误
            return {
                statusCode: 409, // 409 Conflict
                body: JSON.stringify({ message: `Event ID '${getEventId(JSON.parse(event.body).eventName)}' already exists.` }),
            };
        }
        console.error("Error creating event config:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Failed to create event." }),
        };
    }
};
