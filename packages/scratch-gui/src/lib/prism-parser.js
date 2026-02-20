let prismInstance = null;

/**
 * Load the prism wasm module and return a parse function.
 * @returns {Promise<object>} An object with a parse function.
 */
export const loadPrism = async () => {
    if (prismInstance) {
        return prismInstance;
    }

    if (typeof process !== 'undefined' && process.versions && process.versions.node) {
        // Node.js environment (for tests)
        const {WASI: NodeWASI} = require('wasi');
        const fs = require('fs').promises;
        const path = require('path');
        const parsePrismModule = require('@ruby/prism/src/parsePrism.js');
        const parsePrismFn = parsePrismModule.parsePrism ||
            (parsePrismModule.default && parsePrismModule.default.parsePrism) ||
            parsePrismModule.default;

        if (typeof parsePrismFn !== 'function') {
            throw new Error(`parsePrism is not a function. Module: ${JSON.stringify(parsePrismModule)}`);
        }

        // Locate prism.wasm in node_modules
        // When running in Jest, process.cwd() is /app/packages/scratch-gui.
        const prismWasmPath = path.resolve(process.cwd(), '../../node_modules/@ruby/prism/src/prism.wasm');
        const wasmBuffer = await fs.readFile(prismWasmPath);
        const wasm = await WebAssembly.compile(wasmBuffer);
        const wasi = new NodeWASI({version: 'preview1'});
        const instance = await WebAssembly.instantiate(wasm, wasi.getImportObject());
        wasi.initialize(instance);
        prismInstance = {
            parse: (source, options = {}) => parsePrismFn(instance.exports, source, options)
        };
        return prismInstance;
    }

    // Browser environment
    const {WASI} = await import('@bjorn3/browser_wasi_shim');
    const {parsePrism} = await import('@ruby/prism/src/parsePrism.js');
    const prismWasmUrl = (await import('@ruby/prism/src/prism.wasm')).default;
    const wasm = await WebAssembly.compileStreaming(fetch(prismWasmUrl));
    const wasi = new WASI([], [], []);

    const instance = await WebAssembly.instantiate(wasm, {wasi_snapshot_preview1: wasi.wasiImport});
    wasi.initialize(instance);

    prismInstance = {
        parse: (source, options = {}) => parsePrism(instance.exports, source, options)
    };

    return prismInstance;
};
