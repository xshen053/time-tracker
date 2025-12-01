// backend/deleteLog.ts
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyHandler } from "aws-lambda";
// Assuming you have the withCors function available in a separate file (e.g., './wrapResponse')
import { withCors } from './wrapResponse'; 

const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);
const DYNAMODB_TABLE_NAME = process.env.DYNAMODB_TABLE_NAME!;

export const handler: APIGatewayProxyHandler = async (event) => {
    try {
        if (!event.body) {
            // FIX 1: Wrap 400 Bad Request with CORS
            return withCors(
                { message: "Missing request body" },
                400
            );
        }
        
        // We expect PK and SK in the body to identify the item
        const { PK, SK } = JSON.parse(event.body); 

        if (!PK || !SK) {
            // FIX 2: Wrap 400 Bad Request with CORS
            return withCors(
                { message: "Missing required keys (PK, SK)" },
                400
            );
        }
        
        const command = new DeleteCommand({
            TableName: DYNAMODB_TABLE_NAME,
            Key: {
                PK: PK,
                SK: SK
            },
            // ConditionExpression: ensures we only delete LOG items, not metadata configs.
            ConditionExpression: 'dataType = :dataType', 
            ExpressionAttributeValues: { ':dataType': 'LOG' }
        });

        await ddbDocClient.send(command);

        // FIX 3: Wrap the successful DELETE response.
        // 204 No Content is standard for a successful DELETE that returns no body.
        return withCors(
            { message: "Log record deleted successfully." },
            204 
        );

    } catch (error) {
        // FIX 4: Ensure Catch Block uses withCors for the 500 error
        console.error("Error deleting DynamoDB item:", error);
        
        // A common error here is attempting to delete an item that doesn't exist.
        // If the item doesn't exist, the ConditionExpression will fail, throwing 
        // ConditionalCheckFailedException. We should handle this specifically.
        if ((error as Error).name === 'ConditionalCheckFailedException') {
             return withCors(
                { message: "Item not found or is not a log record." },
                404 // Use 404 for item not found
            );
        }

        return withCors(
            { message: "Failed to delete record.", error: (error as Error).message },
            500
        );
    }
};
