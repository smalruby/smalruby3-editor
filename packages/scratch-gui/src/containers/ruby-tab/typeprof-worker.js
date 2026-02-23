/**
 * TypeProf LSP Web Worker for Smalruby
 *
 * Runs TypeProf::LSP::Server inside Ruby WASM (via {@ruby/wasm-wasi}).
 * Communicates with the main thread via JSON-RPC 2.0 (LSP protocol) messages.
 *
 * Message protocol (main to worker):
 *   { type: "initialize", payload: { wasmUrl: string } }
 *   (after ready) LSP request/notification object
 *
 * Message protocol (worker to main):
 *   { type: "progress", step: string, event: "started" | "finished" }
 *   { type: "ready" }
 *   { type: "error", message: string }
 *   (after ready) LSP response/notification object
 *
 * Based on https://github.com/mame/typeprof.wasm
 */

// eslint-disable-next-line import/no-unresolved
import {DefaultRubyVM} from '@ruby/wasm-wasi/dist/browser';

/**
 * Report progress to the main thread for each initialization step.
 * @param {string} stepName - Step identifier.
 * @param {Function} body - Function returning a value or Promise.
 * @returns {Promise<*>} Result of body().
 */
const step = (stepName, body) => {
    postMessage({type: 'progress', step: stepName, event: 'started'});
    return Promise.resolve(body()).then(ret => {
        postMessage({type: 'progress', step: stepName, event: 'finished'});
        return ret;
    });
};

// The TypeProf bootstrap Ruby script is injected by webpack's DefinePlugin at build time.
// eslint-disable-next-line no-undef
const bootstrapCode = __TYPEPROF_BOOTSTRAP_CODE__;

let server = null;

/**
 * Initialize the Ruby WASM VM and TypeProf LSP server.
 * @param {string} wasmUrl - URL to the ruby.wasm binary.
 * @returns {Promise<void>}
 */
const initialize = async wasmUrl => {
    const wasmModule = await step('load-wasm', () =>
        fetch(wasmUrl).then(response => {
            if (!response.ok) {
                throw new Error(
                    `Failed to fetch Ruby WASM: ${response.status} ${response.statusText}`
                );
            }
            return WebAssembly.compileStreaming(response);
        })
    );

    const {vm} = await step('init-vm', () => DefaultRubyVM(wasmModule));

    server = await step('load-typeprof', () => vm.evalAsync(bootstrapCode));

    await step('setup-typeprof', () => server.callAsync('setup'));

    await step('start-typeprof', () =>
        server.callAsync('start', vm.wrap(str => postMessage(JSON.parse(str))))
    );

    postMessage({type: 'ready'});

    // After initialization, route incoming LSP messages to the TypeProf server
    onmessage = async event => {
        try {
            await server.callAsync('add_msg', vm.wrap(JSON.stringify(event.data)));
        } catch (e) {
            self.reportError(e);
        }
    };
};

onmessage = async event => {
    const {type, payload} = event.data;
    if (type === 'initialize') {
        try {
            await initialize(payload.wasmUrl);
        } catch (e) {
            postMessage({type: 'error', message: String(e)});
        }
    }
};
