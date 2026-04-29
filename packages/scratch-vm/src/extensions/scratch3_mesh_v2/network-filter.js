/* global process */
const log = require('../../util/log');
const debugLogger = require('../../util/debug-logger');
const debug = debugLogger(process.env.DEBUG);
const { GRAPHQL_ENDPOINT } = require('./mesh-client');

/**
 * GraphQL error types that indicate the connection is no longer valid.
 * These are defined in infra/mesh-v2/js/functions/*.js
 */
const DISCONNECT_ERROR_TYPES = new Set([
    'GroupNotFound', // Group doesn't exist, expired, or heartbeat expired
    'Unauthorized', // Not authorized for this operation
    'NodeNotFound', // Node doesn't exist
]);

/**
 * Methods related to network error classification, network filter (proxy)
 * detection, simulated test mode, and WebSocket availability probing.
 *
 * Mixed into MeshV2Service.prototype. All `this` references resolve to the
 * MeshV2Service instance.
 */
const NetworkFilterMixin = {
    /**
     * Check if the error indicates the group/node is no longer valid.
     * Uses errorType from GraphQL response for robust error detection.
     * @param {Error} error - The error to check.
     * @returns {string|null} The error reason if should disconnect, null otherwise.
     */
    shouldDisconnectOnError(error) {
        if (!error) return null;

        // Primary check: GraphQL errorType (most reliable)
        if (error.graphQLErrors && error.graphQLErrors.length > 0) {
            const errorType = error.graphQLErrors[0].errorType;
            if (DISCONNECT_ERROR_TYPES.has(errorType)) {
                debug(() => `Mesh V2: Disconnecting due to errorType: ${errorType}`);
                return errorType;
            }
        }

        // Fallback: check message string (backward compatibility)
        // This ensures old behavior is preserved if errorType is missing
        if (error.message) {
            const message = error.message.toLowerCase();
            if (
                message.includes('not found') ||
                message.includes('expired') ||
                message.includes('unauthorized')
            ) {
                log.warn('Mesh V2: Disconnecting based on error message (fallback). Consider checking errorType.');
                return 'expired';
            }
        }

        return null;
    },

    /**
     * Check if the error is caused by network filtering (503 Service Unavailable).
     * Network filters (e.g., i-Filter proxy) block requests before reaching AppSync
     * and return HTTP 503. The error payload content is undefined and depends on
     * the proxy implementation, so we can ONLY rely on the HTTP status code.
     * @param {Error} error - The error to check.
     * @returns {boolean} True if the error is caused by network filtering.
     */
    isNetworkFilterError(error) {
        if (!error) {
            debug(() => 'Mesh V2: isNetworkFilterError called with null/undefined error');
            return false;
        }

        debug(
            () =>
                `Mesh V2: Checking if error is network filter error: ` +
                `hasNetworkError=${!!error.networkError}, ` +
                `statusCode=${error.networkError?.statusCode}, ` +
                `message=${error.message}`,
        );

        // Primary check: HTTP status code 503 from network error
        // This is the ONLY reliable indicator when blocked by proxy (e.g., i-Filter)
        if (error.networkError && error.networkError.statusCode === 503) {
            debug(() => 'Mesh V2: Detected network filter error (HTTP 503)');
            return true;
        }

        // Fallback: Check for 503 in error message (less reliable)
        // Some GraphQL clients may include status code in message
        if (error.message && error.message.includes('503')) {
            debug(() => 'Mesh V2: Detected network filter error (503 in message)');
            return true;
        }

        debug(() => 'Mesh V2: Error is NOT a network filter error');
        return false;
    },

    /**
     * Create a simulated HTTP 503 error for testing network filter detection.
     * This simulates the error structure returned by i-Filter or similar proxies.
     * @returns {Error} Error object with HTTP 503 structure.
     * @private
     */
    _createSimulated503Error() {
        const error = new Error('Network error: Service Unavailable');
        error.networkError = {
            statusCode: 503,
            bodyText: 'Simulated network filter block (MESH_NETWORK_FILTER=true)',
        };
        error.graphQLErrors = [];
        return error;
    },

    /**
     * Check if network filter test mode is enabled and throw 503 error if so.
     * @throws {Error} HTTP 503 error if MESH_NETWORK_FILTER=true.
     * @private
     */
    _checkSimulateNetworkFilter() {
        if (this.simulateNetworkFilter) {
            const error = this._createSimulated503Error();
            this.lastError = error;
            throw error;
        }
    },

    /**
     * Test if WebSocket connection is possible in the current environment.
     * @returns {Promise<boolean>} True if WebSocket is available.
     */
    testWebSocket() {
        return new Promise(resolve => {
            try {
                // Derived from https://xxx.appsync-api.region.amazonaws.com/graphql
                // to wss://xxx.appsync-realtime-api.region.amazonaws.com/graphql
                // or for custom domains, to wss://api.example.com/graphql/realtime
                let wsUrl = GRAPHQL_ENDPOINT.replace('https://', 'wss://');
                if (wsUrl.includes('appsync-api')) {
                    wsUrl = wsUrl.replace('appsync-api', 'appsync-realtime-api');
                } else {
                    wsUrl = wsUrl.replace(/\/graphql$/, '/graphql/realtime');
                }

                const socket = new WebSocket(wsUrl, 'graphql-ws');
                const timeout = setTimeout(() => {
                    debug(() => 'Mesh V2: WebSocket test timed out');
                    socket.close();
                    resolve(false);
                }, 3000); // 3 seconds timeout for test

                socket.onopen = () => {
                    debug(() => 'Mesh V2: WebSocket test successful');
                    clearTimeout(timeout);
                    socket.close();
                    resolve(true);
                };

                socket.onerror = err => {
                    debug(() => `Mesh V2: WebSocket test failed: ${err}`);
                    clearTimeout(timeout);
                    resolve(false);
                };
            } catch (error) {
                debug(() => `Mesh V2: WebSocket not supported or failed to initialize: ${error}`);
                resolve(false);
            }
        });
    },
};

module.exports = { NetworkFilterMixin, DISCONNECT_ERROR_TYPES };
