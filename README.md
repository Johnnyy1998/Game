# Game

Serverless "guess the number" game. A pnpm workspace holding the Vite web client, and later the
API and the AWS CDK infrastructure that runs it.

## Repository layout

| Path    | Contents                                |
| ------- | --------------------------------------- |
| `web/`  | Vite, React and Tailwind client         |

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
```
