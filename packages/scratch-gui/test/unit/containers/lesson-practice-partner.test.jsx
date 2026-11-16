/* eslint-env jest */
// メッシュの練習相手のパネル（components/lesson-practice-partner）とコンテナ
// （containers/lesson-practice-partner.jsx）。VM は EventEmitter のにせもの。
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import EventEmitter from 'events';
import React from 'react';
import { IntlProvider } from 'react-intl';
import { LessonPracticePartnerContainer } from '../../../src/containers/lesson-practice-partner.jsx';
import { PRACTICE_PARTNER_NODE_ID } from '../../../src/lib/lessons/practice-partner';
import { attachPracticeLoopback, practiceLoopbackOwner } from '../../../src/lib/mesh-practice/loopback';
import en from '../../../src/locales/en';
import ja from '../../../src/locales/ja';
import jaHira from '../../../src/locales/ja-Hira';

const PARTNER = {
    name: 'ロボ',
    buttons: [
        { label: 'あいさつする', set: { variable: 'へんじ', value: 'こんにちは' }, broadcast: 'メッセージ' },
        { label: 'さよなら', broadcast: 'さよなら' },
    ],
    replies: [{ onBroadcast: 'メッセージ', broadcast: 'へんじ' }],
};

const makeVm = (connectionState = 'disconnected') => {
    const runtime = new EventEmitter();
    const variables = {
        m: { id: 'm', name: 'メッセージ', type: 'broadcast_msg' },
        v: { id: 'v', name: 'メッセージ', type: '', value: '' },
    };
    const stage = {
        isStage: true,
        variables,
        blocks: { resetCache: jest.fn() },
        lookupVariableById: (id) => variables[id],
        lookupVariableByNameAndType: (name, type) =>
            Object.values(variables).find((v) => v.name === name && v.type === type),
        lookupBroadcastMsg: (id, name) => (name === 'メッセージ' ? { name: 'メッセージ' } : undefined),
    };
    runtime.targets = [stage];
    runtime.getTargetForStage = () => stage;
    runtime._primitives = {};
    runtime.getOpcodeFunction = function (opcode) {
        return this._primitives[opcode];
    };
    runtime.startHats = jest.fn();
    const ext = { connectionState, meshService: { meshId: 'me', remoteData: {} } };
    runtime.peripheralExtensions = { meshV2: ext };
    return { runtime, ext };
};

const renderContainer = (props) =>
    render(
        <IntlProvider locale="en" messages={en}>
            <LessonPracticePartnerContainer challengeId="c1" locale="ja" partnerDef={PARTNER} {...props} />
        </IntlProvider>,
    );

