import { DynamoDBClient, ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyHandler } from "aws-lambda";
import { withCors } from './wrapResponse';

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

export const handler: APIGatewayProxyHandler = async (event) => {
    try {
        if (!event.body) {
            return withCors({ message: "Missing request body" }, 400);
        }
        
        const { eventName } = JSON.parse(event.body); 

        if (!eventName) {
            return withCors({ message: "Missing required field: eventName" }, 400);
        }

        const eventId = getEventId(eventName);

        const eventConfigItem = {
            eventId: eventId,
            eventName: eventName,
            createdAt: new Date().toISOString(),
            dataType: 'CONFIG',
        };
        
        const command = new PutCommand({
            TableName: CONFIG_TABLE_NAME,
            Item: eventConfigItem,
            ConditionExpression: 'attribute_not_exists(eventId)', 
        });

        await ddbDocClient.send(command);

        return withCors({
            message: "Event created successfully.",
            eventId
        }, 201);

    } catch (error) {

        if (error instanceof ConditionalCheckFailedException) {
            return withCors({
                message: `Event ID '${getEventId(JSON.parse(event.body).eventName)}' already exists.`
            }, 409);
        }

        console.error("Error creating event config:", error);

        return withCors({ message: "Failed to create event." }, 500);
    }
};
