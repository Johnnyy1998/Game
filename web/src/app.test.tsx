import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './app'

const gameId = '3f1a9b7e-2c4d-4f6a-9b8c-5d7e1a2b3c4d'

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })

const startedGame = {
  gameId,
  message: 'Game started. Make a guess between 1 and 100.',
}

const stubFetch = (guessResponse: Response) => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) =>
    String(input).endsWith('/start-game') ? jsonResponse(201, startedGame) : guessResponse,
  )

  vi.stubGlobal('fetch', fetchMock)

  return fetchMock
}

const guessInput = () => screen.getByLabelText('Your guess')

const guessButton = () => screen.getByRole('button', { name: 'Guess' })

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => jsonResponse(201, startedGame)),
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('App', () => {
  it('starts a game on mount and enables the form', async () => {
    render(<App />)

    expect(await screen.findByText(startedGame.message)).toBeDefined()
    await waitFor(() => expect(guessInput()).not.toHaveProperty('disabled', true))
  })

  it('reports the server feedback for a valid guess', async () => {
    const fetchMock = stubFetch(
      jsonResponse(200, { message: 'Too low. Try again!', outcome: 'tooLow', attempts: 1 }),
    )

    render(<App />)
    await screen.findByText(startedGame.message)

    await userEvent.type(guessInput(), '10')
    await userEvent.click(guessButton())

    expect(await screen.findByText('Too low. Try again!')).toBeDefined()
    expect(screen.getByText('Attempts: 1')).toBeDefined()

    const guessCall = fetchMock.mock.calls.find(([input]) => String(input).endsWith('/guess'))

    expect(guessCall?.[1]).toMatchObject({ body: JSON.stringify({ gameId, guess: 10 }) })
  })

  it('blocks an out of range guess before it reaches the api', async () => {
    const fetchMock = stubFetch(jsonResponse(200, {}))

    render(<App />)
    await screen.findByText(startedGame.message)

    await userEvent.type(guessInput(), '101')
    await userEvent.click(guessButton())

    expect(await screen.findByText('Enter a whole number between 1 and 100.')).toBeDefined()
    expect(fetchMock.mock.calls.some(([input]) => String(input).endsWith('/guess'))).toBe(false)
  })

  it('locks the form and keeps the win message after a correct guess', async () => {
    stubFetch(
      jsonResponse(200, {
        message: "Correct! You've guessed the number.",
        outcome: 'correct',
        attempts: 4,
      }),
    )

    render(<App />)
    await screen.findByText(startedGame.message)

    await userEvent.type(guessInput(), '42')
    await userEvent.click(guessButton())

    expect(await screen.findByText("Correct! You've guessed the number.")).toBeDefined()
    await waitFor(() => expect(guessInput()).toHaveProperty('disabled', true))
  })

  it('surfaces the api error message', async () => {
    stubFetch(
      jsonResponse(404, { error: { code: 'notFound', message: `Game ${gameId} was not found.` } }),
    )

    render(<App />)
    await screen.findByText(startedGame.message)

    await userEvent.type(guessInput(), '50')
    await userEvent.click(guessButton())

    expect(await screen.findByText(`Game ${gameId} was not found.`)).toBeDefined()
  })
})
