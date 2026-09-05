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

const startButton = () => screen.getByRole('button', { name: 'Start game' })

// Every test that plays needs a game, and starting one is now an explicit click.
const startGame = async () => {
  await userEvent.click(startButton())
  await screen.findByText(startedGame.message)
}

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
  it('does not touch the api until the game is started', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(201, startedGame))

    vi.stubGlobal('fetch', fetchMock)
    render(<App />)

    expect(await screen.findByText('Press start when you are ready.')).toBeDefined()
    expect(screen.queryByLabelText('Your guess')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('starts a game on the button press and reveals the form', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(201, startedGame))

    vi.stubGlobal('fetch', fetchMock)
    render(<App />)

    await userEvent.click(startButton())

    expect(await screen.findByText(startedGame.message)).toBeDefined()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(guessInput()).not.toHaveProperty('disabled', true))
  })

  it('reports the server feedback for a valid guess', async () => {
    const fetchMock = stubFetch(
      jsonResponse(200, { message: 'Too low. Try again!', outcome: 'tooLow', attempts: 1 }),
    )

    render(<App />)
    await startGame()

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
    await startGame()

    await userEvent.type(guessInput(), '101')
    await userEvent.click(guessButton())

    expect(await screen.findByText('Enter a whole number between 1 and 100.')).toBeDefined()
    expect(fetchMock.mock.calls.some(([input]) => String(input).endsWith('/guess'))).toBe(false)
  })

  it('locks the form and offers a new game after a correct guess', async () => {
    stubFetch(
      jsonResponse(200, {
        message: "Correct! You've guessed the number.",
        outcome: 'correct',
        attempts: 4,
      }),
    )

    render(<App />)
    await startGame()

    await userEvent.type(guessInput(), '42')
    await userEvent.click(guessButton())

    expect(await screen.findByText("Correct! You've guessed the number.")).toBeDefined()
    await waitFor(() => expect(guessInput()).toHaveProperty('disabled', true))
    expect(screen.getByRole('button', { name: 'New game' })).toBeDefined()
  })

  it('surfaces the api error message', async () => {
    stubFetch(
      jsonResponse(404, { error: { code: 'notFound', message: `Game ${gameId} was not found.` } }),
    )

    render(<App />)
    await startGame()

    await userEvent.type(guessInput(), '50')
    await userEvent.click(guessButton())

    expect(await screen.findByText(`Game ${gameId} was not found.`)).toBeDefined()
  })
})
