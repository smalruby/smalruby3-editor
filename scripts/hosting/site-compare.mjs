// Compare what two hosts serve for the same paths (EPIC #1931, step 8 / issue #2006).
//
// Before the apex of smalruby.app moves from GitHub Pages to CloudFront, both must serve the
// same build. This script asks both hosts for the same paths and compares the status code, a
// hash of the body and the Content-Type. On side B (the new CloudFront distribution) it also
// checks what the design asks for:
//   - Cache-Control: hashed files (`/\.[0-9a-f]{8,}\./`) are `immutable` for a year, every other
//     file is `max-age=0` (or `no-cache`), so browsers never keep an old index.html.
//   - Content-Type of files `aws s3 sync` may guess wrong: .wasm, .mjs, .hex, .json, ...
//   - A path that does not exist is 403 (S3 behind OAC hides the listing; GitHub Pages says 404).
//   - A path without an extension or a trailing `/` is a 301 to `<path>/`.
// It only reads (GET). It changes nothing.
//
// Paths come from: a fixed list, the precache list in `/service-worker.js` and the assets in
// `/index.html` (both read from side A), `--dist <dir>` (a build output) and `--paths-file`.
//
// CLI:
//   node scripts/hosting/site-compare.mjs --a https://smalruby.app --b https://dxxxx.cloudfront.net \
//     [--resolve-b <ip>] [--dist packages/scratch-gui/dist] [--paths-file paths.txt] \
//     [--no-precache] [--no-b-checks] [--limit N] [--concurrency 4] [--list] [--json]
//
// `--resolve-b <ip>` connects to that IP but keeps B's host name (like `curl --resolve`), so the
// script can check CloudFront as https://smalruby.app/ before the DNS points there.
//
// Exit code: 0 = no problems, 1 = problems, 2 = bad arguments / a host could not be reached.
import {createHash} from 'node:crypto';
import {readdirSync, readFileSync, statSync} from 'node:fs';
import https from 'node:https';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Paths that must be served whatever the build contains.
export const DEFAULT_PATHS = [
    '/',
    '/index.html',
    '/admin/',
    '/.well-known/microsoft-identity-association.json',
    '/auth-redirect.html',
    '/version.json',
    '/service-worker.js',
];

// Same as Workbox `dontCacheBustURLsMatching` and the S3 upload of the deploy job.
export const HASHED_FILE = /\.[0-9a-f]{8,}\./;

// Content-Types side B must send, by extension. Anything else is only compared with side A.
export const EXPECTED_TYPES = {
    '.html': ['text/html'],
    '.js': ['text/javascript', 'application/javascript'],
    '.mjs': ['text/javascript', 'application/javascript'],
    '.css': ['text/css'],
    '.json': ['application/json'],
    '.wasm': ['application/wasm'],
    // micro:bit firmware: anything that makes the browser download it, never text/html.
    '.hex': ['application/octet-stream', 'binary/octet-stream', 'text/plain', 'application/x-hex'],
    '.svg': ['image/svg+xml'],
    '.png': ['image/png'],
    '.webmanifest': ['application/manifest+json'],
};

/**
 * Make a path from a file name relative to the site root, percent-encoding what needs it.
 * @param {string} name - e.g. `static/a b.png`, `/x.js` or an already-encoded `%E3%81%82.png`.
 * @returns {string} A path starting with `/`.
 */
