/* eslint-disable no-console */
/**
 * Unit tests for RubyteeAPI
 * Tests: relay communication, message sending, code block extraction, error handling
 */

// Mock fetch globally
global.fetch = jest.fn()

describe('RubyteeAPI', () => {
  let RubyteeAPI
  let RateLimitError
  let rubyteeApi

  beforeEach(() => {
    jest.resetModules()
    global.fetch = jest.fn()

    const module = require('../../../src/lib/rubytee-api')
    RubyteeAPI = module.default
    RateLimitError = module.RateLimitError
    rubyteeApi = new RubyteeAPI()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('constructor', () => {
    test('should initialize with empty chat history', () => {
      expect(rubyteeApi.history).toEqual([])
    })
  })

  describe('sendMessage', () => {
    const mockRelayResponse = {
      text: 'Here is a simple program:\n```ruby\nloop do\n  move(10)\nend\n```',
      outputTokens: 42,
    }

    beforeEach(() => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(mockRelayResponse),
      })
    })

    test('should POST to relay /generate endpoint', async () => {
      await rubyteeApi.sendMessage('make sprite move', {})

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/generate'),
        expect.objectContaining({ method: 'POST' }),
      )
    })

    test('should not include Authorization header', async () => {
      await rubyteeApi.sendMessage('make sprite move', {})

      const callArgs = global.fetch.mock.calls[0][1]
      expect(callArgs.headers['Authorization']).toBeUndefined()
    })

    test('should send userMessage, history, and stateContext in request body', async () => {
      const stateContext = { sprite: { name: 'Cat' } }
      await rubyteeApi.sendMessage('make sprite move', stateContext)

      const callArgs = global.fetch.mock.calls[0][1]
      const body = JSON.parse(callArgs.body)
      expect(body.userMessage).toBe('make sprite move')
      expect(body.history).toBeDefined()
      expect(body.stateContext).toEqual(stateContext)
    })

    test('should return response text from relay', async () => {
      const result = await rubyteeApi.sendMessage('make sprite move', {})
      expect(result).toBe(mockRelayResponse.text)
    })

    test('should add user message and assistant response to history', async () => {
      await rubyteeApi.sendMessage('make sprite move', {})

      expect(rubyteeApi.history).toHaveLength(2)
      expect(rubyteeApi.history[0].role).toBe('user')
      expect(rubyteeApi.history[1].role).toBe('model')
    })

    test('should maintain chat history across multiple messages', async () => {
      await rubyteeApi.sendMessage('first message', {})
      await rubyteeApi.sendMessage('second message', {})

      expect(rubyteeApi.history).toHaveLength(4)
    })

    test('should include previous history in subsequent requests', async () => {
      await rubyteeApi.sendMessage('first message', {})

      const firstCallBody = JSON.parse(global.fetch.mock.calls[0][1].body)
      expect(firstCallBody.history).toHaveLength(0)

      await rubyteeApi.sendMessage('second message', {})

      const secondCallBody = JSON.parse(global.fetch.mock.calls[1][1].body)
      expect(secondCallBody.history).toHaveLength(2)
    })

    test('should throw RateLimitError when relay returns 429', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 429,
        json: jest.fn().mockResolvedValue({
          error: 'RATE_LIMIT_EXCEEDED',
          resetAfterSeconds: 600,
        }),
      })

      await expect(rubyteeApi.sendMessage('test', {})).rejects.toThrow(RateLimitError)
    })

    test('should include resetAfterSeconds in RateLimitError', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 429,
        json: jest.fn().mockResolvedValue({
          error: 'RATE_LIMIT_EXCEEDED',
          resetAfterSeconds: 600,
        }),
      })

      await expect(rubyteeApi.sendMessage('test', {})).rejects.toMatchObject({
        name: 'RateLimitError',
        resetAfterSeconds: 600,
      })
    })

    test('should throw error when relay returns non-ok response', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: jest.fn().mockResolvedValue('Internal Server Error'),
      })

      await expect(rubyteeApi.sendMessage('test', {})).rejects.toThrow()
    })
  })

  describe('extractCodeBlock', () => {
    test('should extract ruby code block from markdown', () => {
      const text = 'Here is code:\n```ruby\nmove(10)\n```'
      const code = RubyteeAPI.extractCodeBlock(text)
      expect(code).toBe('move(10)')
    })

    test('should extract first ruby code block when multiple exist', () => {
      const text = '```ruby\nfirst\n```\nand\n```ruby\nsecond\n```'
      const code = RubyteeAPI.extractCodeBlock(text)
      expect(code).toBe('first')
    })

    test('should return null when no code block exists', () => {
      const text = 'No code here, just text'
      const code = RubyteeAPI.extractCodeBlock(text)
      expect(code).toBeNull()
    })

    test('should handle code block without language specifier', () => {
      const text = '```\nmove(10)\n```'
      const code = RubyteeAPI.extractCodeBlock(text)
      expect(code).toBe('move(10)')
    })

    test('should trim whitespace from extracted code', () => {
      const text = '```ruby\n  move(10)  \n```'
      const code = RubyteeAPI.extractCodeBlock(text)
      expect(code).toBe('move(10)')
    })
  })

  describe('clearHistory', () => {
    test('should clear chat history', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ text: 'ok', outputTokens: 5 }),
      })

      await rubyteeApi.sendMessage('test', {})
      expect(rubyteeApi.history).toHaveLength(2)

      rubyteeApi.clearHistory()
      expect(rubyteeApi.history).toHaveLength(0)
    })
  })
})
