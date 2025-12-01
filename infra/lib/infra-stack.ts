import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as path from 'path';
import { createEventsConfigTable, createTimeLogTable } from './tables/table-helpers';

export class InfraStack extends cdk.Stack {

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ----------------------------------------------------
    // I. 资源定义 (Resource Definition)
    // ----------------------------------------------------

    // 1. DynamoDB Table (数据核心)
    const eventsTable = createTimeLogTable(this, 'EventsTable')

    const eventsConfigTable = createEventsConfigTable(this, 'EventsConfigTable')
        
    // 1. 辅助函数：用于创建 Lambda NodejsFunction (需要定义在 InfraStack 类内)
    const createNodejsFunction = (id: string, entryFile: string, tableEnv: any, extraModules: string[] = []): lambdaNodejs.NodejsFunction => {
        // 合并所有环境所需的表名
        const environment = {
            ...tableEnv,
            DYNAMODB_TABLE_NAME: eventsTable.tableName, // 假设 logTime 和 queryLog 需要
            EVENTS_CONFIG_TABLE_NAME: eventsConfigTable.tableName, // 假设所有函数都需要
        };

        return new lambdaNodejs.NodejsFunction(this, id, {
            runtime: lambda.Runtime.NODEJS_20_X, 
            entry: path.join(__dirname, '..', 'backend', entryFile), 
            handler: 'handler',
            memorySize: 256,
            timeout: cdk.Duration.seconds(10),
            environment: environment,
            bundling: {
                // 将所有 AWS SDKs 和 extraModules (如 uuid) 外部化
                externalModules: ['@aws-sdk/client-dynamodb', '@aws-sdk/lib-dynamodb', ...extraModules],
            }
        });
    };

    // 2. Lambda Function Instances (Log Time - POST)
    const logTimeFunction = createNodejsFunction('LogTimeFunction', 'logTime.ts', { });
    
    // 3. Lambda Function Instances (Query Log - GET)
    const queryLogFunction = createNodejsFunction('QueryLogFunction', 'queryLog.ts', { }); 

    // 4. Lambda Function Instances (Create Event - POST /events)
    const createEventFunction = createNodejsFunction('CreateEventFunction', 'createEvent.ts', { }); // CreateEvent needs UUID

    // 5. Lambda Function Instances (Get Events - GET /events)
    const getEventsFunction = createNodejsFunction('GetEventsFunction', 'getEvents.ts', { });

    // 授予 CreateEventFunction 写入 Config 表的权限
    eventsConfigTable.grantWriteData(createEventFunction);

    // 授予 GetEventsFunction 读取 Config 表的权限
    eventsConfigTable.grantReadData(getEventsFunction);

    // 1. 授予写入权限 (LogTimeFunction)
    eventsTable.grantWriteData(logTimeFunction); 
    
    // 2. 授予读取权限 (QueryLogFunction)
    eventsTable.grantReadData(queryLogFunction);    

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

    const eventsResource = api.root.addResource('events');

    // 2. POST /events: 创建 Event
    eventsResource.addMethod('POST', new apigateway.LambdaIntegration(createEventFunction));

    // 3. GET /events: 查询 Event 列表
    eventsResource.addMethod('GET', new apigateway.LambdaIntegration(getEventsFunction));

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

    // 导出 EventsConfig 表名 (方便 Lambda 引用)
    new cdk.CfnOutput(this, 'EventsConfigTableNameOutput', {
        value: eventsConfigTable.tableName,
    });    

    new cdk.CfnOutput(this, 'DynamoDBTableNameOutput', {
      value: eventsTable.tableName,
    });
  }
}
