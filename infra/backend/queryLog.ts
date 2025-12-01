import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyHandler } from "aws-lambda";

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
// API Gateway 主处理函数
// ----------------------------------------------------------------------
export const handler: APIGatewayProxyHandler = async (event) => {
    try {
        // 假设 eventName 是通过查询参数 (queryStringParameters) 传入
        const eventName = event.queryStringParameters?.eventName;
        // 可选：用于分页的游标
        const exclusiveStartKey = event.queryStringParameters?.nextKey;
        const limit = 100; // 强制限制每页 100 条记录，防止读取热点

        if (!eventName) {
            return { statusCode: 400, body: JSON.stringify({ message: "Missing required query parameter: eventName" }) };
        }

        const eventId = getEventId(eventName);
        let exclusiveStartKeyObject = undefined;

        // 如果存在 nextKey，则需要解析 Base64 编码的 ExclusiveStartKey
        if (exclusiveStartKey) {
            const decodedKey = Buffer.from(exclusiveStartKey, 'base64').toString('utf8');
            exclusiveStartKeyObject = JSON.parse(decodedKey);
        }

        const command = new QueryCommand({
            TableName: DYNAMODB_TABLE_NAME,
            IndexName: GSI_NAME,
            // 核心查询逻辑：使用 GSI1 的 Partition Key (eventId)
            KeyConditionExpression: 'eventId = :eId',
            ExpressionAttributeValues: {
                ':eId': eventId,
            },
            // 使用 SK (时间戳) 降序排列，以便显示最新的记录
            ScanIndexForward: false, 
            Limit: limit,
            ExclusiveStartKey: exclusiveStartKeyObject,
        });

        const result = await ddbDocClient.send(command);

        // --- 处理分页游标 ---
        let nextKeyEncoded = undefined;
        if (result.LastEvaluatedKey) {
            // 将 LastEvaluatedKey 编码为 Base64 字符串，供前端下一页请求使用
            nextKeyEncoded = Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64');
        }

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                data: result.Items,
                count: result.Count,
                nextKey: nextKeyEncoded,
            }),
        };

    } catch (error) {
        console.error("Error querying DynamoDB:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Failed to process request.", error: (error as Error).message }),
        };
    }
};
