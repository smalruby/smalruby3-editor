/* eslint-env jest */
// メッシュのウィンドウの「練習相手」タブ (#1845)。コンテナ（containers/mesh-status-popup.jsx）から
// 描き、VM は EventEmitter のにせもの。
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { EventEmitter } from 'events';
import React from 'react';
import { IntlProvider } from 'react-intl';
import { MeshStatusPopupContainer } from '../../../src/containers/mesh-status-popup.jsx';
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

const renderOpen = (vm, projectKey = 'title:game') =>
    render(
        <IntlProvider locale="en" messages={en}>
            <MeshStatusPopupContainer
                isOpen
                onClose={jest.fn()}
                onOpenConnection={jest.fn()}
                projectKey={projectKey}
                vm={vm}
            />
        </IntlProvider>,
    );

describe('mesh practice partner tab (#1845)', () => {
    beforeEach(() => window.localStorage.clear());

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
        expect(saved.projects['title:game'].variables).toEqual([{ name: '合図', value: '42' }]);
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

    test('strings exist in en / ja / ja-Hira', () => {
        const ids = [
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
