#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib'; // <-- 修复后的导入
import { InfraStack } from '../lib/infra-stack';

const app = new cdk.App();

// 激活环境，使用当前 AWS CLI 配置的默认账户和区域
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

new InfraStack(app, 'InfraStack', {
  env: env, 
  /* 其他配置保持不变 */
});
