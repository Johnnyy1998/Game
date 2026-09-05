# Game

Serverless "guess the number" game. A pnpm workspace holding the Vite web client, the API contract,
and later the handlers and AWS CDK infrastructure that run it.

## Repository layout

| Path   | Contents                                                  |
| ------ | --------------------------------------------------------- |
| `api/` | Zod schemas shared with the client, later the Lambda handlers |
| `web/` | Vite, React and Tailwind client                           |

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
