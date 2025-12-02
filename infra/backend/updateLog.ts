import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyHandler } from "aws-lambda";
import { withCors } from './wrapResponse';

// 初始化 AWS SDK 客户端
const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);

const DYNAMODB_TABLE_NAME = process.env.DYNAMODB_TABLE_NAME!;

/**
 * 动态构建 DynamoDB Update Expression
 * @param updates 包含要更新字段的通用对象
 * @returns 包含 UpdateExpression, AttributeNames, AttributeValues 的对象
 */
const buildUpdateExpression = (updates: { [key: string]: any }) => {
    const expressionAttributeNames: { [key: string]: string } = {};
    const expressionAttributeValues: { [key: string]: any } = {};
    const updateExpressionParts: string[] = [];
    
    // 允许修改的字段白名单（确保用户不能修改PK, SK, 或 eventId）
    const allowedFields = ['eventName', 'startTime', 'endTime', 'date', 'text', 'isoStartTime', 'isoEndTime']; 
    let valueIndex = 0;

    for (const key of allowedFields) {
        // 检查用户是否提供了该字段的更新值 (且不为 null)
        if (updates[key] !== undefined) {
            const nameKey = `#n${valueIndex}`; // e.g., #n0 (用于处理 'date' 等保留字)
            const valueKey = `:v${valueIndex}`; // e.g., :v0 (用于注入值)

            // 构造 ExpressionAttributeNames 和 Values
            expressionAttributeNames[nameKey] = key; 
            expressionAttributeValues[valueKey] = updates[key];
            
            // 构造 SET 子句: SET #n0 = :v0
            updateExpressionParts.push(`${nameKey} = ${valueKey}`);

            valueIndex++;
        }
    }

    if (updateExpressionParts.length === 0) {
        throw new Error("No valid fields provided for update.");
    }

    return {
        UpdateExpression: 'SET ' + updateExpressionParts.join(', '),
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
    };
};


// ----------------------------------------------------------------------
// API Gateway 主处理函数
// ----------------------------------------------------------------------
export const handler: APIGatewayProxyHandler = async (event) => {
    try {
        if (!event.body) {
            return { statusCode: 400, body: JSON.stringify({ message: "Missing request body" }) };
        }
        
        // 期望接收 PK, SK (主键) 和 updates (要修改的值)
        const { PK, SK, updates } = JSON.parse(event.body); 

        if (!PK || !SK || !updates) {
            return { statusCode: 400, body: JSON.stringify({ message: "Missing required keys (PK, SK, updates)" }) };
        }
        
        // 构建动态更新表达式
        const { UpdateExpression, ExpressionAttributeNames, ExpressionAttributeValues } = buildUpdateExpression(updates);

        // 添加 Condition Expression 的值
        ExpressionAttributeValues[':dataType'] = 'LOG'; 

        const command = new UpdateCommand({
            TableName: DYNAMODB_TABLE_NAME,
            Key: {
                PK: PK,
                SK: SK
            },
            UpdateExpression: UpdateExpression,
            ExpressionAttributeNames: ExpressionAttributeNames,
            ExpressionAttributeValues: ExpressionAttributeValues,
            // 确保只更新 LOG 类型的数据，防止意外修改配置项
            ConditionExpression: 'dataType = :dataType' 
        });

        await ddbDocClient.send(command);

        return withCors(
            { message: "Log record updated successfully." }
        );

    } catch (error) {
            console.error("Error updating log:", error);
            return withCors(
                { message: "Failed to update request", error: (error as Error).message },
                500
            );
        }
};
