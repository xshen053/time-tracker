import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyHandler } from "aws-lambda";

// 初始化 AWS SDK 客户端
const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);

// 从 CDK 注入的环境变量中获取配置表名
const CONFIG_TABLE_NAME = process.env.EVENTS_CONFIG_TABLE_NAME!;

// ----------------------------------------------------------------------
// API Gateway 主处理函数
// ----------------------------------------------------------------------
export const handler: APIGatewayProxyHandler = async (event) => {
    try {
        // 由于配置表数据量极小，我们使用 Scan 来获取所有唯一的 Event Item
        const command = new ScanCommand({
            TableName: CONFIG_TABLE_NAME,
            // 投影表达式只获取需要的字段，减少带宽和查询成本
            ProjectionExpression: "eventId, eventName, createdAt", 
        });

        const result = await ddbDocClient.send(command);

        // 返回 Events 列表
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                events: result.Items,
                count: result.Count,
            }),
        };

    } catch (error) {
        console.error("Error querying Event Config:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Failed to retrieve event list.", error: (error as Error).message }),
        };
    }
};
