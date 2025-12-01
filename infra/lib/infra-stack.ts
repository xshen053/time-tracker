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
    // I. 资源定义 (Resource Definition)
    // ----------------------------------------------------

    // 1. DynamoDB Table (数据核心)
    const eventsTable = new dynamodb.Table(this, 'EventsTable', {
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      tableName: 'TimeTrackerEvents',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    // 1.1. GSI (全局二级索引)
    eventsTable.addGlobalSecondaryIndex({
        indexName: 'GSI1',
        partitionKey: { name: 'eventId', type: dynamodb.AttributeType.STRING }, 
        sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING }, 
        projectionType: dynamodb.ProjectionType.ALL,
    });

    this.eventsTableName = eventsTable.tableName;


    const eventsConfigTable = new dynamodb.Table(this, 'EventsConfigTable', {
          // 主键：eventId，确保每个 Event Name 只有一个条目
          partitionKey: { name: 'eventId', type: dynamodb.AttributeType.STRING },
          tableName: 'TimeTrackerEventsConfig',
          removalPolicy: cdk.RemovalPolicy.DESTROY,
          billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        });
        
        // 导出 EventsConfig 表名 (方便 Lambda 引用)
        new cdk.CfnOutput(this, 'EventsConfigTableNameOutput', {
          value: eventsConfigTable.tableName,
        });    


    // 2. Lambda Function (Log Time - POST)
    const logTimeFunction = new lambdaNodejs.NodejsFunction(this, 'LogTimeFunction', {
        runtime: lambda.Runtime.NODEJS_20_X, 
        entry: path.join(__dirname, '..', 'backend', 'logTime.ts'), 
        handler: 'handler',
        memorySize: 256,
        timeout: cdk.Duration.seconds(10),
        environment: {
                DYNAMODB_TABLE_NAME: eventsTable.tableName,
                EVENTS_CONFIG_TABLE_NAME: eventsConfigTable.tableName, 
            },
        bundling: {
            externalModules: ['@aws-sdk/client-dynamodb', '@aws-sdk/lib-dynamodb'],
        }
    });

    // 3. Lambda Function (Query Log - GET)
    const queryLogFunction = new lambdaNodejs.NodejsFunction(this, 'QueryLogFunction', {
        runtime: lambda.Runtime.NODEJS_20_X, 
        entry: path.join(__dirname, '..', 'backend', 'queryLog.ts'), 
        handler: 'handler',
        memorySize: 256,
        timeout: cdk.Duration.seconds(10),
        environment: {
                DYNAMODB_TABLE_NAME: eventsTable.tableName,
                EVENTS_CONFIG_TABLE_NAME: eventsConfigTable.tableName, 
            },
        bundling: {
             // Query 函数也需要 SDK，所以也进行外部化处理
            externalModules: ['@aws-sdk/client-dynamodb', '@aws-sdk/lib-dynamodb'],
        }
    });


    // ----------------------------------------------------
    // II. IAM 权限授予 (Permissions Granting)
    // ----------------------------------------------------

    // 1. 授予写入权限 (LogTimeFunction)
    eventsTable.grantWriteData(logTimeFunction); 
    
    // 2. 授予读取权限 (QueryLogFunction)
    eventsTable.grantReadData(queryLogFunction);    

    // 授予 Lambda 写入新配置表的权限 (LogTimeFunction 需要写入)
    eventsConfigTable.grantWriteData(logTimeFunction);

    // 授予 Lambda 读取新配置表的权限 (QueryLogFunction 需要读取)
    eventsConfigTable.grantReadData(queryLogFunction);
    // ----------------------------------------------------
    // III. API Gateway (接入层)
    // ----------------------------------------------------

    const api = new apigateway.RestApi(this, 'TimeTrackerApi', {
        restApiName: 'TimeTrackerService',
        description: 'Service for logging user activity time.',
        defaultCorsPreflightOptions: {
            allowOrigins: apigateway.Cors.ALL_ORIGINS,
            allowMethods: apigateway.Cors.ALL_METHODS, 
        },
    });

    // 定义 /log 资源
    const logResource = api.root.addResource('log');
    
    // 1. POST /log: 写入日志
    logResource.addMethod('POST', new apigateway.LambdaIntegration(logTimeFunction));

    // 2. GET /log: 查询日志
    logResource.addMethod('GET', new apigateway.LambdaIntegration(queryLogFunction));

    
    // ----------------------------------------------------
    // IV. 输出 (Outputs)
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
