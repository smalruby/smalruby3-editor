// Compare the records of two copies of a DNS zone (EPIC #1931, step 3 / issue #2001).
//
// Before the name servers of smalruby.app move from お名前.com to Route 53, every record that
// people rely on must be in both zones. This script reads two "sources", lines the records up
// by name and type, and lists what is missing or different. It changes nothing.
//
// A source is one of:
//   zone:<file>        A zone file (BIND form: `name TTL IN TYPE value`). The お名前.com export
//                      is given in this form, and `dig +noall +answer` output is the same form.
//   route53:<file>     The JSON of `aws route53 list-resource-record-sets --hosted-zone-id ...`.
//   ns:<host>[,<host>] Ask these name servers directly with `dig +norec` (e.g.
//                      `ns:01.dnsv.jp,02.dnsv.jp`). Every server is asked; if they disagree with
//                      each other, that is reported too.
//
// CLI:
//   node scripts/hosting/dns-compare.mjs --origin smalruby.app \
//     --a zone:onamae.txt --b ns:ns-1.awsdns-01.org,ns-2.awsdns-02.co.uk \
//     [--names @,www,api,preview] [--types A,AAAA,TXT,CAA,NS,CNAME,MX] [--include-apex-ns] [--json]
//
// Exit code: 0 = everything matches, 1 = something differs, 2 = bad arguments / query failure.
// TTL differences are only warnings (the apex A is 300 in Route 53 on purpose).
import {execFile} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';

export const DEFAULT_TYPES = ['A', 'AAAA', 'CNAME', 'TXT', 'CAA', 'NS', 'MX'];

// Names that are always asked when a side is a live name server (a zone file lists its own).
export const DEFAULT_NAMES = ['@', 'www', 'api', 'preview', '_github-pages-challenge-smalruby'];

/**
 * Split one zone-file line into fields. Quoted strings stay one field (quotes kept) and
 * `;` outside quotes starts a comment.
 * @param {string} line - One line of a zone file.
 * @returns {string[]} The fields.
 */
export const tokenize = line => {
    const out = [];
    let cur = '';
    let inQuote = false;
    let has = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (inQuote) {
            cur += c;
            if (c === '\\' && i + 1 < line.length) {
                cur += line[++i];
            } else if (c === '"') {
                inQuote = false;
            }
            continue;
        }
        if (c === ';') break;
        if (c === '"') {
            inQuote = true;
            cur += c;
            has = true;
        } else if (c === ' ' || c === '\t') {
            if (has) out.push(cur);
            cur = '';
            has = false;
        } else {
            cur += c;
            has = true;
        }
    }
    if (has) out.push(cur);
    return out;
};

const stripDot = s => s.replace(/\.$/, '');

/**
 * Make a name absolute and lowercase, without the trailing dot.
 * @param {string} name - `@`, a relative name (`www`) or an absolute one (`www.example.com.`).
 * @param {string} origin - The zone (e.g. `example.com`).
 * @returns {string} The absolute name (e.g. `www.example.com`).
 */
export const absoluteName = (name, origin) => {
    const o = stripDot(origin.toLowerCase());
    // Zone files write special characters as decimal escapes (`\042` is `*`, RFC 1035).
    const n = name.toLowerCase().replace(/\\(\d{3})/g, (_, d) => String.fromCharCode(Number(d)));
    if (n === '@' || n === '') return o;
    if (n.endsWith('.')) return stripDot(n);
    if (n === o || n.endsWith(`.${o}`)) return n;
    return `${n}.${o}`;
};

/**
 * Show a name relative to the zone (`@` for the apex).
 * @param {string} name - Absolute name.
 * @param {string} origin - The zone.
 * @returns {string} The relative name.
 */
export const relativeName = (name, origin) => {
    const o = stripDot(origin.toLowerCase());
    if (name === o) return '@';
    if (name.endsWith(`.${o}`)) return name.slice(0, -o.length - 1);
    return `${name}.`;
};

const unquote = s => {
    if (!(s.startsWith('"') && s.endsWith('"') && s.length >= 2)) return s;
    return s.slice(1, -1).replace(/\\(\d{3})/g, (_, d) => String.fromCharCode(Number(d)))
        .replace(/\\(.)/g, '$1');
};

/**
 * Normalize the value part of a record so that the same data written differently compares equal.
 * @param {string} type - Record type (upper case).
 * @param {string[]} fields - The value fields.
 * @param {string} origin - The zone, for relative host names.
 * @returns {string} The normalized value.
 */
