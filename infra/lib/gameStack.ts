import * as path from 'node:path'
import { DEFAULT_GAME_TTL_SECONDS } from '@game/api'
import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps, Tags } from 'aws-cdk-lib'
import * as apigateway from 'aws-cdk-lib/aws-apigateway'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment'
import type { Construct } from 'constructs'

type GameStackProps = StackProps & {
  /** Built Vite output that gets published to S3. */
  webDistPath: string
  stage: string
}

const repoRoot = path.resolve(__dirname, '..', '..')
const handlersDir = path.join(repoRoot, 'api', 'src', 'handlers')

const isProd = (stage: string) => stage === 'prod'

const tableRemovalPolicy = (stage: string) =>
  isProd(stage) ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY

const logRetention = (stage: string) =>
  isProd(stage) ? logs.RetentionDays.THREE_MONTHS : logs.RetentionDays.ONE_WEEK

const logLevel = (stage: string) => (['prod', 'staging'].includes(stage) ? 'WARN' : 'INFO')

const createGameTable = (scope: Construct, stage: string) =>
  new dynamodb.TableV2(scope, 'GamesTable', {
    partitionKey: { name: 'gameId', type: dynamodb.AttributeType.STRING },
    billing: dynamodb.Billing.onDemand(),
    encryption: dynamodb.TableEncryptionV2.awsManagedKey(),
    timeToLiveAttribute: 'expiresAt',
    pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
    deletionProtection: isProd(stage),
    removalPolicy: tableRemovalPolicy(stage),
  })

const createHandler = (
  scope: Construct,
  name: string,
  entryFile: string,
  table: dynamodb.ITableV2,
  stage: string,
) =>
  new lambdaNodejs.NodejsFunction(scope, name, {
    entry: path.join(handlersDir, entryFile),
    handler: 'handler',
    runtime: lambda.Runtime.NODEJS_22_X,
    architecture: lambda.Architecture.ARM_64,
    memorySize: 512,
    timeout: Duration.seconds(10),
    tracing: lambda.Tracing.ACTIVE,
    projectRoot: repoRoot,
    depsLockFilePath: path.join(repoRoot, 'pnpm-lock.yaml'),
    environment: {
      TABLE_NAME: table.tableName,
      GAME_TTL_SECONDS: String(DEFAULT_GAME_TTL_SECONDS),
      POWERTOOLS_SERVICE_NAME: 'game-api',
      POWERTOOLS_LOG_LEVEL: logLevel(stage),
      NODE_OPTIONS: '--enable-source-maps',
    },
    logGroup: new logs.LogGroup(scope, `${name}Logs`, {
      retention: logRetention(stage),
      removalPolicy: RemovalPolicy.DESTROY,
    }),
    bundling: {
      format: lambdaNodejs.OutputFormat.ESM,
      target: 'node22',
      minify: true,
      sourceMap: true,
      // Bundling the SDK pins its version instead of inheriting the runtime's.
      externalModules: [],
      // esbuild keeps CJS deps working inside an ESM bundle.
      banner:
        "import{createRequire}from'node:module';const require=createRequire(import.meta.url);",
    },
  })

const createApi = (scope: Construct, table: dynamodb.ITableV2, stage: string) => {
  const startGame = createHandler(scope, 'StartGameFunction', 'startGame.ts', table, stage)
  const guess = createHandler(scope, 'GuessFunction', 'guess.ts', table, stage)

  table.grantWriteData(startGame)
  table.grantReadWriteData(guess)

  const api = new apigateway.RestApi(scope, 'GameApi', {
    restApiName: `${stage}-game`,
    description: 'Game API',
    endpointTypes: [apigateway.EndpointType.REGIONAL],
    // Creates the account-level AWS::ApiGateway::Account. In a shared account this
    // overwrites whatever role is already set, so flip it off there.
    cloudWatchRole: true,
    deploy: true,
    deployOptions: {
      // Stage name doubles as the CloudFront /api/* path prefix.
      stageName: 'api',
      metricsEnabled: true,
      tracingEnabled: true,
      loggingLevel: apigateway.MethodLoggingLevel.ERROR,
      throttlingRateLimit: 50,
      throttlingBurstLimit: 100,
      accessLogDestination: new apigateway.LogGroupLogDestination(
        new logs.LogGroup(scope, 'ApiAccessLogs', {
          retention: logRetention(stage),
          removalPolicy: RemovalPolicy.DESTROY,
        }),
      ),
      accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields(),
    },
  })

  api.root.addResource('start-game').addMethod('POST', new apigateway.LambdaIntegration(startGame))
  api.root.addResource('guess').addMethod('POST', new apigateway.LambdaIntegration(guess))

  return api
}

const createSecurityHeaders = (scope: Construct) =>
  new cloudfront.ResponseHeadersPolicy(scope, 'SiteSecurityHeaders', {
    securityHeadersBehavior: {
      contentSecurityPolicy: {
        contentSecurityPolicy:
          "default-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; frame-ancestors 'none'; base-uri 'none'",
        override: true,
      },
      contentTypeOptions: { override: true },
      frameOptions: { frameOption: cloudfront.HeadersFrameOption.DENY, override: true },
      referrerPolicy: {
        referrerPolicy: cloudfront.HeadersReferrerPolicy.SAME_ORIGIN,
        override: true,
      },
      strictTransportSecurity: {
        accessControlMaxAge: Duration.days(365),
        includeSubdomains: true,
        override: true,
      },
    },
  })

const createSite = (
  scope: Construct,
  api: apigateway.RestApi,
  webDistPath: string,
  stage: string,
) => {
  const bucket = new s3.Bucket(scope, 'WebBucket', {
    blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    encryption: s3.BucketEncryption.S3_MANAGED,
    enforceSSL: true,
    removalPolicy: isProd(stage) ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    autoDeleteObjects: !isProd(stage),
  })

  const distribution = new cloudfront.Distribution(scope, 'SiteDistribution', {
    comment: `${stage}-game`,
    defaultRootObject: 'index.html',
    httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
    priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    defaultBehavior: {
      origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
      cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      responseHeadersPolicy: createSecurityHeaders(scope),
      compress: true,
    },
    additionalBehaviors: {
      // Serving the API from the same origin keeps the browser free of CORS.
      'api/*': {
        origin: new origins.RestApiOrigin(api, { originPath: '/' }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        compress: true,
      },
    },
  })

  new s3deploy.BucketDeployment(scope, 'WebDeployment', {
    sources: [s3deploy.Source.asset(webDistPath)],
    destinationBucket: bucket,
    distribution,
    distributionPaths: ['/*'],
    prune: true,
  })

  return distribution
}

export const createGameStack = (scope: Construct, id: string, props: GameStackProps): Stack => {
  const { webDistPath, stage, ...stackProps } = props
  const stack = new Stack(scope, id, stackProps)

  Tags.of(stack).add('project', 'game')
  Tags.of(stack).add('stage', stage)

  const table = createGameTable(stack, stage)
  const api = createApi(stack, table, stage)
  const distribution = createSite(stack, api, webDistPath, stage)

  new CfnOutput(stack, 'siteUrl', {
    value: `https://${distribution.distributionDomainName}`,
    description: 'Play the game here',
  })
  new CfnOutput(stack, 'apiUrl', {
    value: api.url,
    description: 'Direct API Gateway stage, bypasses CloudFront; used by the Vite dev proxy',
  })
  new CfnOutput(stack, 'tableName', { value: table.tableName })

  return stack
}
