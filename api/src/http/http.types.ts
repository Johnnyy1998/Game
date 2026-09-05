import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'

/**
 * Narrower than `APIGatewayProxyHandler`, which also allows the legacy callback
 * form and a `void` result. This shape is directly callable from a test.
 */
export type ApiHandler = (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>