export const normalizeValue = (type, fields, origin) => {
    switch (type) {
    case 'A':
    case 'AAAA':
        return fields.join(' ').toLowerCase();
    case 'NS':
    case 'CNAME':
        return absoluteName(fields[0], origin);
    case 'MX':
        return `${Number(fields[0])} ${absoluteName(fields[1], origin)}`;
    case 'TXT':
        // One TXT record may be split into several strings; DNS joins them back.
        return fields.map(unquote).join('');
    case 'CAA':
        return `${Number(fields[0])} ${fields[1].toLowerCase()} "${unquote(fields.slice(2).join(' '))}"`;
    default:
        return fields.join(' ');
    }
};

const CLASSES = new Set(['IN', 'CH', 'HS']);

/**
 * Parse a zone file (or `dig` output) into records. SOA and other multi-line records are skipped.
 * @param {string} text - The file contents.
 * @param {string} origin - The zone (used for `@` and relative names unless `$ORIGIN` says otherwise).
 * @returns {{name: string, type: string, ttl: (number|null), value: string}[]} The records.
 */
export const parseZone = (text, origin) => {
    let currentOrigin = origin;
    let defaultTtl = null;
    let lastName = null;
    let inParens = false;
    const records = [];
    for (const raw of text.split(/\r?\n/)) {
        if (inParens) {
            if (raw.includes(')')) inParens = false;
            continue;
        }
        const fields = tokenize(raw);
        if (fields.length === 0) continue;
        if (fields[0] === '$ORIGIN') {
            currentOrigin = stripDot(fields[1]);
            continue;
        }
        if (fields[0] === '$TTL') {
            defaultTtl = Number(fields[1]);
            continue;
        }
        if (fields[0].startsWith('$')) continue;
        let i = 0;
        let name;
        if (/^[ \t]/.test(raw)) {
            name = lastName;
        } else {
            name = absoluteName(fields[0], currentOrigin);
            i = 1;
        }
        let ttl = defaultTtl;
        for (let k = 0; k < 2 && i < fields.length; k++) {
            if (/^\d+$/.test(fields[i])) {
                ttl = Number(fields[i++]);
            } else if (CLASSES.has(fields[i].toUpperCase())) {
                i++;
            }
        }
        if (name === null || i >= fields.length) continue;
        lastName = name;
        const type = fields[i].toUpperCase();
        const rest = fields.slice(i + 1);
        if (rest.includes('(')) {
            if (!rest.includes(')')) inParens = true;
            continue;
        }
        if (type === 'SOA' || rest.length === 0) continue;
        records.push({name, type, ttl, value: normalizeValue(type, rest, currentOrigin)});
    }
    return records;
};

/**
 * Parse the JSON of `aws route53 list-resource-record-sets`.
 * An ALIAS record has no plain value; it becomes `ALIAS <target>` so that it is listed, not lost.
 * @param {string} text - The JSON text.
 * @param {string} origin - The zone.
 * @returns {{name: string, type: string, ttl: (number|null), value: string}[]} The records.
 */
export const parseRoute53 = (text, origin) => {
    const data = JSON.parse(text);
    const sets = Array.isArray(data) ? data : data.ResourceRecordSets;
    if (!Array.isArray(sets)) throw new Error('route53: ResourceRecordSets is missing');
    const records = [];
    for (const set of sets) {
        const type = String(set.Type).toUpperCase();
        if (type === 'SOA') continue;
        // Route 53 writes `*` and other special characters as octal escapes (`\052`).
        const name = absoluteName(String(set.Name).replace(/\\([0-7]{3})/g, (_, d) =>
            String.fromCharCode(parseInt(d, 8))), origin);
        if (set.AliasTarget) {
            records.push({name, type, ttl: null, value: `ALIAS ${absoluteName(set.AliasTarget.DNSName, '.')}`});
            continue;
        }
        for (const rr of set.ResourceRecords || []) {
            records.push({name, type, ttl: set.TTL ?? null, value: normalizeValue(type, tokenize(rr.Value), origin)});
        }
    }
    return records;
};

/**
 * Group records into record sets keyed by `name type`.
 * @param {{name: string, type: string, ttl: (number|null), value: string}[]} records - The records.
 * @returns {Map<string, {name: string, type: string, ttl: (number|null), values: string[]}>} The sets.
 */
export const toRecordSets = records => {
    const sets = new Map();
    for (const r of records) {
        const key = `${r.name} ${r.type}`;
        let set = sets.get(key);
        if (!set) {
            set = {name: r.name, type: r.type, ttl: r.ttl, values: []};
            sets.set(key, set);
        }
        if (!set.values.includes(r.value)) set.values.push(r.value);
        if (r.ttl !== null && (set.ttl === null || r.ttl < set.ttl)) set.ttl = r.ttl;
    }
    for (const set of sets.values()) set.values.sort();
    return sets;
};

