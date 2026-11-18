// node --test scripts/hosting/dns-compare.test.mjs
// No network: live queries go through a replaced `dig`.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

import {
    absoluteName,
    compareRecordSets,
    formatReport,
    parseRoute53,
    parseSourceSpec,
    parseZone,
    queryServers,
    tokenize,
} from './dns-compare.mjs';

const ORIGIN = 'example.com';
const sample = name => readFileSync(new URL(`./samples/${name}`, import.meta.url), 'utf8');

test('tokenize keeps quoted strings together and drops comments', () => {
    assert.deepEqual(tokenize('@ 300 IN TXT "a b; c" "d" ; note'), ['@', '300', 'IN', 'TXT', '"a b; c"', '"d"']);
    assert.deepEqual(tokenize('   '), []);
});

test('names are made absolute, lowercase and without the trailing dot', () => {
    assert.equal(absoluteName('@', ORIGIN), 'example.com');
    assert.equal(absoluteName('WWW', ORIGIN), 'www.example.com');
    assert.equal(absoluteName('www.example.com.', ORIGIN), 'www.example.com');
    assert.equal(absoluteName('\\042.example.com.', ORIGIN), '*.example.com');
});

test('parseZone reads $ORIGIN / $TTL, blank names, classes and skips SOA', () => {
    const recs = parseZone([
        '$ORIGIN example.com.',
        '$TTL 600',
        '@ IN SOA ns.example.net. host.example.com. (',
        '    1 7200 900 1209600 86400 )',
        '@ A 192.0.2.1',
        '  300 A 192.0.2.2',
        'www IN 60 CNAME @',
        '@ TXT "part one " "part two"',
        '@ CAA 0 ISSUE "letsencrypt.org"',
    ].join('\n'), 'other.test');
    assert.deepEqual(recs, [
        {name: 'example.com', type: 'A', ttl: 600, value: '192.0.2.1'},
        {name: 'example.com', type: 'A', ttl: 300, value: '192.0.2.2'},
        {name: 'www.example.com', type: 'CNAME', ttl: 60, value: 'example.com'},
        {name: 'example.com', type: 'TXT', ttl: 600, value: 'part one part two'},
        {name: 'example.com', type: 'CAA', ttl: 600, value: '0 issue "letsencrypt.org"'},
    ]);
});

test('dig output is read as a zone file', () => {
    const out = 'api.example.com.\t3600\tIN\tNS\tns-1.awsdns.example.org.\n' +
        'api.example.com.\t3600\tIN\tNS\tNS-2.awsdns.example.org.\n';
    assert.deepEqual(parseZone(out, ORIGIN).map(r => r.value),
        ['ns-1.awsdns.example.org', 'ns-2.awsdns.example.org']);
});

test('parseRoute53 reads record sets, skips SOA and keeps ALIAS visible', () => {
    const recs = parseRoute53(JSON.stringify({ResourceRecordSets: [
        {Name: 'example.com.', Type: 'SOA', TTL: 900, ResourceRecords: [{Value: 'x'}]},
        {Name: 'example.com.', Type: 'TXT', TTL: 300, ResourceRecords: [{Value: '"a" "b"'}]},
        {Name: 'example.com.', Type: 'A', AliasTarget: {DNSName: 'd111.cloudfront.example.'}},
        {Name: '\\052.example.com.', Type: 'A', TTL: 60, ResourceRecords: [{Value: '192.0.2.3'}]},
    ]}), ORIGIN);
    assert.deepEqual(recs, [
        {name: 'example.com', type: 'TXT', ttl: 300, value: 'ab'},
        {name: 'example.com', type: 'A', ttl: null, value: 'ALIAS d111.cloudfront.example'},
        {name: '*.example.com', type: 'A', ttl: 60, value: '192.0.2.3'},
    ]);
});

