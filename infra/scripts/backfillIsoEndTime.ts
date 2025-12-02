/*
Backfill script: compute isoEndTime for items missing it and write back to DynamoDB.

Usage (locally):
  NODE_ENV=production node -r ts-node/register scripts/backfillIsoEndTime.ts

Requires AWS credentials in environment (AWS_PROFILE or access keys).

This script:
 - Scans the DynamoDB table exported by CDK (name read from ENV: DYNAMODB_TABLE_NAME)
 - For each item with dataType==='LOG' and missing isoEndTime, computes isoEndTime.
   - If item.endTime and item.date exist: parse `${date}T${endTime}` as local date/time then convert to ISO (UTC) and write to isoEndTime
   - Else, if item.isoStartTime exists and endTime exists: try to guess end day (if endTime as hh:mm leads to time < start then add day)
 - Updates the item with UpdateCommand setting isoEndTime attribute.

Be cautious: this will perform writes. Test on a small sample or add a dry-run flag.
*/

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const TABLE = process.env.DYNAMODB_TABLE_NAME;
if (!TABLE) {
  console.error('Please set DYNAMODB_TABLE_NAME environment variable');
  process.exit(1);
}

const client = new DynamoDBClient({});
const doc = DynamoDBDocumentClient.from(client);

function tryParseIsoFromDateAndTime(dateStr: string, timeStr: string): string | null {
  try {
    // Accept timeStr like '17:30', '5:30:00 PM', or an ISO time
    if (/\d{4}-\d{2}-\d{2}T/.test(timeStr)) {
      const d = new Date(timeStr);
      if (!isNaN(d.getTime())) return d.toISOString();
      return null;
    }
    // Normalize date separator
    const normalizedDate = dateStr.replace(/\//g, '-');
    // Build naive local date-time string and parse
    const combined = `${normalizedDate} ${timeStr}`;
    const d = new Date(combined);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch (e) {
    return null;
  }
}

async function backfill(dryRun = true) {
  console.log('Backfill isoEndTime for table', TABLE, 'dryRun=', dryRun);
  let ExclusiveStartKey: any = undefined;
  let totalScanned = 0;
  let totalUpdated = 0;
  do {
    const scan = new ScanCommand({
      TableName: TABLE,
      Limit: 1000,
      ExclusiveStartKey,
      ProjectionExpression: 'PK, SK, dataType, isoStartTime, date, startTime, endTime, isoEndTime'
    });
    const res = await doc.send(scan);
    const items = res.Items ?? [];
    totalScanned += items.length;
    for (const it of items) {
      try {
        if (it.dataType !== 'LOG') continue;
        if (it.isoEndTime) continue; // already set
        let isoEnd: string | null = null;
        if (it.date && it.endTime) {
          isoEnd = tryParseIsoFromDateAndTime(it.date, it.endTime);
        }
        if (!isoEnd && it.isoStartTime && it.endTime) {
          // try to compose from isoStartTime's date + endTime, and if < start add 1 day
          const start = new Date(it.isoStartTime);
          const datePart = it.isoStartTime.split('T')[0];
          const attempt = tryParseIsoFromDateAndTime(datePart, it.endTime);
          if (attempt) {
            const end = new Date(attempt);
            if (end.getTime() < start.getTime()) {
              // add one day
              const newEnd = new Date(end.getTime() + 24*3600*1000);
              isoEnd = newEnd.toISOString();
            } else {
              isoEnd = end.toISOString();
            }
          }
        }
        if (!isoEnd) {
          console.log('Could not compute isoEnd for', it.PK, it.SK);
          continue;
        }
        totalUpdated++;
        console.log('Will update', it.PK, it.SK, '->', isoEnd);
        if (!dryRun) {
          const up = new UpdateCommand({
            TableName: TABLE,
            Key: { PK: it.PK, SK: it.SK },
            UpdateExpression: 'SET isoEndTime = :ie',
            ExpressionAttributeValues: { ':ie': isoEnd }
          });
          await doc.send(up);
        }
      } catch (e) {
        console.error('Item error', e);
      }
    }

    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);

  console.log('Scanned items:', totalScanned, 'Updated candidates:', totalUpdated);
}

(async () => {
  const dry = process.argv.includes('--apply') ? false : true;
  await backfill(dry);
})();
