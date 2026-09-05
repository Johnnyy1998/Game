# Game

Serverless "guess the number" game. A pnpm workspace holding the Vite web client, the API contract,
and later the handlers and AWS CDK infrastructure that run it.

## Repository layout

| Path   | Contents                                                        |
| ------ | --------------------------------------------------------------- |
| `api/` | Zod schemas shared with the client, plus the HTTP layer         |
| `web/` | Vite, React and Tailwind client                                 |

## Prerequisites

- Node.js 22 (`.nvmrc` is provided)
- pnpm 10

## Commands

```bash
pnpm install   # install every workspace package
pnpm dev       # run the web client locally
pnpm build     # build the web client into web/dist
pnpm lint      # Biome format and lint check
pnpm lint:fix  # apply Biome fixes
pnpm typecheck # TypeScript across the workspace
pnpm test      # unit tests
pnpm verify    # lint, typecheck and every test
```

`api/src/schema.ts` is the shared contract and the entry point of the `@game/api` package. The web
client imports the same Zod schemas the API validates against, so a change to the API shape breaks
the client at compile time.

## Error responses

All errors share one shape, and `code` is a closed set: `badRequest`, `notFound` or
`internalError`. `details` is present only for validation failures and lists the offending fields.

```json
{
  "error": {
    "code": "badRequest",
    "message": "Request body is invalid.",
    "details": [{ "field": "guess", "message": "Expected number, received string" }]
  }
}
```

Domain code throws transport-agnostic errors from `api/src/core/core.errors.ts` (`NotFoundError`,
`ValidationError`) and knows nothing about HTTP. `toErrorResponse` in `api/src/http/http.utils.ts`
is the single place that maps a thrown value to a response and masks anything unexpected as a 500.
`HTTP_STATUS_BY_ERROR_CODE` is checked with `satisfies Record<ErrorCode, number>`, so a new code
fails the build until its status is added.
