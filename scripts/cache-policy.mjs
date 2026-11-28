// Cache-Control rules for the S3 + CloudFront deploys (production and branch preview, #2510).
//
// Both deploys in .github/workflows/ci-cd.yml split the build by this module, so the rule lives in
// one place (docs/hosting/README.md "キャッシュ"):
//
// - immutable:  the path changes when the content changes. A hex hash in the file name
//               (`gui.<hash>.js`, `static/assets/<name>.<hash>.png`), the monaco-editor version in
//               the directory (`static/monaco/<version>/`, webpack.config.js MONACO_VS_DEST) and the
//               costume assetId as the name (`static/smalruby-assets/<md5>.<ext>`). The assetId is the
//               md5 of the Scratch CDN copy, which can differ from the local file, so a new image must
//               get a new assetId (name) rather than replace the file in place.
// - short:      scratch-blocks icons (`static/blocks-media/`). The names have no version or hash and
//               the content can change with scratch-blocks, so a day plus stale-while-revalidate.
//               Renaming them at build time would mean changing upstream files that reference them.
// - revalidate: everything else (index.html, gui.js of the preview, service-worker.js, version.json,
//               .well-known, auth-redirect.*). The browser re-checks on every load, so a deploy
//               reaches everyone at once.
//
// CLI:
//   node scripts/cache-policy.mjs split <src> <out>
//       copies <src> into <out>/<class>/ and prints `<class>\t<Cache-Control>` per class.
//   node scripts/cache-policy.mjs header <relative path>
//       prints the Cache-Control for one path.
import {copyFile, mkdir, readdir, stat, utimes} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {GUI_JS_PATTERN} from './precompress-assets.mjs';

/**
 * Cache-Control per class. The key order is the upload order of ci-cd.yml: long-lived first and
 * `revalidate` (index.html and the other entries) last, so an entry never points at a file that
 * is not uploaded yet.
 */
export const CACHE_CONTROL = {
    immutable: 'public, max-age=31536000, immutable',
    short: 'public, max-age=86400, stale-while-revalidate=604800',
    revalidate: 'max-age=0, s-maxage=60',
};

/** A hex hash between dots in the file name (same rule as Workbox's dontCacheBustURLsMatching). */
const HASHED_NAME = /\.[0-9a-f]{8,}\./;

/** monaco-editor copied under its version (`static/monaco/0.57.0/vs/...`). */
const MONACO_VERSIONED = /^static\/monaco\/\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?\//;

/** Smalruby costume / sprite assets named by their assetId (an md5). */
const SMALRUBY_ASSET = /^static\/smalruby-assets\/[0-9a-f]{32}\.[0-9A-Za-z]+$/;

/** scratch-blocks media (default and high-contrast). */
const BLOCKS_MEDIA = /^static\/blocks-media\//;

/** Suffixes of the pre-compressed gui JS (precompress-assets.mjs), uploaded with Content-Encoding. */
const PRECOMPRESSED_SUFFIX = /\.(?:br|gz)$/;

/** Files that are never uploaded by the split. */
const EXCLUDED_NAMES = new Set(['.DS_Store', '.nojekyll', 'CNAME']);

/**
 * Cache class of a file.
 * @param {string} rel - Path relative to the build directory, `/`-separated.
 * @returns {'immutable'|'short'|'revalidate'} The class (a key of CACHE_CONTROL).
 */
export const cacheClassFor = rel => {
    if (HASHED_NAME.test(rel) || MONACO_VERSIONED.test(rel) || SMALRUBY_ASSET.test(rel)) {
        return 'immutable';
    }
    if (BLOCKS_MEDIA.test(rel)) return 'short';
    return 'revalidate';
};

/**
 * Whether the split leaves a file out (OS junk, GitHub Pages files, the pre-compressed gui JS).
 * @param {string} rel - Path relative to the build directory, `/`-separated.
 * @returns {boolean} True when the file is not copied.
 */
export const isExcluded = rel => EXCLUDED_NAMES.has(path.posix.basename(rel)) ||
    (PRECOMPRESSED_SUFFIX.test(rel) && GUI_JS_PATTERN.test(rel.replace(PRECOMPRESSED_SUFFIX, '')));

/**
 * List every file under a directory, dot files included.
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
 * Copy a build into one directory per cache class.
 * @param {string} src - Build output (`packages/scratch-gui/dist`, `build`, `packages/admin/build`).
 * @param {string} out - Directory to write `<class>/` into. Every class directory is created.
 * @returns {Promise<{[cls: string]: number}>} Number of files per class.
 */
export const split = async (src, out) => {
    const counts = Object.fromEntries(Object.keys(CACHE_CONTROL).map(name => [name, 0]));
    for (const name of Object.keys(CACHE_CONTROL)) {
        await mkdir(path.join(out, name), {recursive: true});
    }
    for (const rel of await listFiles(src)) {
        if (isExcluded(rel)) continue;
        const cls = cacheClassFor(rel);
        const dest = path.join(out, cls, rel);
        await mkdir(path.dirname(dest), {recursive: true});
        await copyFile(path.join(src, rel), dest);
        // Keep the modification time like `cp -p`: aws s3 sync compares it with the object.
        const {atime, mtime} = await stat(path.join(src, rel));
        await utimes(dest, atime, mtime);
        counts[cls] += 1;
    }
    return counts;
};

const main = async argv => {
    const [command, ...args] = argv.slice(2);
    if (command === 'split' && args.length === 2) {
        const counts = await split(args[0], args[1]);
        for (const [name, count] of Object.entries(counts)) {
            console.error(`${name}: ${count} files (${CACHE_CONTROL[name]})`);
            console.log(`${name}\t${CACHE_CONTROL[name]}`);
        }
        return;
    }
    if (command === 'header' && args.length === 1) {
        console.log(CACHE_CONTROL[cacheClassFor(args[0])]);
        return;
    }
    console.error(
        'usage: node scripts/cache-policy.mjs split <src> <out>\n' +
            '       node scripts/cache-policy.mjs header <relative path>',
    );
    process.exit(2);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main(process.argv).catch(error => {
        console.error(error);
        process.exit(1);
    });
}