/**
 * Line up two zones and say, per name and type, whether they agree.
 * @param {object[]} aRecords - Records of side A.
 * @param {object[]} bRecords - Records of side B.
 * @param {object} options - Options.
 * @param {string} options.origin - The zone.
 * @param {string[]} [options.types] - Record types to compare.
 * @param {string[]} [options.names] - Absolute names to compare (all names when omitted).
 * @param {boolean} [options.includeApexNs] - Compare the apex NS too (it differs by design).
 * @returns {{name: string, type: string, status: string, a: string[], b: string[],
 *   ttlA: (number|null), ttlB: (number|null), ttlDiffers: boolean}[]} One row per name and type;
 *   status is `match`, `differ`, `only-a` or `only-b`.
 */
export const compareRecordSets = (aRecords, bRecords, options) => {
    const origin = absoluteName('@', options.origin);
    const types = new Set((options.types || DEFAULT_TYPES).map(t => t.toUpperCase()));
    const names = options.names ? new Set(options.names) : null;
    const keep = r => types.has(r.type) && (!names || names.has(r.name)) &&
        !(r.type === 'NS' && r.name === origin && !options.includeApexNs);
    const a = toRecordSets(aRecords.filter(keep));
    const b = toRecordSets(bRecords.filter(keep));
    const keys = [...new Set([...a.keys(), ...b.keys()])].sort();
    return keys.map(key => {
        const sa = a.get(key);
        const sb = b.get(key);
        const {name, type} = sa || sb;
        let status;
        if (!sa) status = 'only-b';
        else if (!sb) status = 'only-a';
        else status = sa.values.join('\n') === sb.values.join('\n') ? 'match' : 'differ';
        const ttlA = sa ? sa.ttl : null;
        const ttlB = sb ? sb.ttl : null;
        return {
            name, type, status,
            a: sa ? sa.values : [],
            b: sb ? sb.values : [],
            ttlA, ttlB,
            ttlDiffers: ttlA !== null && ttlB !== null && ttlA !== ttlB,
        };
    });
};

/**
 * Turn the comparison into lines for people.
 * @param {object[]} rows - Result of `compareRecordSets`.
 * @param {object} options - Options.
 * @param {string} options.origin - The zone.
 * @param {string} options.aLabel - Name of side A.
 * @param {string} options.bLabel - Name of side B.
 * @returns {string} The report.
 */
export const formatReport = (rows, {origin, aLabel, bLabel}) => {
    const mark = {'match': 'OK    ', 'differ': 'DIFF  ', 'only-a': 'ONLY-A', 'only-b': 'ONLY-B'};
    const lines = [`A = ${aLabel}`, `B = ${bLabel}`, ''];
    for (const r of rows) {
        const head = `${mark[r.status]} ${relativeName(r.name, origin)} ${r.type}`;
        if (r.status === 'match') {
            lines.push(`${head} (${r.a.length})${r.ttlDiffers ? `  warn: TTL A=${r.ttlA} B=${r.ttlB}` : ''}`);
            continue;
        }
        lines.push(head);
        if (r.a.length) lines.push(`         A: ${r.a.join(' | ')}`);
        if (r.b.length) lines.push(`         B: ${r.b.join(' | ')}`);
    }
    const bad = rows.filter(r => r.status !== 'match').length;
    const warn = rows.filter(r => r.ttlDiffers).length;
    lines.push('', `${rows.length} sets, ${bad} not matching, ${warn} TTL warnings`);
    return `${lines.join('\n')}\n`;
};

/**
 * Keep only the answers to the question that was asked (`dig` also prints the authority section,
 * which is where a delegation's NS records are, but it can carry other records too).
 * @param {object[]} records - Records parsed from one `dig` run.
 * @param {string} name - Absolute name that was asked.
 * @param {string} type - Type that was asked.
 * @returns {object[]} The records that answer the question.
 */
export const answersFor = (records, name, type) =>
    records.filter(r => r.name === name && (r.type === type || r.type === 'CNAME'));

const execFileP = promisify(execFile);

/**
 * Ask the given name servers for each name and type with `dig +norec`.
 * @param {string[]} servers - Name servers (host names or IPs).
 * @param {string[]} names - Absolute names.
 * @param {string[]} types - Record types.
 * @param {string} origin - The zone.
 * @param {Function} [run] - `(args) => Promise<string>`; replaced in tests.
 * @returns {Promise<{records: object[], inconsistent: object[]}>} Records of the first server and
 *   the disagreements of the other servers with it.
 */
