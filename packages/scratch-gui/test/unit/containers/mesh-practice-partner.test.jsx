/* eslint-env jest */
// メッシュのウィンドウの「練習相手」タブ (#1845)。コンテナ（containers/mesh-status-popup.jsx）から
// 描き、VM は EventEmitter のにせもの。
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { EventEmitter } from 'events';
import React from 'react';
import { IntlProvider } from 'react-intl';
import { MeshStatusPopupContainer } from '../../../src/containers/mesh-status-popup.jsx';
import { attachPracticeLoopback } from '../../../src/lib/mesh-practice/loopback';
import { MESH_PRACTICE_PARTNER_NODE_ID as PARTNER } from '../../../src/lib/mesh-practice/partner';
import { STORAGE_KEY } from '../../../src/lib/mesh-practice/storage';
import en from '../../../src/locales/en';
import ja from '../../../src/locales/ja';
import jaHira from '../../../src/locales/ja-Hira';

const makeVm = () => {
    const vm = new EventEmitter();
    const runtime = new EventEmitter();
    const stage = {
        variables: {
            m1: { id: 'm1', name: 'ping', type: 'broadcast_msg' },
            m2: { id: 'm2', name: 'pong', type: 'broadcast_msg' },
            v1: { id: 'v1', name: 'score', type: '', value: 3 },
        },
        blocks: { resetCache: jest.fn() },
        lookupBroadcastMsg: (id, name) => (['ping', 'pong'].includes(name) ? { name } : undefined),
        lookupVariableById: () => undefined,
        lookupVariableByNameAndType: () => undefined,
    };
    runtime.targets = [stage];
    runtime.getTargetForStage = () => stage;
    runtime._primitives = { event_broadcast: jest.fn() };
    runtime.getOpcodeFunction = function (opcode) {
        return this._primitives[opcode];
    };
    runtime.startHats = jest.fn(() => []);
    const service = {
        meshId: 'me',
        remoteData: {},
        messageHistory: [],
        recordMessage(entry) {
            this.messageHistory.unshift(Object.freeze({ ...entry }));
        },
        getGlobalVariables: () => [{ key: 'score', value: 3 }],
    };
    const ext = {
        connectionState: 'disconnected',
        meshService: service,
        startMessageHats: jest.fn(),
        refreshGroupNodes: jest.fn(() => Promise.resolve([])),
        getStatusSnapshot: jest.fn(() => ({
            connected: ext.connectionState === 'connected',
            groupId: null,
            selfId: 'me',
            inClassroom: false,
            nodeCount: 0,
            nodes: [],
            history: service.messageHistory.slice(),
        })),
    };
    runtime.peripheralExtensions = { meshV2: ext };
    vm.runtime = runtime;
    return { vm, ext, service, runtime };
};

const renderOpen = (vm, projectKey = 'id:game', extra = {}) => {
    const props = { isOpen: true, onClose: jest.fn(), onOpenConnection: jest.fn(), projectKey, vm, ...extra };
    const utils = render(
        <IntlProvider locale="en" messages={en}>
            <MeshStatusPopupContainer {...props} />
        </IntlProvider>,
    );
    const rerender = (next) =>
        utils.rerender(
            <IntlProvider locale="en" messages={en}>
                <MeshStatusPopupContainer {...props} {...next} />
            </IntlProvider>,
        );
    return { ...utils, rerender };
};