export const toPath = name => {
    let p = name.replace(/^\.?\//, '');
    try {
        p = decodeURI(p);
    } catch {
        // Not encoded (a lone `%`): encode as is.
    }
    return `/${encodeURI(p)}`;
};

/**
 * Read the precache list of a Workbox `GenerateSW` service worker.
 * @param {string} text - The service worker script.
 * @returns {string[]} Paths, including the Workbox runtime chunk.
 */
export const precachePaths = text => {
    const out = new Set();
    for (const m of text.matchAll(/["']?url["']?\s*:\s*["']([^"']+)["']/g)) out.add(toPath(m[1]));
    for (const m of text.matchAll(/define\(\[\s*["']\.\/(workbox-[0-9a-z]+)["']/g)) out.add(toPath(`${m[1]}.js`));
    return [...out].filter(p => !/^\/(https?:)?\/\//.test(p));
};

/**
 * Read the same-site assets an HTML page loads (`src` / `href`).
 * @param {string} html - The page.
 * @returns {string[]} Paths.
 */
export const htmlAssetPaths = html => {
    const out = new Set();
    for (const m of html.matchAll(/\b(?:src|href)\s*=\s*["']([^"'#?]+)[^"']*["']/gi)) {
        const url = m[1];
        if (/^([a-z]+:|\/\/|data:)/i.test(url) || url === '' || url === '/') continue;
        out.add(toPath(url));
    }
    return [...out];
};

/**
 * Turn a list of files of a build output into the paths to ask for.
 * A directory with an `index.html` is also asked as `<dir>/` (and `<dir>` for the 301 check).
 * @param {string[]} files - File names relative to the build root (`/` separated).
 * @returns {{paths: string[], directories: string[]}} Paths and directory paths (`/admin`).
 */
export const pathsFromFiles = files => {
    const paths = new Set();
    const directories = new Set();
    for (const f of files) {
        if (/(^|\/)\.DS_Store$/.test(f) || f === 'CNAME' || f === '.nojekyll') continue;
        paths.add(toPath(f));
        const m = /^(.*\/)?index\.html$/.exec(f);
        if (m) {
            paths.add(toPath(m[1] || ''));
            if (m[1]) directories.add(toPath(m[1].replace(/\/$/, '')));
        }
    }
    return {paths: [...paths].sort(), directories: [...directories].sort()};
};

/**
 * The media type of a Content-Type header (lowercase, without parameters).
 * @param {string|undefined} value - The header.
 * @returns {string} The media type, or '' when there is none.
 */
export const mediaType = value => String(value || '').split(';')[0].trim().toLowerCase();

const extensionOf = p => {
    const base = decodeURIComponent(p.split('/').pop() || '');
    if (base === '') return '.html'; // `/dir/` serves index.html
    const dot = base.lastIndexOf('.');
    return dot > 0 ? base.slice(dot).toLowerCase() : '';
};

/**
 * Check the Cache-Control of side B against the design.
 * @param {string} p - The path.
 * @param {string|undefined} cacheControl - The header.
 * @returns {string|null} The problem, or null.
 */
export const cacheControlProblem = (p, cacheControl) => {
    const cc = String(cacheControl || '').toLowerCase();
    if (HASHED_FILE.test(p)) {
        if (!/\bimmutable\b/.test(cc) || !/\bmax-age=31536000\b/.test(cc)) {
            return `hashed file should be "public, max-age=31536000, immutable" (got "${cacheControl || ''}")`;
        }
        return null;
    }
    if (!/\bmax-age=0\b/.test(cc) && !/\bno-cache\b/.test(cc) && !/\bno-store\b/.test(cc)) {
        return `file without a hash should be "max-age=0" or "no-cache" (got "${cacheControl || ''}")`;
    }
    return null;
};

/**
 * Check the Content-Type of side B for the extensions in `EXPECTED_TYPES`.
 * @param {string} p - The path.
 * @param {string|undefined} contentType - The header.
 * @returns {string|null} The problem, or null.
 */
export const contentTypeProblem = (p, contentType) => {
    const want = EXPECTED_TYPES[extensionOf(p)];
    if (!want) return null;
    const got = mediaType(contentType);
    return want.includes(got) ? null : `Content-Type should be ${want.join(' or ')} (got "${contentType || ''}")`;
};

/**
 * Compare the answers of both sides for one path.
 * @param {string} p - The path.
 * @param {{status: number, headers: object, sha256: string}} a - Side A.
 * @param {{status: number, headers: object, sha256: string}} b - Side B.
 * @param {object} [options] - Options.
 * @param {boolean} [options.bChecks] - Also check B's headers against the design (default true).
 * @returns {{path: string, problems: string[], warnings: string[]}} The result.
 */
export const comparePath = (p, a, b, {bChecks = true} = {}) => {
    const problems = [];
    const warnings = [];
    if (a.status !== b.status) problems.push(`status A=${a.status} B=${b.status}`);
    if (a.status === 200 && b.status === 200) {
        if (a.sha256 !== b.sha256) problems.push(`body differs (A ${a.sha256.slice(0, 12)} B ${b.sha256.slice(0, 12)})`);
        const ta = mediaType(a.headers['content-type']);
        const tb = mediaType(b.headers['content-type']);
        if (ta !== tb) {
            problems.push(`Content-Type A="${a.headers['content-type'] || ''}" B="${b.headers['content-type'] || ''}"`);
        } else if (String(a.headers['content-type']).toLowerCase() !== String(b.headers['content-type']).toLowerCase()) {
            warnings.push(`Content-Type parameters A="${a.headers['content-type']}" B="${b.headers['content-type']}"`);
        }
    }
    if (bChecks && b.status === 200) {
        const cc = cacheControlProblem(p, b.headers['cache-control']);
        if (cc) problems.push(`B ${cc}`);
        const ct = contentTypeProblem(p, b.headers['content-type']);
        if (ct) problems.push(`B ${ct}`);
    }
    return {path: p, problems, warnings};
};

/**
 * Check side B's answer to a path that must not exist (403 on S3 + OAC). Side A is only shown,
 * so people can see where GitHub Pages behaves differently (404).
 * @param {string} p - The path.
 * @param {{status: number}} a - Side A.
 * @param {{status: number}} b - Side B.
 * @returns {{path: string, problems: string[], warnings: string[]}} The result.
 */
export const checkMissing = (p, a, b) => ({
    path: p,
    problems: b.status === 403 ? [] : [`missing path: B should be 403 (got ${b.status})`],
    warnings: [`missing path: A=${a.status} B=${b.status} (GitHub Pages answers 404, S3 + OAC 403)`],
});

/**
 * Check side B's answer to a directory without the trailing `/` (301 to `<path>/`).
 * @param {string} p - The path (e.g. `/admin`).
 * @param {{status: number, headers: object}} a - Side A.
 * @param {{status: number, headers: object}} b - Side B.
 * @returns {{path: string, problems: string[], warnings: string[]}} The result.
 */
export const checkDirectoryRedirect = (p, a, b) => {
    const problems = [];
    const location = String(b.headers.location || '');
    if (b.status !== 301) problems.push(`no trailing "/": B should be 301 (got ${b.status})`);
    else if (!location.replace(/^https?:\/\/[^/]+/, '').startsWith(`${p}/`)) {
        problems.push(`no trailing "/": B should redirect to ${p}/ (got "${location}")`);
    }
    const warnings = a.status === b.status ? [] : [`no trailing "/": A=${a.status} B=${b.status}`];
    return {path: p, problems, warnings};
};

/**
 * Turn the results into lines for people.
 * @param {{path: string, problems: string[], warnings: string[]}[]} results - The results.
 * @param {string} aLabel - Side A.
 * @param {string} bLabel - Side B.
 * @returns {string} The report.
 */
export const formatReport = (results, aLabel, bLabel) => {
    const lines = [`A = ${aLabel}`, `B = ${bLabel}`, ''];
    for (const r of results) {
        lines.push(`${r.problems.length ? 'NG  ' : 'OK  '} ${r.path}`);
        for (const x of r.problems) lines.push(`       ${x}`);
        for (const x of r.warnings) lines.push(`       warn: ${x}`);
    }
    const bad = results.filter(r => r.problems.length).length;
    lines.push('', `${results.length} paths, ${bad} with problems`);
    return `${lines.join('\n')}\n`;
};

/**
 * GET one URL without following redirects. The body is hashed, not kept (except when asked).
 * @param {string} base - The host (`https://smalruby.app`).
 * @param {string} p - The path.
 * @param {object} [options] - Options.
 * @param {string} [options.resolve] - Connect to this IP instead of resolving the host.
 * @param {boolean} [options.keepBody] - Also return the body as text.
 * @returns {Promise<{status: number, headers: object, sha256: string, body?: string}>} The answer.
 */
export const fetchPath = (base, p, {resolve, keepBody} = {}) => new Promise((done, fail) => {
    const url = new URL(p, base);
    const lib = url.protocol === 'http:' ? http : https;
    const lookup = resolve ?
        (host, opts, cb) => (opts && opts.all ? cb(null, [{address: resolve, family: resolve.includes(':') ? 6 : 4}]) :
            cb(null, resolve, resolve.includes(':') ? 6 : 4)) :
        undefined;
    // `identity` so that both sides send the bytes as stored and the hashes compare.
    const req = lib.get(url, {headers: {'accept-encoding': 'identity', 'user-agent': 'smalruby-site-compare'},
        lookup, timeout: 30000}, res => {
        const hash = createHash('sha256');
        const chunks = [];
        res.on('data', c => {
            hash.update(c);
            if (keepBody) chunks.push(c);
        });
        res.on('end', () => done({
            status: res.statusCode,
            headers: res.headers,
            sha256: hash.digest('hex'),
            ...(keepBody ? {body: Buffer.concat(chunks).toString('utf8')} : {}),
        }));
        res.on('error', fail);
    });
    req.on('timeout', () => req.destroy(new Error(`timeout: ${url.href}`)));
    req.on('error', fail);
});

const listFiles = (root, dir = root) => readdirSync(dir).flatMap(name => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? listFiles(root, full) : [path.relative(root, full).split(path.sep).join('/')];
});

const parseArgs = argv => {
    const opts = {precache: true, bChecks: true, concurrency: 4, json: false, list: false};
    for (let i = 0; i < argv.length; i++) {
        const k = argv[i];
        const v = () => {
            if (i + 1 >= argv.length) throw new Error(`${k} needs a value`);
            return argv[++i];
        };
        if (k === '--a') opts.a = v();
        else if (k === '--b') opts.b = v();
        else if (k === '--resolve-a') opts.resolveA = v();
        else if (k === '--resolve-b') opts.resolveB = v();
        else if (k === '--dist') opts.dist = v();
        else if (k === '--paths-file') opts.pathsFile = v();
        else if (k === '--no-precache') opts.precache = false;
        else if (k === '--no-b-checks') opts.bChecks = false;
        else if (k === '--limit') opts.limit = Number(v());
        else if (k === '--concurrency') opts.concurrency = Math.max(1, Number(v()));
        else if (k === '--list') opts.list = true;
        else if (k === '--json') opts.json = true;
        else throw new Error(`unknown argument: ${k}`);
    }
    if (!opts.a || !opts.b) throw new Error('--a and --b are required');
    return opts;
};

const mapLimit = async (items, limit, fn) => {
    const out = new Array(items.length);
    let next = 0;
    const worker = async () => {
        while (next < items.length) {
            const i = next++;
            out[i] = await fn(items[i]);
        }
    };
    await Promise.all(Array.from({length: Math.min(limit, items.length)}, worker));
    return out;
};

const main = async argv => {
    const opts = parseArgs(argv);
    const getA = (p, extra) => fetchPath(opts.a, p, {resolve: opts.resolveA, ...extra});
    const getB = p => fetchPath(opts.b, p, {resolve: opts.resolveB});
    const paths = new Set(DEFAULT_PATHS);
    const directories = new Set(['/admin']);
    if (opts.precache) {
        const sw = await getA('/service-worker.js', {keepBody: true});
        if (sw.status === 200) precachePaths(sw.body).forEach(p => paths.add(p));
        const index = await getA('/index.html', {keepBody: true});
        if (index.status === 200) htmlAssetPaths(index.body).forEach(p => paths.add(p));
    }
    if (opts.dist) {
        const fromDist = pathsFromFiles(listFiles(opts.dist));
        fromDist.paths.forEach(p => paths.add(p));
        fromDist.directories.forEach(p => directories.add(p));
    }
    if (opts.pathsFile) {
        readFileSync(opts.pathsFile, 'utf8').split(/\r?\n/).map(s => s.trim())
            .filter(s => s && !s.startsWith('#')).forEach(s => paths.add(toPath(s)));
    }
    let list = [...paths].sort();
    if (opts.limit) list = list.slice(0, opts.limit);
    if (opts.list) {
        process.stdout.write(`${list.join('\n')}\n`);
        return 0;
    }
    const results = await mapLimit(list, opts.concurrency, async p => {
        const [a, b] = await Promise.all([getA(p), getB(p)]);
        return comparePath(p, a, b, {bChecks: opts.bChecks});
    });
    if (opts.bChecks) {
        const missing = `/__site-compare-missing-${Date.now().toString(36)}__.html`;
        const [ma, mb] = await Promise.all([getA(missing), getB(missing)]);
        results.push(checkMissing(missing, ma, mb));
        for (const d of [...directories].sort()) {
            const [da, db] = await Promise.all([getA(d), getB(d)]);
            results.push(checkDirectoryRedirect(d, da, db));
        }
    }
    if (opts.json) process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
    else process.stdout.write(formatReport(results, opts.a, `${opts.b}${opts.resolveB ? ` (via ${opts.resolveB})` : ''}`));
    return results.some(r => r.problems.length) ? 1 : 0;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main(process.argv.slice(2)).then(code => {
        process.exitCode = code;
    }, err => {
        process.stderr.write(`site-compare: ${err.message}\n`);
        process.exitCode = 2;
    });
}
