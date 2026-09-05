import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { NotFoundError, ValidationError } from '../core'
import type { ErrorResponse } from '../schema'
import { jsonResponse, parseJsonBody, toErrorResponse } from './http.utils'

vi.mock('@aws-lambda-powertools/logger', () => ({
  Logger: class {
    error() {}
  },
}))

const schema = z.object({ guess: z.number().int() })

const readError = (body: string): ErrorResponse['error'] =>
  (JSON.parse(body) as ErrorResponse).error

describe('jsonResponse', () => {
  it('serialises the body with JSON headers and no caching', () => {
    const response = jsonResponse(200, { ok: true })

    expect(response).toEqual({
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: '{"ok":true}',
    })
  })
})

describe('parseJsonBody', () => {
  it('returns the parsed body when it matches the schema', () => {
    expect(parseJsonBody('{"guess":42}', schema)).toEqual({ guess: 42 })
  })

  it('rejects a missing body', () => {
    expect(() => parseJsonBody(null, schema)).toThrow(
      new ValidationError('Request body is required.'),
    )
  })

  it('rejects an empty body', () => {
    expect(() => parseJsonBody('', schema)).toThrow(
      new ValidationError('Request body is required.'),
    )
  })

  it('rejects malformed JSON', () => {
    expect(() => parseJsonBody('{oops', schema)).toThrow(
      new ValidationError('Request body must be valid JSON.'),
    )
  })

  it('reports field errors for a body that fails the schema', () => {
    let thrown: unknown

    try {
      parseJsonBody('{"guess":"x"}', schema)
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBeInstanceOf(ValidationError)
    expect((thrown as ValidationError).fieldErrors).toEqual([
      { field: 'guess', message: expect.any(String) },
    ])
  })
})

describe('toErrorResponse', () => {
  it('maps NotFoundError to 404', () => {
    const response = toErrorResponse(new NotFoundError('Game not found.'))

    expect(response.statusCode).toBe(404)
    expect(readError(response.body)).toEqual({ code: 'notFound', message: 'Game not found.' })
  })

  it('maps ValidationError to 400 and omits empty details', () => {
    const response = toErrorResponse(new ValidationError('Request body is required.'))

    expect(response.statusCode).toBe(400)
    expect(readError(response.body)).toEqual({
      code: 'badRequest',
      message: 'Request body is required.',
    })
  })

  it('maps ValidationError field errors to details', () => {
    const fieldErrors = [{ field: 'guess', message: 'Required' }]
    const response = toErrorResponse(new ValidationError('Request body is invalid.', fieldErrors))

    expect(response.statusCode).toBe(400)
    expect(readError(response.body).details).toEqual(fieldErrors)
  })

  it('masks unknown errors as 500', () => {
    const response = toErrorResponse(new Error('db exploded'))

    expect(response.statusCode).toBe(500)
    expect(readError(response.body)).toEqual({
      code: 'internalError',
      message: 'Internal server error',
    })
  })

  it('masks non-Error throwables as 500', () => {
    expect(toErrorResponse('string thrown').statusCode).toBe(500)
  })
})