test('the two samples agree; only the apex A TTL is a warning and the apex NS is ignored', () => {
    const rows = compareRecordSets(
        parseZone(sample('onamae-zone.example.txt'), ORIGIN),
        parseRoute53(sample('route53.example.json'), ORIGIN),
        {origin: ORIGIN},
    );
    assert.ok(rows.every(r => r.status === 'match'), JSON.stringify(rows));
    assert.deepEqual(rows.filter(r => r.ttlDiffers).map(r => `${r.name} ${r.type}`), ['example.com A']);
    assert.ok(!rows.some(r => r.name === 'example.com' && r.type === 'NS'));
});

test('missing, extra and different records are reported', () => {
    const a = parseZone('@ 300 A 192.0.2.1\nwww 300 CNAME @\n@ 300 TXT "v=1"\n', ORIGIN);
    const b = parseZone('@ 300 A 192.0.2.9\n@ 300 TXT "v=1"\nmail 300 A 192.0.2.5\n', ORIGIN);
    const rows = compareRecordSets(a, b, {origin: ORIGIN});
    const byKey = Object.fromEntries(rows.map(r => [`${r.name} ${r.type}`, r.status]));
    assert.deepEqual(byKey, {
        'example.com A': 'differ',
        'example.com TXT': 'match',
        'mail.example.com A': 'only-b',
        'www.example.com CNAME': 'only-a',
    });
    const text = formatReport(rows, {origin: ORIGIN, aLabel: 'A', bLabel: 'B'});
    assert.match(text, /DIFF {3}@ A\n {9}A: 192\.0\.2\.1\n {9}B: 192\.0\.2\.9/);
    assert.match(text, /3 not matching/);
});

test('record order and duplicates do not matter; names and types can be narrowed', () => {
    const a = parseZone('@ A 192.0.2.2\n@ A 192.0.2.1\n@ A 192.0.2.1\n@ MX 10 mx\n', ORIGIN);
    const b = parseZone('@ A 192.0.2.1\n@ A 192.0.2.2\n', ORIGIN);
    assert.equal(compareRecordSets(a, b, {origin: ORIGIN, types: ['A']})[0].status, 'match');
    assert.equal(compareRecordSets(a, b, {origin: ORIGIN, names: ['www.example.com']}).length, 0);
    assert.equal(compareRecordSets(a, b, {origin: ORIGIN}).find(r => r.type === 'MX').status, 'only-a');
});

test('the apex NS is compared only when asked', () => {
    const a = parseZone('@ NS a.example.net.\n', ORIGIN);
    const b = parseZone('@ NS b.example.net.\n', ORIGIN);
    assert.equal(compareRecordSets(a, b, {origin: ORIGIN}).length, 0);
    assert.equal(compareRecordSets(a, b, {origin: ORIGIN, includeApexNs: true})[0].status, 'differ');
});

test('queryServers asks every server and reports servers that disagree', async () => {
    const answers = {
        'ns1 example.com A': 'example.com. 300 IN A 192.0.2.1\nexample.com. 300 IN NS ns1.\n',
        'ns2 example.com A': 'example.com. 300 IN A 192.0.2.7\n',
        'ns1 api.example.com NS': 'api.example.com. 3600 IN NS d.example.org.\n',
        'ns2 api.example.com NS': 'api.example.com. 3600 IN NS d.example.org.\n',
    };
    const calls = [];
    const run = async args => {
        calls.push(args);
        assert.ok(args.includes('+norec'));
        const server = args[0].slice(1);
        return answers[`${server} ${args.at(-2)} ${args.at(-1)}`] || '';
    };
    const result = await queryServers(['ns1', 'ns2'], ['example.com', 'api.example.com'], ['A', 'NS'], ORIGIN, run);
    assert.equal(calls.length, 8);
    assert.deepEqual(result.records.map(r => `${r.name} ${r.type} ${r.value}`).sort(), [
        'api.example.com NS d.example.org',
        'example.com A 192.0.2.1',
    ]);
    assert.equal(result.inconsistent.length, 1);
    assert.equal(result.inconsistent[0].server, 'ns2');
    assert.equal(result.inconsistent[0].type, 'A');
});

test('parseSourceSpec accepts only the three kinds', () => {
    assert.deepEqual(parseSourceSpec('ns:a,b'), {kind: 'ns', arg: 'a,b'});
    assert.throws(() => parseSourceSpec('file.txt'));
});
