import { Logger } from '@aws-lambda-powertools/logger'
import type { APIGatewayProxyResult } from 'aws-lambda'
import type { ZodType } from 'zod'
import { NotFoundError, ValidationError } from '../core'
import type { ErrorCode, ErrorResponse } from '../schema'

const logger = new Logger({ serviceName: 'game-api' })

const HTTP_STATUS_BY_ERROR_CODE = {
  badRequest: 400,
  notFound: 404,
  internalError: 500,
} as const satisfies Record<ErrorCode, number>

export const jsonResponse = (statusCode: number, body: unknown): APIGatewayProxyResult => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
})

const errorResponse = (error: ErrorResponse['error']): APIGatewayProxyResult =>
  jsonResponse(HTTP_STATUS_BY_ERROR_CODE[error.code], { error } satisfies ErrorResponse)

/**
 * Single place that turns any thrown value into an API response. Domain errors
 * know nothing about HTTP; the mapping lives only here. Anything unexpected is
 * logged and masked as 500 so internals never leak.
 */
export const toErrorResponse = (error: unknown): APIGatewayProxyResult => {
  if (error instanceof NotFoundError)
    return errorResponse({ code: 'notFound', message: error.message })

  if (error instanceof ValidationError)
    return errorResponse({
      code: 'badRequest',
      message: error.message,
      ...(error.fieldErrors.length > 0 && { details: error.fieldErrors }),
    })

  logger.error('Unhandled error', { error })

  return errorResponse({ code: 'internalError', message: 'Internal server error' })
}

/**
 * The only place a schema failure becomes a ValidationError. A schema failure
 * anywhere else, such as missing configuration, stays a server fault.
 */
export const parseJsonBody = <T>(body: string | null, schema: ZodType<T>): T => {
  if (!body) throw new ValidationError('Request body is required.')

  let payload: unknown

  try {
    payload = JSON.parse(body)
  } catch {
    throw new ValidationError('Request body must be valid JSON.')
  }

  const result = schema.safeParse(payload)

  if (!result.success)
    throw new ValidationError(
      'Request body is invalid.',
      result.error.issues.map(({ path, message }) => ({ field: path.join('.'), message })),
    )

  return result.data
}
