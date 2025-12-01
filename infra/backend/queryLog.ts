import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyHandler } from "aws-lambda";
import { withCors } from './wrapResponse';

// 初始化 AWS SDK 客户端
const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);

// 从 CDK 注入的环境变量中获取表名
const DYNAMODB_TABLE_NAME = process.env.DYNAMODB_TABLE_NAME!;
const GSI_NAME = 'GSI1'; // 全局二级索引的名称

/**
 * Normalize event name: convert to lowercase and remove spaces.
 */
const getEventId = (name: string): string => {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '');
};

// ----------------------------------------------------------------------
// API Gateway 主处理函数（已加入 CORS）
// ----------------------------------------------------------------------
export const handler: APIGatewayProxyHandler = async (event) => {
    try {
        const eventName = event.queryStringParameters?.eventName;
        const exclusiveStartKey = event.queryStringParameters?.nextKey;
        const limit = 100;

        if (!eventName) {
            return withCors({
                statusCode: 400,
                body: JSON.stringify({ message: "Missing required query parameter: eventName" }),
            });
        }

        const eventId = getEventId(eventName);
        let exclusiveStartKeyObject = undefined;

        if (exclusiveStartKey) {
            const decodedKey = Buffer.from(exclusiveStartKey, 'base64').toString('utf8');
            exclusiveStartKeyObject = JSON.parse(decodedKey);
        }

        const command = new QueryCommand({
            TableName: DYNAMODB_TABLE_NAME,
            IndexName: GSI_NAME,
            KeyConditionExpression: 'eventId = :eId',
            ExpressionAttributeValues: {
                ':eId': eventId,
            },
            ScanIndexForward: false,
            Limit : limit,
            ExclusiveStartKey: exclusiveStartKeyObject,
        });

        const result = await ddbDocClient.send(command);

        let nextKeyEncoded = undefined;
        if (result.LastEvaluatedKey) {
            nextKeyEncoded = Buffer
                .from(JSON.stringify(result.LastEvaluatedKey))
                .toString('base64');
        }

        return withCors({
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                data: result.Items,
                count: result.Count,
                nextKey: nextKeyEncoded,
            }),
        });

    } catch (error) {
        console.error("Error querying DynamoDB:", error);
        return withCors({
            statusCode: 500,
            body: JSON.stringify({ 
                message: "Failed to process request.",
                error: (error as Error).message 
            }),
        });
    }
};
