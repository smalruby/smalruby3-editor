// Decide what a deploy removes from the S3 site bucket (#2514).
//
// `aws s3 sync --delete` removed every file the new build did not have, right after the upload.
// Tabs opened before the deploy, iPads with the editor on the home screen and an `index.html`
// still in a cache ask for the parts of the previous build by their old names, so the chunks /
// manifest / images they load later were 404 (in the middle of a lesson). Now:
//
// - Files the new build has are never removed (they were just uploaded).
// - Files whose names change with every build (a hex hash `\.[0-9a-f]{8,}\.`, the same rule as the
//   upload's cache split, or under `static/monaco/<version>/`) are kept until they were last
//   uploaded more than RETENTION_DAYS ago. Old builds only ask for these. The files of the build
//   just replaced are kept whatever their age, so a deploy after a long break (no deploy for
//   more than RETENTION_DAYS) does not remove them at once.
// - Other files the new build no longer has are removed at once, as before.
//
// The deploy role already has s3:ListBucket and s3:DeleteObject (aws s3 sync --delete used them).
//
// CLI:
//   node scripts/prune-old-assets.mjs --src <build dir> --listing <list-objects-v2 JSON>
//     --batch-dir <dir> [--prefix <key prefix>] [--exclude-prefix <relative prefix>]... [--days N]
//   -> writes <batch-dir>/delete-<n>.json for `aws s3api delete-objects --delete file://...`
//      and prints a summary.
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

/** Days a file of an old build stays after it was last uploaded. */
export const RETENTION_DAYS = 14;

/** File names with a hex hash (same rule as the upload's immutable cache split). */
export const HASHED_PATTERN = /\.[0-9a-f]{8,}\./;

/** Monaco is served under its version (#1318), so these paths change with each Monaco update. */
export const VERSIONED_PATTERN = /^static\/monaco\/[^/]+\/vs\//;

/** Names the deploy never uploads nor removes. */
export const IGNORED_NAMES = new Set([".DS_Store", ".nojekyll", "CNAME"]);

/** delete-objects takes at most 1000 keys per call. */
export const DELETE_BATCH_SIZE = 1000;

/**
 * A deploy uploads its files over a few minutes, so the files of one build have LastModified
 * within this of each other.
 */
export const BUILD_UPLOAD_SLACK_MS = 60 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whether a file of an old build is kept for a while instead of removed at once.
 * @param {string} relKey - Key relative to the deploy prefix.
 * @returns {boolean} True for names that change with every build.
 */
export const isRetained = (relKey) =>
    HASHED_PATTERN.test(relKey) || VERSIONED_PATTERN.test(relKey);

/**
 * Plan which objects to remove.
 * @param {object} options - Options.
 * @param {Array<{Key: string, LastModified: string}>} options.objects - Objects under the prefix.
 * @param {Set<string>} options.localFiles - Files of the new build, relative to its directory.
 * @param {string} [options.prefix] - Key prefix of the deploy (`''`, `'admin/'`, `'<slug>/'`).
 * @param {string[]} [options.excludePrefixes] - Relative prefixes another deploy owns.
 * @param {number} options.now - Current time (ms epoch).
 * @param {number} [options.retentionDays] - Days to keep files of an old build.
 * @returns {{delete: string[], retained: string[]}} Full keys to remove, and old files kept.
 * @throws {Error} When retentionDays is not a number of days (keeping nothing by mistake).
 */
