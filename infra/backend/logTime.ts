import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyHandler } from "aws-lambda";
import { v4 as uuidv4 } from 'uuid';
import { withCors } from './wrapResponse';

// ----------------------------------------------------------------------
// 1. Initialize AWS SDK Client
// ----------------------------------------------------------------------
const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);

// Table name from environment
const DYNAMODB_TABLE_NAME = process.env.DYNAMODB_TABLE_NAME!;

// Normalize event name
const getEventId = (name: string): string => {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '');
};

// Convert date + time → ISO timestamp
const getIsoTimestamp = (date: string, time: string): string => {
    const combined = `${date.replace(/\//g, '-')} ${time}`;
    const dateObj = new Date(combined);

    if (isNaN(dateObj.getTime())) {
        console.error("Invalid date/time:", combined);
        return new Date().toISOString();
    }

    return dateObj.toISOString();
};

// ----------------------------------------------------------------------
// 2. API Gateway Main Handler
// ----------------------------------------------------------------------
export const handler: APIGatewayProxyHandler = async (event) => {
    try {
        if (!event.body) {
            return withCors({ message: "Missing request body" }, 400);
        }

        const { eventName, startTime, endTime, date, text } = JSON.parse(event.body);

        if (!eventName || !startTime || !endTime || !date) {
            return withCors(
                { message: "Missing required fields (eventName, startTime, endTime, date)" },
                400
            );
        }

        // Build keys
        const eventId = getEventId(eventName);
        const logId = uuidv4();
        const isoStartTime = getIsoTimestamp(date, startTime);
        const isoEndTime = getIsoTimestamp(date, endTime);

        // PK = shard
        const shard = Math.floor(Math.random() * 10);
        const PK = `LOG#${shard}`;
        const SK = `TIME#${isoStartTime}`;

        const item = {
            PK,
            SK,
            eventId,
            logId,
            eventName,
            date,
            startTime,
            endTime,
            text: text || "",
            isoStartTime,
            isoEndTime,
            dataType: "LOG",
        };

        await ddbDocClient.send(new PutCommand({
            TableName: DYNAMODB_TABLE_NAME,
            Item: item,
        }));

        return withCors({
            message: "Record written successfully",
            eventId,
            logId,
        });

    } catch (error) {
        console.error("Error writing log:", error);
        return withCors(
            { message: "Failed to process request", error: (error as Error).message },
            500
        );
    }
};
