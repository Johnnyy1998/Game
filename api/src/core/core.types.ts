/** Every domain function takes validated input and an injected context. */
export interface Options<TInput, TContext> {
  readonly input: TInput
  readonly ctx: TContext
}
