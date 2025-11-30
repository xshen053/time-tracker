import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyHandler } from "aws-lambda";
import { v4 as uuidv4 } from 'uuid';

// ----------------------------------------------------------------------
// 1. Initialize AWS SDK Client
// ----------------------------------------------------------------------
const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);

// Get table name from CDK injected environment variable
const DYNAMODB_TABLE_NAME = process.env.DYNAMODB_TABLE_NAME!;

/**
 * Normalize event name: convert to lowercase and remove spaces.
 * "MIT 6.S081" -> "mit6s081"
 * @param name Original event name
 * @returns Normalized ID
 */
const getEventId = (name: string): string => {
    // Regex to remove non-alphanumeric characters, keeping only letters and numbers
    return name.toLowerCase().replace(/[^a-z0-9]/g, '');
};

/**
 * Combine date and time strings into ISO 8601 timestamp format.
 * Format example: 2024-03-15T13:53:00.000Z (for sorting)
 * @param date Date in YYYY/MM/DD format (e.g., 2024/3/15)
 * @param time Time in HH:MM:SS AM/PM format (e.g., 1:53:00 PM)
 * @returns ISO 8601 timestamp string
 */
const getIsoTimestamp = (date: string, time: string): string => {
    // Here, we simply combine the date and time strings for parsing.
    const combinedDateTime = `${date.replace(/\//g, '-')} ${time}`;
    try {
        const dateObj = new Date(combinedDateTime);
        if (isNaN(dateObj.getTime())) {
             // If parsing fails, return a default value or throw an error.
            console.error("Invalid date/time combination:", combinedDateTime);
            return new Date().toISOString(); 
        }
        // Use ISO format for sorting
        return dateObj.toISOString();
    } catch (e) {
        console.error("Error generating timestamp:", e);
        return new Date().toISOString();
    }
}


// ----------------------------------------------------------------------
// 2. API Gateway Main Handler Function
// ----------------------------------------------------------------------
export const handler: APIGatewayProxyHandler = async (event) => {
    try {
        if (!event.body) {
            return { statusCode: 400, body: JSON.stringify({ message: "Missing request body" }) };
        }
        
        const data = JSON.parse(event.body);
        // Fields passed from the frontend (from your Excel data)
        const { eventName, startTime, endTime, date, text } = data; 

        if (!eventName || !startTime || !endTime || !date) {
            return { statusCode: 400, body: JSON.stringify({ message: "Missing required fields (eventName, startTime, endTime, date)" }) };
        }

        // --- Core Single-Table Design Logic ---
        
        // 1. Normalize Event ID
        const eventId = getEventId(eventName);
        
        // 2. Generate unique Log ID
        const logId = uuidv4(); 

        // 3. Generate sortable timestamp
        // We use startTime to define the sort key, as it is the start of the record.
        const isoStartTime = getIsoTimestamp(date, startTime); 
        
        // 4. Build primary key (PK/SK) to implement write sharding
        // PK: LOG#<random number 0-9> (for write sharding, preventing hot partitions)
        const randomShard = Math.floor(Math.random() * 10);
        const PK = `LOG#${randomShard}`; 
        
        // SK: TIME#<ISO timestamp> (for sorting, ensuring GSI also sorts by time)
        const SK = `TIME#${isoStartTime}`; 

        const item = {
            // --- Primary Keys ---
            PK: PK, 
            SK: SK, 
            
            // --- GSI Primary Key (for querying) ---
            eventId: eventId, 

            // --- Actual Log Data ---
            logId: logId, 
            eventName: eventName, // Keep original name for display
            date: date,
            startTime: startTime,
            endTime: endTime,
            text: text || '', // Text/Description of the record
            isoStartTime: isoStartTime, // Extra saving of ISO timestamp for easy calculation
            dataType: 'LOG', // Data type differentiation for future additions like 'METADATA'
        };

        const command = new PutCommand({
            TableName: DYNAMODB_TABLE_NAME,
            Item: item,
        });

        await ddbDocClient.send(command);

        return {
            statusCode: 200,
            body: JSON.stringify({ message: "Record written successfully.", eventId, logId }),
        };

    } catch (error) {
        console.error("Error writing to DynamoDB:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Failed to process request.", error: (error as Error).message }),
        };
    }
};
