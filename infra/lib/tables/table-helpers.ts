import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

/**
 * 创建 TimeTrackerEvents 主日志表（包含 PK/SK/GSI1 定义）。
 * 这是一个简单的工厂函数，返回一个 DynamoDB Table 实例。
 */
export function createTimeLogTable(scope: Construct, id: string): dynamodb.Table {
    const table = new dynamodb.Table(scope, id, {
        // Primary Keys for Write Sharding
        partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
        sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
        tableName: 'TimeTrackerEvents',
        removalPolicy: cdk.RemovalPolicy.DESTROY, 
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    // Global Secondary Index (GSI1): Required to query by eventId
    table.addGlobalSecondaryIndex({
        indexName: 'GSI1',
        partitionKey: { name: 'eventId', type: dynamodb.AttributeType.STRING }, 
        sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING }, 
        projectionType: dynamodb.ProjectionType.ALL,
    });

    return table;
}

// -------------------------------------------------------------------
// 额外封装：创建 EventsConfig 表的函数 (可选，但推荐保持一致性)
// -------------------------------------------------------------------

/**
 * 创建 EventsConfig 表 (用于唯一的 Event 名称元数据)。
 */
export function createEventsConfigTable(scope: Construct, id: string): dynamodb.Table {
    const table = new dynamodb.Table(scope, id, {
        // 主键：eventId，确保每个 Event Name 只有一个条目
        partitionKey: { name: 'eventId', type: dynamodb.AttributeType.STRING },
        tableName: 'TimeTrackerEventsConfig',
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });
    
    return table;
}
