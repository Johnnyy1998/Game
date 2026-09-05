#!/usr/bin/env node
import { existsSync } from 'node:fs'
import * as path from 'node:path'
import { App } from 'aws-cdk-lib'
import { createGameStack } from '../lib/gameStack'

const webDistPath = path.resolve(__dirname, '..', '..', 'web', 'dist')

if (!existsSync(webDistPath))
  throw new Error(`Missing ${webDistPath}. Run "pnpm build" before synthesising the stack.`)

const app = new App()

// Pass with `cdk deploy -c stage=prod`; the stack id carries it so several stages
// can live in one account.
const stage = String(app.node.tryGetContext('stage') ?? 'dev')

createGameStack(app, `${stage}-gameStack`, {
  webDistPath,
  stage,
  description: 'Game: API Gateway, Lambda, DynamoDB, S3 and CloudFront',
})
