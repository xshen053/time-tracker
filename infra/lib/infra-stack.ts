import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as path from 'path';

export class InfraStack extends cdk.Stack {
  public readonly eventsTableName: string;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ----------------------------------------------------
    // 1. DynamoDB: 存储事件元数据和时间日志 (单表设计)
    // ----------------------------------------------------
    const eventsTable = new dynamodb.Table(this, 'EventsTable', {
      // 主键：用于写入分散和日志排序
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      tableName: 'TimeTrackerEvents',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    // **新增 GSI (全局二级索引)：用于按 eventId 查询**
    eventsTable.addGlobalSecondaryIndex({
        indexName: 'GSI1',
        partitionKey: { name: 'eventId', type: dynamodb.AttributeType.STRING }, 
        sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING }, 
        projectionType: dynamodb.ProjectionType.ALL,
    });

    this.eventsTableName = eventsTable.tableName;

    // ----------------------------------------------------
    // 2. Lambda Function: LogTimeFunction (API 后端逻辑)
    // ----------------------------------------------------
    const logTimeFunction = new lambdaNodejs.NodejsFunction(this, 'LogTimeFunction', {
        runtime: lambda.Runtime.NODEJS_20_X, 
        entry: path.join(__dirname, '..', 'backend', 'logTime.ts'), // <--- 修正后的路径
        handler: 'handler',
        memorySize: 256,
        timeout: cdk.Duration.seconds(10),
        environment: {
            // 注入 DynamoDB 表名
            DYNAMODB_TABLE_NAME: eventsTable.tableName,
        },
        bundling: {
            // 确保依赖被正确打包，尤其是 uuid 和 AWS SDKs
            externalModules: ['@aws-sdk/client-dynamodb', '@aws-sdk/lib-dynamodb', 'uuid'],
        }
    });

    // 授予 Lambda 写入 DynamoDB 表的权限 (必须！)
    eventsTable.grantWriteData(logTimeFunction); 
    
    // ----------------------------------------------------
    // 3. API Gateway: 创建 REST API 端点
    // ----------------------------------------------------
    const api = new apigateway.RestApi(this, 'TimeTrackerApi', {
        restApiName: 'TimeTrackerService',
        description: 'Service for logging user activity time.',
        defaultCorsPreflightOptions: {
            allowOrigins: apigateway.Cors.ALL_ORIGINS,
            allowMethods: apigateway.Cors.ALL_METHODS, 
        },
    });

    // 定义 /log 资源，并将 Lambda 函数与 POST 方法集成
    const logResource = api.root.addResource('log');
    logResource.addMethod('POST', new apigateway.LambdaIntegration(logTimeFunction));

    // ----------------------------------------------------
    // 4. CDK 输出 (导出 API Endpoint URL)
    // ----------------------------------------------------
    new cdk.CfnOutput(this, 'ApiGatewayEndpoint', {
        value: api.url,
        description: 'The API Gateway endpoint for logging time records.',
    });
    new cdk.CfnOutput(this, 'DynamoDBTableNameOutput', {
      value: eventsTable.tableName,
    });
  }
}