export const planPrune = ({
    objects,
    localFiles,
    prefix = "",
    excludePrefixes = [],
    now,
    retentionDays = RETENTION_DAYS,
}) => {
    if (!Number.isFinite(retentionDays) || retentionDays < 0) {
        throw new Error(
            `retentionDays must be a number of days, got ${retentionDays}`,
        );
    }
    const stale = [];
    for (const { Key: key, LastModified: lastModified } of objects) {
        if (!key.startsWith(prefix)) continue;
        const rel = key.slice(prefix.length);
        if (rel === "" || rel.endsWith("/")) continue;
        if (excludePrefixes.some((p) => rel.startsWith(p))) continue;
        if (IGNORED_NAMES.has(path.posix.basename(rel))) continue;
        if (localFiles.has(rel)) continue;
        stale.push({
            key,
            retained: isRetained(rel),
            modified: Date.parse(lastModified),
        });
    }
    // Everything the new build has was just uploaded, so the newest of the rest is the build just
    // replaced. Its files stay even when the previous deploy was more than retentionDays ago.
    const previousBuild = stale.reduce(
        (newest, s) =>
            s.retained && s.modified > newest ? s.modified : newest,
        -Infinity,
    );
    const limit = Math.min(
        now - retentionDays * DAY_MS,
        previousBuild - BUILD_UPLOAD_SLACK_MS,
    );
    const plan = { delete: [], retained: [] };
    for (const { key, retained, modified } of stale) {
        // An unreadable date counts as new: keeping a file one more deploy is harmless.
        if (retained && (Number.isNaN(modified) || modified >= limit)) {
            plan.retained.push(key);
        } else {
            plan.delete.push(key);
        }
    }
    return plan;
};

/**
 * Split keys into `aws s3api delete-objects --delete` payloads.
 * @param {string[]} keys - Keys to remove.
 * @returns {Array<{Objects: Array<{Key: string}>, Quiet: boolean}>} Payloads.
 */
export const toDeleteBatches = (keys) => {
    const batches = [];
    for (let i = 0; i < keys.length; i += DELETE_BATCH_SIZE) {
        batches.push({
            Objects: keys
                .slice(i, i + DELETE_BATCH_SIZE)
                .map((Key) => ({ Key })),
            Quiet: true,
        });
    }
    return batches;
};

/**
 * List the files of a directory, relative to it, with `/` separators.
 * @param {string} dir - Directory.
 * @returns {Promise<Set<string>>} Relative paths.
 */
export const listLocalFiles = async (dir) => {
    const entries = await readdir(dir, {
        recursive: true,
        withFileTypes: true,
    });
    const files = new Set();
    for (const entry of entries) {
        if (!entry.isFile()) continue;
        const parent = entry.parentPath ?? entry.path;
        files.add(
            path
                .relative(dir, path.join(parent, entry.name))
                .split(path.sep)
                .join("/"),
        );
    }
    return files;
};

/**
 * Write the delete-objects payloads as `<dir>/delete-<n>.json`.
 * @param {string[]} keys - Keys to remove.
 * @param {string} dir - Output directory.
 * @returns {Promise<string[]>} Written files.
 */
export const writeDeleteBatches = async (keys, dir) => {
    await mkdir(dir, { recursive: true });
    const written = [];
    for (const [i, batch] of toDeleteBatches(keys).entries()) {
        const file = path.join(dir, `delete-${i}.json`);
        await writeFile(file, JSON.stringify(batch));
        written.push(file);
    }
    return written;
};

const main = async () => {
    const { values } = parseArgs({
        options: {
            src: { type: "string" },
            listing: { type: "string" },
            "batch-dir": { type: "string" },
            prefix: { type: "string", default: "" },
            "exclude-prefix": { type: "string", multiple: true, default: [] },
            days: { type: "string", default: String(RETENTION_DAYS) },
        },
    });
    if (!values.src || !values.listing || !values["batch-dir"]) {
        throw new Error("--src, --listing and --batch-dir are required");
    }
    const listingText = (await readFile(values.listing, "utf8")).trim();
    // list-objects-v2 prints nothing (or no Contents) for an empty prefix.
    const objects = listingText ? (JSON.parse(listingText).Contents ?? []) : [];
    const plan = planPrune({
        objects,
        localFiles: await listLocalFiles(values.src),
        prefix: values.prefix,
        excludePrefixes: values["exclude-prefix"],
        now: Date.now(),
        retentionDays: values.days.trim() === "" ? NaN : Number(values.days),
    });
    await writeDeleteBatches(plan.delete, values["batch-dir"]);
    console.log(
        `prune ${values.prefix || "/"}: remove ${plan.delete.length}, ` +
            `keep ${plan.retained.length} file(s) of older builds (up to ${values.days} days)`,
    );
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main().catch((error) => {
        console.error(error);
        process.exit(1);
    });
}
