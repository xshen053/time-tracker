import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyHandler } from "aws-lambda";
import { withCors } from './wrapResponse';

// 初始化 AWS SDK 客户端
const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);

// 从 CDK 注入的环境变量中获取配置表名
const CONFIG_TABLE_NAME = process.env.EVENTS_CONFIG_TABLE_NAME!;

export const handler: APIGatewayProxyHandler = async () => {
    try {
        const command = new ScanCommand({
            TableName: CONFIG_TABLE_NAME,
            ProjectionExpression: "eventId, eventName, createdAt",
        });

        const result = await ddbDocClient.send(command);

        // 注意：这里 withCors 的参数必须是纯数据对象
        return withCors({
            events: result.Items,
            count: result.Count,
        });

    } catch (error) {
        console.error("Error querying Event Config:", error);
        return withCors({
            message: "Failed to retrieve event list.",
            error: (error as Error).message,
        }, 500);
    }
};