describe('LessonPracticePartner container', () => {
    test('shows the partner name and buttons; a button acts as the partner on the mesh', () => {
        const vm = makeVm();
        renderContainer({ vm });
        expect(screen.getByTestId('lesson-practice-partner-name')).toHaveTextContent('Practice partner: ロボ');
        const buttons = screen.getAllByTestId('lesson-practice-partner-button');
        expect(buttons.map((b) => b.textContent)).toEqual(['あいさつする', 'さよなら']);
        fireEvent.click(buttons[0]);
        expect(vm.ext.meshService.remoteData[PRACTICE_PARTNER_NODE_ID].へんじ.value).toBe('こんにちは');
        expect(vm.runtime.startHats).toHaveBeenCalledWith('event_whenbroadcastreceived', {
            BROADCAST_OPTION: 'メッセージ',
        });
    });

    test('closing detaches the loopback (back to the real mesh) and leaves a button to open it again', () => {
        const vm = makeVm();
        renderContainer({ vm });
        fireEvent.click(screen.getAllByTestId('lesson-practice-partner-button')[0]);
        fireEvent.click(screen.getByTestId('lesson-practice-partner-close'));
        expect(screen.queryByTestId('lesson-practice-partner')).toBeNull();
        expect(vm.ext.meshService.remoteData).toEqual({});
        fireEvent.click(screen.getByTestId('lesson-practice-partner-open'));
        expect(screen.getByTestId('lesson-practice-partner')).toBeInTheDocument();
    });

    test('focus moves to the open button when closed and to the first partner button when opened', () => {
        renderContainer({ vm: makeVm() });
        // 最初の描画ではフォーカスを奪わない
        expect(document.activeElement).toBe(document.body);
        const close = screen.getByTestId('lesson-practice-partner-close');
        close.focus();
        fireEvent.click(close);
        expect(document.activeElement).toBe(screen.getByTestId('lesson-practice-partner-open'));
        fireEvent.click(screen.getByTestId('lesson-practice-partner-open'));
        expect(document.activeElement).toBe(screen.getAllByTestId('lesson-practice-partner-button')[0]);
    });

    test('nothing is shown while the real mesh is connected, and connecting closes it', () => {
        const connected = makeVm('connected');
        const { unmount } = renderContainer({ vm: connected });
        expect(screen.queryByTestId('lesson-practice-partner')).toBeNull();
        expect(screen.queryByTestId('lesson-practice-partner-open')).toBeNull();
        unmount();

        const vm = makeVm();
        renderContainer({ vm });
        fireEvent.click(screen.getAllByTestId('lesson-practice-partner-button')[0]);
        act(() => {
            vm.ext.connectionState = 'connected';
            vm.runtime.emit('PERIPHERAL_CONNECTED');
        });
        expect(screen.queryByTestId('lesson-practice-partner')).toBeNull();
        expect(vm.ext.meshService.remoteData[PRACTICE_PARTNER_NODE_ID]).toBeUndefined();
        // 切れたら、閉じたボタンを出す（自分で開き直す）
        act(() => {
            vm.ext.connectionState = 'disconnected';
            vm.runtime.emit('PERIPHERAL_DISCONNECTED');
        });
        expect(screen.getByTestId('lesson-practice-partner-open')).toBeInTheDocument();
    });

    test('a challenge without a partner shows nothing', () => {
        renderContainer({ vm: makeVm(), partnerDef: null });
        expect(screen.queryByTestId('lesson-practice-partner')).toBeNull();
        expect(screen.queryByTestId('lesson-practice-partner-open')).toBeNull();
    });

    test('unmounting (leaving the lesson) removes what the practice put in', () => {
        const vm = makeVm();
        const { unmount } = renderContainer({ vm });
        fireEvent.click(screen.getAllByTestId('lesson-practice-partner-button')[0]);
        unmount();
        expect(vm.ext.meshService.remoteData).toEqual({});
    });

    // 生徒の作品のブロックを 1 つ動かして、次のフレームの最初（BEFORE_STEP）まで進める
    const run = (vm, opcode, args) => {
        vm.runtime._primitives[opcode] = vm.runtime._primitives[opcode] || jest.fn();
        act(() => {
            vm.runtime.getOpcodeFunction(opcode)(args, {});
            vm.runtime.emit('BEFORE_STEP');
        });
    };
    const rerenderWith = (rerender, vm, challengeId) =>
        rerender(
            <IntlProvider locale="en" messages={en}>
                <LessonPracticePartnerContainer challengeId={challengeId} locale="ja" partnerDef={PARTNER} vm={vm} />
            </IntlProvider>,
        );

    test('shows what reached the partner, up to two lines (the last message, with the value of that name)', () => {
        const vm = makeVm();
        renderContainer({ vm });
        const line = screen.getByTestId('lesson-practice-partner-received');
        // 何も届いていなくても出す（パネルの高さを変えない）
        expect(line).toHaveTextContent('Received: (nothing yet)');
        run(vm, 'data_setvariableto', { VARIABLE: { id: 'v', name: 'メッセージ' }, VALUE: 'こんにちは' });
        expect(line).toHaveTextContent('Received: メッセージ = こんにちは');
        // 変数が変わっただけでは読み上げない
        expect(screen.getByTestId('lesson-practice-partner-announcement')).toHaveTextContent('');
        run(vm, 'event_broadcast', { BROADCAST_OPTION: { id: 'm', name: 'メッセージ' } });
        expect(line).toHaveTextContent('Received: メッセージ = こんにちは');
        expect(line).toHaveAttribute('title', 'Received: メッセージ = こんにちは');
        // 相手のボタン（相手から生徒へ）は相手に届いたものではない
        fireEvent.click(screen.getAllByTestId('lesson-practice-partner-button')[1]);
        expect(line).toHaveTextContent('Received: メッセージ = こんにちは');
    });

    test('reads aloud only when a message reached the partner', () => {
        const vm = makeVm();
        renderContainer({ vm });
        const live = screen.getByTestId('lesson-practice-partner-announcement');
        expect(live).toHaveAttribute('aria-live', 'polite');
        expect(screen.getByTestId('lesson-practice-partner-received')).not.toHaveAttribute('aria-live');
        run(vm, 'event_broadcast', { BROADCAST_OPTION: { id: 'm', name: 'メッセージ' } });
        expect(live).toHaveTextContent('Received: メッセージ');
    });

    test('moving to another challenge with the same partner starts over and still shows what reaches it', () => {
        const vm = makeVm();
        const { rerender } = renderContainer({ vm });
        run(vm, 'data_setvariableto', { VARIABLE: { id: 'v', name: 'メッセージ' }, VALUE: 'こんにちは' });
        run(vm, 'event_broadcast', { BROADCAST_OPTION: { id: 'm', name: 'メッセージ' } });
        expect(screen.getByTestId('lesson-practice-partner-received')).toHaveTextContent(
            'Received: メッセージ = こんにちは',
        );
        rerenderWith(rerender, vm, 'c2');
        expect(screen.getByTestId('lesson-practice-partner-received')).toHaveTextContent('Received: (nothing yet)');
        // 同じ内容を送っても行が出る（前のチャレンジの行を持ち越して「変わっていない」とみなさない）
        run(vm, 'event_broadcast', { BROADCAST_OPTION: { id: 'm', name: 'メッセージ' } });
        // 前のチャレンジで覚えた値（メッセージ = こんにちは）も持ち越さない
        expect(screen.getByTestId('lesson-practice-partner-received')).toHaveTextContent('Received: メッセージ');
        expect(screen.getByTestId('lesson-practice-partner-received')).not.toHaveTextContent('こんにちは');
    });

    test('waits while another practice partner is connected, and connects once it lets go (#1876)', () => {
        const vm = makeVm();
        const other = attachPracticeLoopback({ vm, owner: 'standalone' });
        renderContainer({ vm });
        expect(practiceLoopbackOwner(vm.runtime)).toBe('standalone');
        act(() => other.detach());
        expect(practiceLoopbackOwner(vm.runtime)).toBe('lesson');
        fireEvent.click(screen.getAllByTestId('lesson-practice-partner-button')[0]);
        expect(vm.ext.meshService.remoteData[PRACTICE_PARTNER_NODE_ID].へんじ.value).toBe('こんにちは');
    });

    test('strings exist in en / ja / ja-Hira', () => {
        ['title', 'note', 'close', 'open', 'received', 'nothingReceived'].forEach((key) => {
            const id = `gui.lessonPracticePartner.${key}`;
            [en, ja, jaHira].forEach((messages) => expect(typeof messages[id]).toBe('string'));
        });
    });
});
