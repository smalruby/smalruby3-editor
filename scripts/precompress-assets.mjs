// Pre-compress the editor's gui JS for S3 + CloudFront (#2198, #2199).
//
// CloudFront only compresses files between 1,000 and 10,000,000 bytes
// (https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/ServingCompressedFiles.html),
// so the gui JS (about 25 MB) would be sent uncompressed. CI writes `<name>.br` (brotli quality 11)
// and `<name>.gz` (gzip -9) next to it, and uploads them with `Content-Encoding`. A CloudFront
// Function (#2200) then rewrites the URI by `Accept-Encoding`. Until that function exists nobody
// requests the `.br` / `.gz`, so writing them changes nothing.
//
// Only the gui JS at the top of the directory is compressed: `gui.js` (preview build) and
// `gui.<hash>.js` (dist). Everything else is under 10 MB and CloudFront compresses it. brotli q11
// takes about 27 s on the 25.6 MB gui.js, so it is not run on every file. Other files over
// 10,000,000 bytes get a `::warning::` instead, since neither CloudFront nor the function would
// compress them. Source maps (`.map`) are skipped: only DevTools loads them.
//
// CLI: node scripts/precompress-assets.mjs <dir>   -> prints the written files, one per line
import {readdir, readFile, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';
import zlib from 'node:zlib';

const brotliCompress = promisify(zlib.brotliCompress);
const gzip = promisify(zlib.gzip);

/** CloudFront compresses files up to this size (bytes). */
export const CLOUDFRONT_MAX_COMPRESS_BYTES = 10000000;

/** `gui.js` or `gui.<hex hash>.js`. */
export const GUI_JS_PATTERN = /^gui(?:\.[0-9a-f]{8,})?\.js$/;

/** Suffixes of the pre-compressed files and their `Content-Encoding`. */
export const ENCODINGS = [
    {suffix: '.br', encoding: 'br'},
    {suffix: '.gz', encoding: 'gzip'},
];

/**
 * Whether a file name (relative to the directory, `/`-separated) is a gui JS to pre-compress.
 * @param {string} rel - Path relative to the directory.
 * @returns {boolean} True for `gui.js` / `gui.<hash>.js` at the top level.
 */
export const isTarget = rel => !rel.includes('/') && GUI_JS_PATTERN.test(rel);

/**
 * Whether a file should be reported: over the CloudFront limit and not compressed by us.
 * @param {string} rel - Path relative to the directory.
 * @param {number} size - File size in bytes.
 * @returns {boolean} True when CloudFront would send it uncompressed.
 */
export const isOversized = (rel, size) =>
    size > CLOUDFRONT_MAX_COMPRESS_BYTES &&
    !isTarget(rel) &&
    !rel.endsWith('.map') &&
    !ENCODINGS.some(({suffix}) => rel.endsWith(suffix));

/**
 * List every file under a directory.
 * @param {string} dir - Directory to walk.
 * @param {string} [prefix] - Relative path of `dir` (internal).
 * @returns {Promise<string[]>} Paths relative to the first `dir`, `/`-separated.
 */
const listFiles = async (dir, prefix = '') => {
    const entries = await readdir(path.join(dir, prefix), {withFileTypes: true});
    const files = [];
    for (const entry of entries) {
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
            files.push(...(await listFiles(dir, rel)));
        } else if (entry.isFile()) {
            files.push(rel);
        }
    }
    return files;
};

/**
 * Compress a buffer with brotli quality 11 (24-bit window, like the `brotli` CLI).
 * @param {Buffer} data - Input.
 * @returns {Promise<Buffer>} brotli stream.
 */
export const toBrotli = data =>
    brotliCompress(data, {
        params: {
            [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
            [zlib.constants.BROTLI_PARAM_QUALITY]: zlib.constants.BROTLI_MAX_QUALITY,
            [zlib.constants.BROTLI_PARAM_LGWIN]: zlib.constants.BROTLI_MAX_WINDOW_BITS,
            [zlib.constants.BROTLI_PARAM_SIZE_HINT]: data.length,
        },
    });

/**
 * Compress a buffer with gzip -9.
 * @param {Buffer} data - Input.
 * @returns {Promise<Buffer>} gzip stream.
 */
export const toGzip = data => gzip(data, {level: zlib.constants.Z_BEST_COMPRESSION});

/**
 * Write `<name>.br` and `<name>.gz` next to every gui JS in `dir`, and check them by decompressing.
 * @param {string} dir - Build output (`packages/scratch-gui/dist` or `build`).
 * @returns {Promise<{written: string[], oversized: {rel: string, size: number}[]}>} Files written
 *     (relative to `dir`) and files CloudFront will not compress.
 */
export const precompress = async dir => {
    const files = await listFiles(dir);
    const written = [];
    const oversized = [];
    for (const rel of files) {
        const {size} = await stat(path.join(dir, rel));
        if (isOversized(rel, size)) oversized.push({rel, size});
    }
    for (const rel of files.filter(isTarget).sort()) {
        const src = path.join(dir, rel);
        const data = await readFile(src);
        const [br, gz] = await Promise.all([toBrotli(data), toGzip(data)]);
        if (!zlib.brotliDecompressSync(br).equals(data) || !zlib.gunzipSync(gz).equals(data)) {
            throw new Error(`${rel}: the compressed file does not decompress to the original`);
        }
        await writeFile(`${src}.br`, br);
        await writeFile(`${src}.gz`, gz);
        written.push(`${rel}.br`, `${rel}.gz`);
    }
    return {written, oversized};
};

const main = async argv => {
    const dir = argv[2];
    if (!dir) {
        console.error('usage: node scripts/precompress-assets.mjs <dir>');
        process.exit(2);
    }
    const {written, oversized} = await precompress(dir);
    if (written.length === 0) {
        console.error(`::error::${dir} に gui.js / gui.<hash>.js がありません。`);
        process.exit(1);
    }
    for (const {rel, size} of oversized) {
        console.error(
            `::warning::${dir}/${rel} は ${size} バイトで 10,000,000 バイトを超えています。` +
                'CloudFront はこれを圧縮せず、事前圧縮の対象（gui の JS）でもないため、無圧縮で配られます（#2198）。',
        );
    }
    for (const rel of written) {
        const {size} = await stat(path.join(dir, rel));
        console.error(`${rel}: ${size} bytes`);
        console.log(rel);
    }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main(process.argv).catch(error => {
        console.error(error);
        process.exit(1);
    });
}
