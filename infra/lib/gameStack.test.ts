import * as path from 'node:path'
import { App, type Stack } from 'aws-cdk-lib'
import { Match, Template } from 'aws-cdk-lib/assertions'
import { beforeAll, describe, expect, it } from 'vitest'
import { createGameStack } from './gameStack'

let template: Template
let stack: Stack

beforeAll(() => {
  // Empty bundling-stacks list keeps esbuild out of the unit test run.
  const app = new App({ context: { 'aws:cdk:bundling-stacks': [] } })

  stack = createGameStack(app, 'testStack', {
    webDistPath: path.join(__dirname, 'fixtures', 'webDist'),
    stage: 'dev',
  })
  template = Template.fromStack(stack)
})

describe('game table', () => {
  it('uses gameId as the only key and expires finished games', () => {
    template.hasResourceProperties('AWS::DynamoDB::GlobalTable', {
      KeySchema: [{ AttributeName: 'gameId', KeyType: 'HASH' }],
      TimeToLiveSpecification: { AttributeName: 'expiresAt', Enabled: true },
      BillingMode: 'PAY_PER_REQUEST',
    })
  })
})

// CDK adds its own helper functions for the bucket deployment, so filter by runtime.
const findGameHandlers = () =>
  Object.values(
    template.findResources('AWS::Lambda::Function', {
      Properties: { Runtime: 'nodejs22.x' },
    }),
  )

describe('lambda functions', () => {
  it('creates one arm64 Node 22 function per endpoint', () => {
    expect(findGameHandlers()).toHaveLength(2)
    template.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'nodejs22.x',
      Architectures: ['arm64'],
      Handler: 'index.handler',
      TracingConfig: { Mode: 'Active' },
    })
  })

  it('passes the table name to the handlers', () => {
    findGameHandlers().forEach((fn) => {
      expect(fn.Properties?.Environment?.Variables).toMatchObject({
        TABLE_NAME: expect.anything(),
      })
    })
  })

  it('grants each handler only the table actions it calls', () => {
    const policies = Object.values(template.findResources('AWS::IAM::Policy'))
    const tableActions = policies
      .flatMap((policy) => policy.Properties?.PolicyDocument?.Statement ?? [])
      .map((statement: { Action?: string | string[] }) => [statement.Action].flat())
      .filter((actions) => actions.some((action) => String(action).startsWith('dynamodb:')))

    expect(tableActions).toContainEqual(['dynamodb:PutItem'])
    expect(tableActions).toContainEqual(['dynamodb:GetItem', 'dynamodb:UpdateItem'])
    expect(tableActions.flat()).not.toContain('dynamodb:Scan')
    expect(tableActions.flat()).not.toContain('dynamodb:DeleteItem')
  })
})

describe('rest api', () => {
  it('exposes POST /start-game and POST /guess on the api stage', () => {
    template.hasResourceProperties('AWS::ApiGateway::Resource', { PathPart: 'start-game' })
    template.hasResourceProperties('AWS::ApiGateway::Resource', { PathPart: 'guess' })
    template.resourceCountIs('AWS::ApiGateway::Method', 2)
    template.hasResourceProperties('AWS::ApiGateway::Method', {
      HttpMethod: 'POST',
      AuthorizationType: 'NONE',
      Integration: { IntegrationHttpMethod: 'POST', Type: 'AWS_PROXY' },
    })
    template.hasResourceProperties('AWS::ApiGateway::Stage', {
      StageName: 'api',
      TracingEnabled: true,
      AccessLogSetting: Match.objectLike({ DestinationArn: Match.anyValue() }),
    })
  })
})

describe('web delivery', () => {
  it('keeps the bucket private', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    })
  })

  it('routes api/* to API Gateway and everything else to S3', () => {
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        DefaultRootObject: 'index.html',
        CacheBehaviors: Match.arrayWith([
          Match.objectLike({ PathPattern: 'api/*', ViewerProtocolPolicy: 'https-only' }),
        ]),
        DefaultCacheBehavior: Match.objectLike({ ViewerProtocolPolicy: 'redirect-to-https' }),
      }),
    })
  })

  it('does not rewrite error responses, so api status codes survive', () => {
    const [distribution] = Object.values(template.findResources('AWS::CloudFront::Distribution'))

    expect(distribution?.Properties?.DistributionConfig?.CustomErrorResponses).toBeUndefined()
  })
})

describe('stage awareness', () => {
  it('retains the table and protects it from deletion in prod', () => {
    const app = new App({ context: { 'aws:cdk:bundling-stacks': [] } })
    const prodStack = createGameStack(app, 'prodStack', {
      webDistPath: path.join(__dirname, 'fixtures', 'webDist'),
      stage: 'prod',
    })
    const prodTemplate = Template.fromStack(prodStack)

    prodTemplate.hasResource('AWS::DynamoDB::GlobalTable', {
      DeletionPolicy: 'Retain',
      Properties: Match.objectLike({
        Replicas: Match.arrayWith([Match.objectLike({ DeletionProtectionEnabled: true })]),
      }),
    })
  })

  it('tags every resource with the project and stage', () => {
    // TableV2 carries tags on the replica rather than the table itself.
    template.hasResourceProperties('AWS::DynamoDB::GlobalTable', {
      Replicas: Match.arrayWith([
        Match.objectLike({
          Tags: Match.arrayWith([
            { Key: 'project', Value: 'game' },
            { Key: 'stage', Value: 'dev' },
          ]),
        }),
      ]),
    })
  })
})

describe('stack outputs', () => {
  it('publishes the site and api urls', () => {
    const outputs = Object.keys(template.findOutputs('*'))

    expect(outputs).toEqual(expect.arrayContaining(['apiUrl', 'siteUrl', 'tableName']))
  })
})
