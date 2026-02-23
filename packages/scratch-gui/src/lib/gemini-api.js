/* eslint-disable no-console */
/**
 * Gemini API Client
 *
 * Communicates with Google Gemini API using the OAuth 2.0 access token
 * from GoogleDriveAPI (shared authentication).
 *
 * API: POST https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent
 * Auth: Bearer token from Google Identity Services
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
    }

    /**
     * Send a message to Gemini and return the response text
     * @param {string} userMessage - The user's message
     * @param {object} stateContext - Current vm/sprite/stage state to include as context
     * @param {object} stateContext.sprite - Current sprite state
     * @param {object} stateContext.stage - Stage state
     * @param {object} stateContext.vm - VM state (extensions)
     * @returns {Promise<string>} The response text from Gemini
     */
    async sendMessage (userMessage, stateContext) {
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

        try {
            const response = await this._fetchWithRetry(url, accessToken, requestBody);
            const data = await response.json();

            const responseText = data.candidates[0].content.parts[0].text;
            const modelTurn = {
                role: 'model',
                parts: [{text: responseText}]
            };

            // Add both turns to history
            this.history.push(newUserTurn);
            this.history.push(modelTurn);

            return responseText;
        } catch (error) {
            console.error('[GeminiAPI] Failed to send message:', error);
            throw error;
        }
    }

    /**
     * Perform fetch with automatic retry on 401 (token expired)
     * @param {string} url - API endpoint URL
     * @param {string} accessToken - OAuth access token
     * @param {object} body - Request body
     * @returns {Promise<Response>} Fetch response
     */
    async _fetchWithRetry (url, accessToken, body) {
        const doFetch = token => fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(body)
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
     * Extract a Ruby code block from Gemini's markdown response
     * @param {string} text - Response text from Gemini
     * @returns {string|null} Extracted code or null if not found
     */
    static extractCodeBlock (text) {
        // Match ```ruby ... ``` or ``` ... ```
        const rubyMatch = text.match(/```ruby\n([\s\S]*?)```/);
        if (rubyMatch) {
            return rubyMatch[1].trim();
        }

        const genericMatch = text.match(/```\n([\s\S]*?)```/);
        if (genericMatch) {
            return genericMatch[1].trim();
        }

        return null;
    }
}

export default GeminiAPI;
