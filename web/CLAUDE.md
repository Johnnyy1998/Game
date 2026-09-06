# web

Vite, React, Formik and Tailwind client. It is a single screen with two states: before a game and
during one.

## Layout

```
src/
  main.tsx            mounts App
  app.tsx             renders GameBoard
  gameClient.ts       the only module that calls the API
  hooks/
    useGame.ts        one game round: start, guess, feedback, attempts
    useGuessForm.ts   Formik plus the Zod field rule
  components/
    gameBoard.tsx     composes the hooks and switches between the two states
    startPanel.tsx    the state before a game
    guessForm.tsx     the field and the submit button
    feedbackBanner.tsx, gameFooter.tsx
    styles.ts         shared class name strings
```

## Contract

Import schemas and constants from `@game/api`; never redeclare them here. `MIN_SECRET` and
`MAX_SECRET` come from the API package so the client and the Lambdas cannot disagree about the
range.

`gameClient.ts` is the only module that touches `fetch`. It parses every response with the shared
schemas and returns a result object rather than throwing:

```ts
type ApiResult<T> = { isOk: true; data: T } | { isOk: false; message: string }
```

Annotate the parsed body as `unknown` before `safeParse`. `response.json()` returns `any`, and
without that annotation the `any` spreads through the rest of the function and disables checking.
What arrives is not guaranteed to match the endpoint: an error response, an HTML page from a
misconfigured proxy, or an older deployment all reach the same code.

## Traps that already cost time

- The guess field is `type="text"`, not `type="number"`. Formik coerces numeric inputs with
  `parseFloat`, which turned the value into a number the string schema then rejected with the wrong
  message.
- The form carries `noValidate`. Without it the browser's native constraints block submission before
  Formik validates, and the user sees a native tooltip instead of the app's message.

## Styling

- Tailwind v4 through the Vite plugin. There is no config file and no hand written CSS; the only
  stylesheet is `@import 'tailwindcss'`.
- Repeated class name strings belong in `components/styles.ts`. Two copies of a button's classes
  drift apart.
- Every colour needs its dark variant.
- No inline styles. The CloudFront policy is `style-src 'self'`, so an inline style would be blocked
  in production but work in dev.

## Local development

The Lambdas are not emulated. `web/.env.local` points `VITE_API_PROXY_TARGET` at a deployed API
Gateway stage and Vite proxies `/api/*` there. Without that file there is no proxy at all and the
dev server answers `/api/start-game` with HTML. Vite reads the file when the config loads, so
restart the dev server after changing it.
