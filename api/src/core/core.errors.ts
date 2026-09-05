import type { FieldError } from '../schema'

/**
 * Domain errors know nothing about HTTP. The mapping to a status code and an
 * `ErrorCode` lives only in `http/http.utils.ts`.
 */
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NotFoundError'
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly fieldErrors: FieldError[] = [],
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}
