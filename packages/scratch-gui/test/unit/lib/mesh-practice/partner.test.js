/* eslint-env jest */
import {
    buttonValueFor,
    clampValue,
    emptySettings,
    listProjectMeshItems,
    MAX_MESSAGE_VALUE_LENGTH,
    MAX_PARTNER_VARIABLES,
    MESH_PRACTICE_PARTNER_NODE_ID,
    partnerFromSettings,
    partnerVariableRows,
    practiceAllowed,
    repliesFor,
    sanitizeSettings,
    withButtonValue,
    withoutReply,
    withoutVariable,
    withPracticeNodes,
    withReply,
    withVariable,
} from '../../../../src/lib/mesh-practice/partner';

describe('mesh practice partner: definition (#1845)', () => {
    test('values are capped at 1000 (JS length) like the real mesh', () => {
        expect(MAX_MESSAGE_VALUE_LENGTH).toBe(1000);
        // same as the VM (the scratch-vm exports do not expose message-value.js to the GUI)
        // eslint-disable-next-line global-require
        const vmValue = require('../../../../../scratch-vm/src/extensions/scratch3_mesh_v2/message-value');
        expect(MAX_MESSAGE_VALUE_LENGTH).toBe(vmValue.MAX_MESSAGE_VALUE_LENGTH);
        expect(clampValue('x'.repeat(1001))).toBe(vmValue.toMessageValue('x'.repeat(1001)));
        expect(clampValue('a'.repeat(1200))).toHaveLength(1000);
        expect(clampValue(42)).toBe('42');
        expect(clampValue(null)).toBe('');
        // a lone high surrogate at the cut is dropped
        const text = `${'a'.repeat(999)}😀`;
        expect(clampValue(text)).toBe('a'.repeat(999));
    });

    test('practice is allowed only while not connected', () => {
        expect(practiceAllowed(null)).toBe(true);
        expect(practiceAllowed('disconnected')).toBe(true);
        expect(practiceAllowed('error')).toBe(true);
        expect(practiceAllowed('connecting')).toBe(false);
        expect(practiceAllowed('connected')).toBe(false);
    });

    test('lists the messages and the stage scalar variables of the project', () => {
        const stage = {
            variables: {
                a: { name: 'メッセージ2', type: 'broadcast_msg' },
                b: { name: 'メッセージ1', type: 'broadcast_msg' },
                c: { name: 'score', type: '' },
                d: { name: 'list', type: 'list' },
                e: { name: '☁ cloud', type: '', isCloud: true },
            },
        };
        expect(listProjectMeshItems(stage)).toEqual({
            messages: ['メッセージ1', 'メッセージ2'],
            variables: ['score'],
        });
        expect(listProjectMeshItems(null)).toEqual({ messages: [], variables: [] });
    });

    test('broken storage becomes empty settings; duplicates and empty names are dropped', () => {
        expect(sanitizeSettings('x')).toEqual(emptySettings());
        const clean = sanitizeSettings({
            variables: [{ name: ' x ', value: 1 }, { name: 'x', value: 2 }, { name: '' }, { name: 'y' }],
            buttons: [
                { broadcast: 'a', value: 'v' },
                { broadcast: 'A', value: 'w' },
            ],
            replies: [{ onBroadcast: 'a', broadcast: 'b', value: 'z'.repeat(2000) }, { onBroadcast: 'a' }],
        });
        expect(clean.variables).toEqual([
            { name: 'x', value: '1' },
            { name: 'y', value: null },
        ]);
        expect(clean.buttons).toEqual([{ broadcast: 'a', value: 'v' }]);
        expect(clean.replies).toHaveLength(1);
        expect(clean.replies[0].value).toHaveLength(1000);
    });

    test('variables: project variables first, then the ones made for the partner', () => {
        let s = emptySettings();
        s = withVariable(s, 'made', '');
        s = withVariable(s, 'score', '5');
        expect(partnerVariableRows(s, ['score', 'hp'])).toEqual([
            { name: 'score', value: '5', created: false },
            { name: 'hp', value: null, created: false },
            { name: 'made', value: '', created: true },
        ]);
        expect(withVariable(s, 'made', null)).toBe(s);
        expect(withoutVariable(s, 'made').variables.map((v) => v.name)).toEqual(['score']);
        let full = emptySettings();
        for (let i = 0; i < MAX_PARTNER_VARIABLES; i++) full = withVariable(full, `v${i}`, '');
        expect(withVariable(full, 'more', '')).toBe(full);
    });

    test('button values are kept per message (case-insensitive) and an empty value forgets it', () => {
        let s = withButtonValue(emptySettings(), 'Chat', 'hi');
        expect(buttonValueFor(s, 'chat')).toBe('hi');
        s = withButtonValue(s, 'CHAT', '');
        expect(s.buttons).toEqual([]);
    });

    test('replies: added once, removed by index, matched case-insensitively', () => {
        let s = withReply(emptySettings(), { onBroadcast: 'ping', broadcast: 'pong', value: '1' });
        expect(withReply(s, { onBroadcast: 'PING', broadcast: 'pong', value: '1' })).toBe(s);
        s = withReply(s, { onBroadcast: 'ping', broadcast: 'other', value: '' });
        const partner = partnerFromSettings(s);
        expect(repliesFor(partner, 'Ping').map((r) => r.broadcast)).toEqual(['pong', 'other']);
        expect(partner.replies[0]).toEqual({ onBroadcast: 'ping', set: [], broadcast: 'pong', value: '1' });
        expect(withoutReply(s, 0).replies.map((r) => r.broadcast)).toEqual(['other']);
        expect(repliesFor(partner, '')).toEqual([]);
    });

    test('the status snapshot gets you and the partner while not connected', () => {
        const snapshot = { connected: false, selfId: 'me', nodes: [], nodeCount: 0, history: [] };
        const next = withPracticeNodes(snapshot, {
            selfVariables: [
                { name: 'b', value: 2 },
                { name: 'a', value: 1 },
            ],
            partnerData: { score: { value: '9', timestamp: 100 } },
        });
        expect(next.practice).toBe(true);
        expect(next.nodeCount).toBe(2);
        expect(next.nodes[0]).toMatchObject({ id: 'me', isSelf: true });
        expect(next.nodes[0].variables.map((v) => v.name)).toEqual(['a', 'b']);
        expect(next.nodes[1]).toMatchObject({ id: MESH_PRACTICE_PARTNER_NODE_ID, isSelf: false, lastDataAt: 100 });
        expect(next.nodes[1].variables).toEqual([{ name: 'score', value: '9', at: 100 }]);
        // connected: untouched
        const connected = { ...snapshot, connected: true };
        expect(withPracticeNodes(connected, { selfVariables: [], partnerData: {} })).toBe(connected);
    });
});
