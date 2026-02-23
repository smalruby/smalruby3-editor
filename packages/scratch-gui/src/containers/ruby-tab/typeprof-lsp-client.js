/**
 * TypeProf LSP Client for Smalruby
 *
 * Manages the lifecycle of the TypeProf Web Worker and the monaco.lsp client.
 * Provides type-based completions alongside the existing snippet completions.
 *
 * Architecture:
 *   Main Thread (Monaco Editor)
 *     ↕ postMessage (JSON-RPC / LSP)
 *   Web Worker (typeprof-worker.js)
 *     └─ Ruby VM (ruby.wasm)
 *         └─ TypeProf::LSP::Server (Fiber)
 *
 * Usage:
 *   const client = new TypeProfLspClient(monaco, 'smalruby');
 *   await client.start('/static/ruby.wasm');
 *   // ... later ...
 *   client.dispose();
 */
class TypeProfLspClient {
    /**
     * @param {object} monaco - The monaco editor instance.
     * @param {string} languageId - The Monaco language ID (e.g. 'smalruby').
     */
    constructor (monaco, languageId) {
        this._monaco = monaco;
        this._languageId = languageId;
        this._worker = null;
        this._lspClient = null;
        this._state = 'idle'; // 'idle' | 'loading' | 'ready' | 'error' | 'disposed'
        this._onStateChange = null;
    }

    /**
     * Set a callback for state changes.
     * @param {Function} callback - Called with (state) when state changes.
     */
    onStateChange (callback) {
        this._onStateChange = callback;
    }

    /**
     * @returns {string} Current state.
     */
    get state () {
        return this._state;
    }

    /**
     * Start the TypeProf LSP worker and connect to Monaco.
     * @param {string} wasmUrl - URL to the ruby.wasm binary.
     * @returns {Promise<void>} Resolves when the worker is ready.
     */
    async start (wasmUrl) {
        if (this._state !== 'idle') {
            return;
        }
        this._setState('loading');

        try {
            this._worker = await this._createWorker(wasmUrl);
            this._connectToMonaco();
            this._setState('ready');
        } catch (e) {
            this._setState('error');
            throw e;
        }
    }

    /**
     * Notify the LSP server of a file change (textDocument/didChange).
     * Call this whenever the editor content changes.
     * @param {string} uri - The document URI (e.g. 'inmemory://workspace/main.rb').
     * @param {string} content - The new file content.
     * @param {number} version - Monotonically increasing document version.
     */
    notifyFileChange (uri, content, version) {
        if (this._state !== 'ready' || !this._worker) {
            return;
        }
        // Send LSP textDocument/didChange notification
        this._worker.postMessage({
            jsonrpc: '2.0',
            method: 'textDocument/didChange',
            params: {
                textDocument: {uri, version},
                contentChanges: [{text: content}]
            }
        });
    }

    /**
     * Dispose the LSP client and terminate the worker.
     */
    dispose () {
        if (this._state === 'disposed') {
            return;
        }
        this._setState('disposed');
        if (this._lspClient) {
            try {
                this._lspClient.dispose();
            } catch (_) {
                // Ignore errors during cleanup
            }
            this._lspClient = null;
        }
        if (this._worker) {
            this._worker.terminate();
            this._worker = null;
        }
    }

    /**
     * Spawn the Web Worker and wait for it to be ready.
     * @param {string} wasmUrl - URL to the ruby.wasm binary.
     * @returns {Promise<Worker>} The initialized worker.
     */
    _createWorker (wasmUrl) {
        return new Promise((resolve, reject) => {
            const worker = new Worker(
                new URL('./typeprof-worker.js', import.meta.url)
            );

            const cleanup = () => {
                worker.removeEventListener('message', onMessage);
                worker.removeEventListener('error', onError);
            };

            const onMessage = event => {
                const msg = event.data;
                if (!msg || typeof msg !== 'object') {
                    return; // LSP response strings are handled after ready
                }
                if (msg.type === 'ready') {
                    cleanup();
                    resolve(worker);
                } else if (msg.type === 'error') {
                    cleanup();
                    reject(new Error(msg.message || 'TypeProf worker initialization failed'));
                }
                // 'progress' messages are informational only
            };

            const onError = err => {
                cleanup();
                reject(err);
            };

            worker.addEventListener('message', onMessage);
            worker.addEventListener('error', onError);

            worker.postMessage({type: 'initialize', payload: {wasmUrl}});
        });
    }

    /**
     * Connect the initialized worker to Monaco via monaco.lsp API.
     */
    _connectToMonaco () {
        const monaco = this._monaco;
        if (!monaco.lsp) {
            throw new Error(
                'monaco.lsp is not available. ' +
                'Requires Monaco Editor >= 0.55.1 with LSP support.'
            );
        }

        const transport = monaco.lsp.createTransportToWorker(this._worker);
        this._lspClient = new monaco.lsp.MonacoLspClient(transport);
    }

    /**
     * @param {string} newState - New state string.
     */
    _setState (newState) {
        this._state = newState;
        if (this._onStateChange) {
            this._onStateChange(newState);
        }
    }
}

export default TypeProfLspClient;
