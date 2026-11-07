// Branch preview slug (https://preview.smalruby.app/<slug>/).
//
// The slug is the S3 key prefix and the CloudFront path of a branch preview, so it must be
// safe as both a DNS label and an S3 key: lowercase a-z / 0-9 / '-', no leading or trailing
// '-', at most 63 characters. `develop` stays `develop`.
//
// CLI: node scripts/preview-slug.mjs <branch>   -> prints the slug
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

export const PREVIEW_SLUG_MAX_LENGTH = 63;

const HASH_LENGTH = 8;

const shortHash = name => createHash('sha1').update(name).digest('hex').slice(0, HASH_LENGTH);

const trimHyphens = s => s.replace(/^-+|-+$/g, '');

/**
 * Normalize a branch name into a preview slug.
 * @param {string} branch - Git branch name (e.g. `topic/autopilot-1344`).
 * @returns {string} The slug (e.g. `topic-autopilot-1344`).
 */
export const previewSlug = branch => {
    if (typeof branch !== 'string' || branch === '') {
        throw new Error('previewSlug: branch name is required');
    }
    const slug = trimHyphens(branch.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
    if (slug === '') {
        // Nothing usable (e.g. only non-ASCII). A hash keeps different branches apart
        // and never yields an empty prefix, which would mean the bucket root.
        return `b-${shortHash(branch)}`;
    }
    if (slug.length <= PREVIEW_SLUG_MAX_LENGTH) return slug;
    // Cutting alone could make two long branches share a prefix; the hash of the original
    // name keeps them distinct.
    const head = trimHyphens(slug.slice(0, PREVIEW_SLUG_MAX_LENGTH - HASH_LENGTH - 1));
    return `${head}-${shortHash(branch)}`;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    process.stdout.write(`${previewSlug(process.argv[2])}\n`);
}
