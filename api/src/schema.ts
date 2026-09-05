import { z } from 'zod'

export const MIN_SECRET = 1
export const MAX_SECRET = 100

/** Fallback when the handler passes no TTL; infra overrides it per stage. */
export const DEFAULT_GAME_TTL_SECONDS = 600

const GameStatusSchema = z.enum(['active', 'won'])
export type GameStatus = z.infer<typeof GameStatusSchema>

const GuessOutcomeSchema = z.enum(['tooLow', 'tooHigh', 'correct'])
export type GuessOutcome = z.infer<typeof GuessOutcomeSchema>

const SecretNumberSchema = z.number().int().min(MIN_SECRET).max(MAX_SECRET)

export const GameSchema = z.object({
  gameId: z.string().uuid(),
  secretNumber: SecretNumberSchema,
  status: GameStatusSchema,
  attempts: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  expiresAt: z.number().int().positive(),
})
export type Game = z.infer<typeof GameSchema>

export const GuessRequestSchema = z.object({
  gameId: z.string().uuid(),
  guess: SecretNumberSchema,
})
export type GuessRequest = z.infer<typeof GuessRequestSchema>

export const StartGameResponseSchema = z.object({
  gameId: z.string().uuid(),
  message: z.string(),
})
export type StartGameResponse = z.infer<typeof StartGameResponseSchema>

export const GuessResponseSchema = z.object({
  message: z.string(),
  outcome: GuessOutcomeSchema,
  attempts: z.number().int().positive(),
})
export type GuessResponse = z.infer<typeof GuessResponseSchema>

export const ErrorCodeSchema = z.enum(['badRequest', 'notFound', 'internalError'])
export type ErrorCode = z.infer<typeof ErrorCodeSchema>

export const FieldErrorSchema = z.object({
  field: z.string(),
  message: z.string(),
})
export type FieldError = z.infer<typeof FieldErrorSchema>

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string(),
    details: z.array(FieldErrorSchema).optional(),
  }),
})
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>