export const queryServers = async (servers, names, types, origin, run) => {
    // dig exits non-zero when no server answers (exit 9); stop instead of reporting "missing".
    const dig = run || (async args => {
        try {
            return (await execFileP('dig', args, {timeout: 20000})).stdout;
        } catch (err) {
            throw new Error(`dig ${args.join(' ')} failed (exit ${err.code}): ${String(err.stdout || err.message).trim()}`);
        }
    });
    const perServer = [];
    for (const server of servers) {
        const records = [];
        for (const name of names) {
            for (const type of types) {
                const out = await dig([`@${server}`, '+norec', '+noall', '+answer', '+authority',
                    '+time=3', '+tries=2', name, type]);
                records.push(...answersFor(parseZone(out, origin), name, type));
            }
        }
        perServer.push({server, records});
    }
    const inconsistent = [];
    for (const other of perServer.slice(1)) {
        const rows = compareRecordSets(perServer[0].records, other.records, {origin, types, includeApexNs: true})
            .filter(r => r.status !== 'match');
        for (const r of rows) inconsistent.push({server: other.server, against: perServer[0].server, ...r});
    }
    return {records: perServer[0] ? perServer[0].records : [], inconsistent};
};

/**
 * Parse `zone:...` / `route53:...` / `ns:...`.
 * @param {string} spec - The source argument.
 * @returns {{kind: string, arg: string}} The source.
 */
export const parseSourceSpec = spec => {
    const m = /^(zone|route53|ns):(.+)$/.exec(spec || '');
    if (!m) throw new Error(`source must be zone:<file>, route53:<file> or ns:<host,...> (got ${spec})`);
    return {kind: m[1], arg: m[2]};
};

const parseArgs = argv => {
    const opts = {types: DEFAULT_TYPES, includeApexNs: false, json: false};
    for (let i = 0; i < argv.length; i++) {
        const k = argv[i];
        const v = () => {
            if (i + 1 >= argv.length) throw new Error(`${k} needs a value`);
            return argv[++i];
        };
        if (k === '--a') opts.a = v();
        else if (k === '--b') opts.b = v();
        else if (k === '--origin') opts.origin = v();
        else if (k === '--names') opts.names = v().split(',').filter(Boolean);
        else if (k === '--types') opts.types = v().split(',').filter(Boolean).map(t => t.toUpperCase());
        else if (k === '--include-apex-ns') opts.includeApexNs = true;
        else if (k === '--json') opts.json = true;
        else throw new Error(`unknown argument: ${k}`);
    }
    if (!opts.a || !opts.b || !opts.origin) throw new Error('--origin, --a and --b are required');
    return opts;
};

const main = async argv => {
    const opts = parseArgs(argv);
    const {origin, types} = opts;
    const specs = [parseSourceSpec(opts.a), parseSourceSpec(opts.b)];
    const fileRecords = specs.map(s => {
        if (s.kind === 'zone') return parseZone(readFileSync(s.arg, 'utf8'), origin);
        if (s.kind === 'route53') return parseRoute53(readFileSync(s.arg, 'utf8'), origin);
        return null;
    });
    // Live servers are asked about the names the files list, plus the given or default names.
    const nameSet = new Set((opts.names || DEFAULT_NAMES).map(n => absoluteName(n, origin)));
    for (const recs of fileRecords) for (const r of recs || []) nameSet.add(r.name);
    const names = opts.names && fileRecords.every(r => r === null) ?
        opts.names.map(n => absoluteName(n, origin)) : [...nameSet].sort();
    const inconsistent = [];
    const sides = [];
    for (let i = 0; i < 2; i++) {
        if (fileRecords[i]) {
            sides.push(fileRecords[i]);
            continue;
        }
        const result = await queryServers(specs[i].arg.split(',').filter(Boolean), names, types, origin);
        inconsistent.push(...result.inconsistent);
        sides.push(result.records);
    }
    const rows = compareRecordSets(sides[0], sides[1], {
        origin, types, includeApexNs: opts.includeApexNs,
        names: opts.names ? opts.names.map(n => absoluteName(n, origin)) : null,
    });
    if (opts.json) {
        process.stdout.write(`${JSON.stringify({rows, inconsistent}, null, 2)}\n`);
    } else {
        process.stdout.write(formatReport(rows, {origin, aLabel: opts.a, bLabel: opts.b}));
        for (const r of inconsistent) {
            process.stdout.write(`INCONSISTENT ${relativeName(r.name, origin)} ${r.type}: ` +
                `${r.server} says [${r.b.join(' | ')}], ${r.against} says [${r.a.join(' | ')}]\n`);
        }
    }
    return rows.some(r => r.status !== 'match') || inconsistent.length ? 1 : 0;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main(process.argv.slice(2)).then(code => {
        process.exitCode = code;
    }, err => {
        process.stderr.write(`dns-compare: ${err.message}\n`);
        process.exitCode = 2;
    });
}
