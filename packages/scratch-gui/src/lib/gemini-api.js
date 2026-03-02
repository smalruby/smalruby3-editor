/* eslint-disable no-console */
/**
 * Gemini API Client
 *
 * Communicates with Google Gemini API using the OAuth 2.0 access token
 * from GoogleDriveAPI (shared authentication).
 * Each user's own Google account quota is used for Gemini API calls.
 *
 * API: POST https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent
 * Auth: Bearer token from Google Identity Services (generative-language scope)
 */

import googleDriveAPI from './google-drive-api';
import {buildSystemInstruction} from './gemini-context';

const GEMINI_MODEL = 'gemini-3-flash-preview';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * GeminiAPI class
 * Manages chat history and communication with the Gemini API
 */
class GeminiAPI {
    constructor () {
        this.history = [];
        this.modelName = GEMINI_MODEL;
        this._abortController = null;
    }

    /**
     * Send a message to Gemini and return the response text.
     * Supports cancellation via an AbortController stored in this._abortController.
     * @param {string} userMessage - The user's message
     * @param {object} stateContext - Current vm/sprite/stage state to include as context
     * @param {object} stateContext.sprite - Current sprite state
     * @param {object} stateContext.stage - Stage state
     * @param {object} stateContext.vm - VM state (extensions)
     * @returns {Promise<string>} The response text from Gemini
     */
    async sendMessage (userMessage, stateContext) {
        // Abort any in-flight request before starting a new one
        this.cancelRequest();

        // Create a new AbortController for this request
        this._abortController = new AbortController();
        const {signal} = this._abortController;

        // Ensure we have a valid access token
        await googleDriveAPI.initialize();
        const accessToken = await googleDriveAPI.requestAccessToken();

        // Build request body
        const newUserTurn = {
            role: 'user',
            parts: [{text: userMessage}]
        };

        const requestBody = {
            system_instruction: {
                parts: [{text: buildSystemInstruction(stateContext)}]
            },
            contents: [...this.history, newUserTurn],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 2048
            }
        };

        const url = `${GEMINI_API_BASE}/${this.modelName}:generateContent`;

        const startTime = Date.now();
        try {
            const response = await this._fetchWithRetry(url, accessToken, requestBody, signal);
            const data = await response.json();

            // Check if aborted after fetch completed
            if (signal.aborted) {
                throw new DOMException('Request was cancelled', 'AbortError');
            }

            const responseText = data.candidates[0].content.parts[0].text;
            const elapsedMs = Date.now() - startTime;
            const modelTurn = {
                role: 'model',
                parts: [{text: responseText}]
            };

            // Add both turns to history only on success
            this.history.push(newUserTurn);
            this.history.push(modelTurn);

            // Record to window.smalruby for debugging via browser console
            if (typeof window !== 'undefined') {
                window.smalruby = window.smalruby || {};
                window.smalruby.gemini = window.smalruby.gemini || {exchanges: []};
                window.smalruby.gemini.exchanges.push({
                    userMessage,
                    responseText,
                    codeBlocks: GeminiAPI.extractAllCodeBlocks(responseText),
                    elapsedMs,
                    timestamp: new Date().toISOString()
                });
                window.smalruby.gemini.lastElapsedMs = elapsedMs;
            }

            this._abortController = null;
            return responseText;
        } catch (error) {
            this._abortController = null;
            if (error.name === 'AbortError') {
                throw error;
            }
            console.error('[GeminiAPI] Failed to send message:', error);
            throw error;
        }
    }

    /**
     * Cancel the current in-flight request if any.
     */
    cancelRequest () {
        if (this._abortController) {
            this._abortController.abort();
            this._abortController = null;
        }
    }

    /**
     * Perform fetch with automatic retry on 401 (token expired)
     * @param {string} url - API endpoint URL
     * @param {string} accessToken - OAuth access token
     * @param {object} body - Request body
     * @param {AbortSignal} signal - AbortSignal for cancellation
     * @returns {Promise<Response>} Fetch response
     */
    async _fetchWithRetry (url, accessToken, body, signal) {
        const doFetch = token => fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(body),
            signal
        });

        let response = await doFetch(accessToken);

        if (!response.ok && response.status === 401) {
            // Token expired - request a new one and retry
            console.warn('[GeminiAPI] 401 received, requesting new access token...');
            const newToken = await googleDriveAPI.requestAccessToken();
            response = await doFetch(newToken);
        }

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
                `Gemini API error ${response.status}: ${errorText}`
            );
        }

        return response;
    }

    /**
     * Clear the chat history
     */
    clearHistory () {
        this.history = [];
    }

    /**
     * Extract a Ruby code block from Gemini's markdown response (first match only)
     * @param {string} text - Response text from Gemini
     * @returns {string|null} Extracted code or null if not found
     */
    static extractCodeBlock (text) {
        const blocks = GeminiAPI.extractAllCodeBlocks(text);
        return blocks.length > 0 ? blocks[0] : null;
    }

    /**
     * Extract all Ruby code blocks from Gemini's markdown response
     * @param {string} text - Response text from Gemini
     * @returns {string[]} Array of extracted code blocks (may be empty)
     */
    static extractAllCodeBlocks (text) {
        const blocks = [];
        // Match ```ruby ... ``` or ``` ... ``` (global)
        const pattern = /```(?:ruby)?[ \t]*\r?\n([\s\S]*?)```/g;
        let match = pattern.exec(text);
        while (match !== null) {
            const code = match[1].trim();
            if (code) {
                blocks.push(code);
            }
            match = pattern.exec(text);
        }
        return blocks;
    }
}

export default GeminiAPI;
