/* eslint-disable no-console */
/**
 * Rubytee Relay API Client
 *
 * Communicates with smalruby-rubytee-relay (AWS Lambda) instead of calling
 * the AI API directly. The relay manages the API key, system prompt,
 * input validation, and rate limiting.
 *
 * API: POST <RUBYTEE_RELAY_ENDPOINT>/generate
 */

const RUBYTEE_RELAY_ENDPOINT = process.env.RUBYTEE_RELAY_ENDPOINT || ''

/**
 * Error thrown when the relay returns 429 (rate limit exceeded)
 */
class RateLimitError extends Error {
  constructor(resetAfterSeconds) {
    super('RATE_LIMIT_EXCEEDED')
    this.name = 'RateLimitError'
    this.resetAfterSeconds = resetAfterSeconds
  }
}

/**
 * RubyteeAPI class
 * Manages chat history and communication with the smalruby-rubytee-relay
 */
class RubyteeAPI {
  constructor() {
    this.history = []
    this._abortController = null
  }

  /**
   * Send a message to the Rubytee relay and return the response text.
   * @param {string} userMessage - The user's message
   * @param {object} stateContext - Current vm/sprite/stage state
   * @param {object} stateContext.sprite - Current sprite state
   * @param {object} stateContext.stage - Stage state
   * @param {object} stateContext.vm - VM state (extensions)
   * @returns {Promise<string>} The response text from the AI
   */
  async sendMessage(userMessage, stateContext) {
    // Abort any in-flight request before starting a new one
    this.cancelRequest()
    this._abortController = new AbortController()
    const { signal } = this._abortController

    const newUserTurn = {
      role: 'user',
      parts: [{ text: userMessage }],
    }

    const requestBody = {
      userMessage,
      history: this.history,
      stateContext: stateContext || {},
    }

    const url = `${RUBYTEE_RELAY_ENDPOINT}/generate`
    const startTime = Date.now()

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal,
      })

      // Handle rate limit
      if (response.status === 429) {
        const data = await response.json()
        throw new RateLimitError(data.resetAfterSeconds)
      }

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Rubytee relay error ${response.status}: ${errorText}`)
      }

      // Check if aborted after fetch completed
      if (signal.aborted) {
        throw new DOMException('Request was cancelled', 'AbortError')
      }

      const data = await response.json()
      const responseText = data.text
      const outputTokens = data.outputTokens
      const elapsedMs = Date.now() - startTime

      const modelTurn = {
        role: 'model',
        parts: [{ text: responseText }],
      }

      // Add both turns to history only on success
      this.history.push(newUserTurn)
      this.history.push(modelTurn)

      // Record to window.smalruby for debugging via browser console
      if (typeof window !== 'undefined') {
        window.smalruby = window.smalruby || {}
        window.smalruby.rubytee = window.smalruby.rubytee || { exchanges: [] }
        window.smalruby.rubytee.exchanges.push({
          userMessage,
          responseText,
          codeBlocks: RubyteeAPI.extractAllCodeBlocks(responseText),
          elapsedMs,
          outputTokens,
          timestamp: new Date().toISOString(),
        })
        window.smalruby.rubytee.lastElapsedMs = elapsedMs
      }

      this._abortController = null
      return responseText
    } catch (error) {
      this._abortController = null
      if (error.name === 'AbortError' || error.name === 'RateLimitError') {
        throw error
      }
      console.error('[RubyteeAPI] Failed to send message:', error)
      throw error
    }
  }

  /**
   * Cancel the current in-flight request if any.
   */
  cancelRequest() {
    if (this._abortController) {
      this._abortController.abort()
      this._abortController = null
    }
  }

  /**
   * Clear the chat history
   */
  clearHistory() {
    this.history = []
  }

  /**
   * Extract a Ruby code block from the AI's markdown response (first match only).
   * @param {string} text - Response text from the AI
   * @returns {string|null} Extracted code or null if not found
   */
  static extractCodeBlock(text) {
    const blocks = RubyteeAPI.extractAllCodeBlocks(text)
    return blocks.length > 0 ? blocks[0] : null
  }

  /**
   * Extract all Ruby code blocks from the AI's markdown response.
   * @param {string} text - Response text from the AI
   * @returns {string[]} Array of extracted code blocks (may be empty)
   */
  static extractAllCodeBlocks(text) {
    const blocks = []
    // Match ```ruby ... ``` or ``` ... ``` (global)
    const pattern = /```(?:ruby)?[ \t]*\r?\n([\s\S]*?)```/g
    let match = pattern.exec(text)
    while (match !== null) {
      const code = match[1].trim()
      if (code) {
        blocks.push(code)
      }
      match = pattern.exec(text)
    }
    return blocks
  }
}

export { RateLimitError }
export default RubyteeAPI