describe('mesh practice partner tab (#1845)', () => {
    beforeEach(() => {
        window.localStorage.clear();
        window.sessionStorage.clear();
    });

    test('lists the messages and variables of the project; sending turns the partner on', () => {
        const fake = makeVm();
        renderOpen(fake.vm);
        fireEvent.click(screen.getByTestId('mesh-status-tab-practice'));
        expect(screen.getAllByTestId('mesh-practice-message').map((li) => li.textContent)).toEqual([
            expect.stringContaining('ping'),
            expect.stringContaining('pong'),
        ]);
        expect(screen.getAllByTestId('mesh-practice-variable')[0]).toHaveTextContent('score');
        expect(screen.getByTestId('mesh-practice-use')).not.toBeChecked();

        const ping = screen.getAllByTestId('mesh-practice-message')[0];
        fireEvent.change(within(ping).getByTestId('mesh-practice-message-value'), { target: { value: 'hi' } });
        fireEvent.click(within(ping).getByTestId('mesh-practice-send'));
        expect(screen.getByTestId('mesh-practice-use')).toBeChecked();
        expect(fake.ext.startMessageHats).toHaveBeenCalledWith('ping', 'hi', expect.any(Object));
        expect(fake.service.messageHistory[0]).toMatchObject({ direction: 'received', nodeId: PARTNER });
    });

    test('a partner variable can be made; it goes to remoteData (the sensor value dropdown) and storage', () => {
        const fake = makeVm();
        renderOpen(fake.vm);
        fireEvent.click(screen.getByTestId('mesh-status-tab-practice'));
        fireEvent.change(screen.getByTestId('mesh-practice-new-variable'), { target: { value: '合図' } });
        fireEvent.click(screen.getByTestId('mesh-practice-add-variable'));
        expect(fake.service.remoteData[PARTNER]).toHaveProperty('合図');
        const rows = screen.getAllByTestId('mesh-practice-variable');
        const made = rows[rows.length - 1];
        fireEvent.change(within(made).getByTestId('mesh-practice-variable-value'), { target: { value: '42' } });
        fireEvent.click(within(made).getByTestId('mesh-practice-variable-set'));
        expect(fake.service.remoteData[PARTNER].合図.value).toBe('42');
        const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
        expect(saved.projects['id:game'].variables).toEqual([{ name: '合図', value: '42' }]);
        // the project itself is never touched
        expect(Object.keys(fake.runtime.targets[0].variables)).toEqual(['m1', 'm2', 'v1']);

        // the partner is one 「相手」 in the status tab
        fireEvent.click(screen.getByTestId('mesh-status-tab-status'));
        const nodes = screen.getAllByTestId('mesh-status-node');
        expect(nodes).toHaveLength(2);
        expect(nodes[1]).toHaveTextContent('Partner (practice partner)');
        expect(nodes[1]).toHaveTextContent('42');

        fireEvent.click(screen.getByTestId('mesh-status-tab-practice'));
        fireEvent.click(screen.getByTestId('mesh-practice-variable-remove'));
        expect(fake.service.remoteData[PARTNER]).toBeUndefined();
    });

    test('an automatic reply is added and kept in the browser', () => {
        const fake = makeVm();
        const { unmount } = renderOpen(fake.vm);
        fireEvent.click(screen.getByTestId('mesh-status-tab-practice'));
        fireEvent.change(screen.getByTestId('mesh-practice-reply-send'), { target: { value: 'pong' } });
        fireEvent.change(screen.getByTestId('mesh-practice-reply-value'), { target: { value: 'ok' } });
        fireEvent.click(screen.getByTestId('mesh-practice-add-reply'));
        expect(screen.getByTestId('mesh-practice-reply')).toHaveTextContent('「ping」');
        expect(screen.getByTestId('mesh-practice-reply')).toHaveTextContent('「pong」');
        unmount();
        // unmounting removes what the practice put in
        expect(fake.service.remoteData).toEqual({});

        renderOpen(makeVm().vm);
        fireEvent.click(screen.getByTestId('mesh-status-tab-practice'));
        expect(screen.getByTestId('mesh-practice-reply')).toHaveTextContent('「pong」');
    });

    test('connecting tears the partner down and the tab rests', () => {
        const fake = makeVm();
        renderOpen(fake.vm);
        fireEvent.click(screen.getByTestId('mesh-status-tab-practice'));
        fireEvent.click(screen.getAllByTestId('mesh-practice-variable-set')[0]);
        expect(fake.service.remoteData[PARTNER].score.value).toBe('');
        act(() => {
            fake.ext.connectionState = 'connected';
            fake.runtime.emit('PERIPHERAL_CONNECTED');
        });
        expect(fake.service.remoteData[PARTNER]).toBeUndefined();
        expect(screen.getByTestId('mesh-practice-use')).not.toBeChecked();
        expect(screen.getByTestId('mesh-practice-use')).toBeDisabled();
        expect(screen.getByTestId('mesh-practice-paused')).toBeInTheDocument();
    });

    test('M1: a failed connect (connecting → error) leaves 「使う」 off; it does not start again by itself', () => {
        const fake = makeVm();
        renderOpen(fake.vm);
        fireEvent.click(screen.getByTestId('mesh-status-tab-practice'));
        fireEvent.click(screen.getAllByTestId('mesh-practice-variable-set')[0]);
        expect(screen.getByTestId('mesh-practice-use')).toBeChecked();
        // connecting emits no event; the loopback finds it at the next frame
        act(() => {
            fake.ext.connectionState = 'connecting';
            fake.runtime.emit('BEFORE_STEP');
        });
        expect(screen.getByTestId('mesh-practice-use')).not.toBeChecked();
        // the connect fails (WebSocket blocked etc.)
        act(() => {
            fake.ext.connectionState = 'error';
            fake.runtime.emit('PERIPHERAL_DISCONNECTED');
            fake.runtime.emit('BEFORE_STEP');
        });
        expect(screen.getByTestId('mesh-practice-use')).not.toBeChecked();
        expect(screen.getByTestId('mesh-practice-use')).not.toBeDisabled();
        expect(fake.service.remoteData[PARTNER]).toBeUndefined();
        expect(fake.runtime.listenerCount('BEFORE_STEP')).toBe(0);
        // the student turns it on again
        fireEvent.click(screen.getByTestId('mesh-practice-use'));
        expect(screen.getByTestId('mesh-practice-use')).toBeChecked();
        expect(fake.service.remoteData[PARTNER].score.value).toBe('');
    });

    test('M2: opening the page or changing the project writes nothing; only changing the settings writes', () => {
        const fake = makeVm();
        const { rerender } = renderOpen(fake.vm, null);
        rerender({ projectKey: 'id:other' });
        rerender({ projectKey: 'id:third' });
        expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
        expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull();
        fireEvent.click(screen.getByTestId('mesh-status-tab-practice'));
        fireEvent.change(screen.getByTestId('mesh-practice-new-variable'), { target: { value: 'v' } });
        fireEvent.click(screen.getByTestId('mesh-practice-add-variable'));
        expect(Object.keys(JSON.parse(window.localStorage.getItem(STORAGE_KEY)).projects)).toEqual(['id:third']);
    });

    test('Q1: a project without an id keeps the settings in this tab only, and a saved project reloads its own', () => {
        const fake = makeVm();
        const { rerender } = renderOpen(fake.vm, null);
        fireEvent.click(screen.getByTestId('mesh-status-tab-practice'));
        fireEvent.change(screen.getByTestId('mesh-practice-new-variable'), { target: { value: 'tabOnly' } });
        fireEvent.click(screen.getByTestId('mesh-practice-add-variable'));
        expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
        expect(window.sessionStorage.getItem(STORAGE_KEY)).toContain('tabOnly');
        // a project with saved settings: they are loaded and the fields are made again
        window.localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ version: 1, projects: { 'id:p1': { variables: [{ name: 'score', value: '7' }] } } }),
        );
        rerender({ projectKey: 'id:p1' });
        const score = screen.getAllByTestId('mesh-practice-variable')[0];
        expect(within(score).getByTestId('mesh-practice-variable-value')).toHaveValue('7');
        expect(screen.queryByText('tabOnly')).toBeNull();
    });

    test('Q2: the practice state is passed up (for the badge on the stage-top button)', () => {
        const fake = makeVm();
        const onPracticeActive = jest.fn();
        renderOpen(fake.vm, 'id:game', { onPracticeActive });
        expect(onPracticeActive).toHaveBeenLastCalledWith(false);
        fireEvent.click(screen.getByTestId('mesh-status-tab-practice'));
        fireEvent.click(screen.getByTestId('mesh-practice-use'));
        expect(onPracticeActive).toHaveBeenLastCalledWith(true);
        expect(screen.getByTestId('mesh-practice-active')).toHaveTextContent('Practicing');
    });

    test('Q3: while a lesson practice partner is active, the standalone one stays detached with a note', () => {
        const fake = makeVm();
        const { rerender } = renderOpen(fake.vm, 'id:game', { lessonPartnerActive: true });
        fireEvent.click(screen.getByTestId('mesh-status-tab-practice'));
        expect(screen.getByTestId('mesh-practice-blocked')).toBeInTheDocument();
        expect(screen.getByTestId('mesh-practice-use')).toBeDisabled();
        fireEvent.click(screen.getAllByTestId('mesh-practice-variable-set')[0]);
        expect(fake.service.remoteData[PARTNER]).toBeUndefined();
        rerender({ lessonPartnerActive: false });
        expect(screen.getByTestId('mesh-practice-use')).not.toBeDisabled();
    });

    test('Q3: another loopback (e.g. the lesson one) attached to the runtime blocks it, and turns it off', () => {
        const fake = makeVm();
        renderOpen(fake.vm);
        fireEvent.click(screen.getByTestId('mesh-status-tab-practice'));
        fireEvent.click(screen.getByTestId('mesh-practice-use'));
        expect(screen.getByTestId('mesh-practice-use')).toBeChecked();
        // the standalone one holds the runtime, so a lesson one cannot attach
        expect(attachPracticeLoopback({ vm: fake.vm, owner: 'lesson' })).toBeNull();
        fireEvent.click(screen.getByTestId('mesh-practice-use'));
        let lesson;
        act(() => {
            lesson = attachPracticeLoopback({ vm: fake.vm, owner: 'lesson' });
        });
        expect(lesson).not.toBeNull();
        expect(screen.getByTestId('mesh-practice-blocked')).toBeInTheDocument();
        expect(screen.getByTestId('mesh-practice-use')).toBeDisabled();
        act(() => lesson.detach());
        expect(screen.getByTestId('mesh-practice-use')).not.toBeDisabled();
    });

    test('strings exist in en / ja / ja-Hira', () => {
        const ids = [
            'gui.meshStatus.buttonPracticing',
            'gui.meshStatus.practiceBadge',
            'gui.meshStatus.practicingShort',
            'gui.meshPractice.blocked',
            'gui.meshPractice.activeLabel',
            'gui.meshStatus.tabPractice',
            'gui.meshStatus.practicing',
            'gui.meshStatus.practicePeer',
            ...[
                'use',
                'note',
                'paused',
                'sendTitle',
                'valuePlaceholder',
                'send',
                'sendLabel',
                'noMessages',
                'variablesTitle',
                'set',
                'setLabel',
                'notSet',
                'remove',
                'newVariable',
                'addVariable',
                'createdHint',
                'repliesTitle',
                'reply',
                'replyWithValue',
                'replyOn',
                'replySend',
                'addReply',
                'noReplies',
            ].map((key) => `gui.meshPractice.${key}`),
        ];
        ids.forEach((id) => [en, ja, jaHira].forEach((m) => expect(typeof m[id]).toBe('string')));
    });
});
