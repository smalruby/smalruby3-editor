/* eslint-env jest */
// メッシュの練習相手のパネル（components/lesson-practice-partner）とコンテナ
// （containers/lesson-practice-partner.jsx）。VM は EventEmitter のにせもの。
import '@testing-library/jest-dom';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
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
    // 描き直す（前の描画を外して、別の VM で描く）
    const cleanupAndRender = (vm) => {
        cleanup();
        renderContainer({ vm });
    };
    const rerenderWith = (rerender, vm, challengeId) =>
        rerender(
            <IntlProvider locale="en" messages={en}>
                <LessonPracticePartnerContainer challengeId={challengeId} locale="ja" partnerDef={PARTNER} vm={vm} />
            </IntlProvider>,
        );

    const items = () => screen.queryAllByTestId('lesson-practice-partner-received-item');
    const values = () => items().map((item) => item.querySelector('[data-testid="lesson-practice-partner-received-value"]').textContent);

    test('splits the panel into 「send」 and 「received」 groups headed with the partner name', () => {
        renderContainer({ vm: makeVm() });
        const send = screen.getByTestId('lesson-practice-partner-send');
        expect(send).toHaveTextContent('Send as ロボ');
        expect(send.querySelectorAll('[data-testid="lesson-practice-partner-button"]')).toHaveLength(2);
        const received = screen.getByTestId('lesson-practice-partner-received-group');
        expect(received).toHaveTextContent('Reached ロボ');
        // 何も届いていなくても枠は出す（パネルの高さを変えない）
        expect(screen.getByTestId('lesson-practice-partner-received')).toHaveTextContent('(nothing yet)');
        expect(items()).toHaveLength(0);
        // 閉じてペアでやる案内は残す
        expect(screen.getByTestId('lesson-practice-partner-note')).toBeInTheDocument();
    });

    test('a variable shows its value large and its name small; a message shows just its name', () => {
        const vm = makeVm();
        renderContainer({ vm });
        run(vm, 'data_setvariableto', { VARIABLE: { id: 'v', name: 'メッセージ' }, VALUE: 'こんにちは' });
        const [row] = items();
        expect(row).toHaveAttribute('data-kind', 'variable');
        expect(row.querySelector('[data-testid="lesson-practice-partner-received-value"]')).toHaveTextContent(
            'こんにちは',
        );
        expect(row.querySelector('[data-testid="lesson-practice-partner-received-name"]')).toHaveTextContent(
            '← メッセージ',
        );
        // 全文は title で見る（長い値は省略して出すため）
        expect(row).toHaveAttribute('title', 'メッセージ = こんにちは');
        // 変数が変わっただけでは読み上げない
        expect(screen.getByTestId('lesson-practice-partner-announcement')).toHaveTextContent('');

        const other = makeVm();
        other.runtime.getTargetForStage().lookupBroadcastMsg = () => ({ name: 'さよなら' });
        cleanupAndRender(other);
        run(other, 'event_broadcast', { BROADCAST_OPTION: { id: 'm', name: 'さよなら' } });
        const [message] = items();
        expect(message).toHaveAttribute('data-kind', 'message');
        expect(message.querySelector('[data-testid="lesson-practice-partner-received-value"]')).toHaveTextContent(
            'さよなら',
        );
        expect(message.querySelector('[data-testid="lesson-practice-partner-received-name"]')).toBeNull();
    });

    test('keeps the newest 3, newest on top, older ones faded; repeats are separate rows', () => {
        const vm = makeVm();
        renderContainer({ vm });
        ['あ', 'い', 'う', 'え'].forEach((value) =>
            run(vm, 'data_setvariableto', { VARIABLE: { id: 'v', name: 'メッセージ' }, VALUE: value }),
        );
        expect(values()).toEqual(['え', 'う', 'い']);
        expect(items().map((item) => item.getAttribute('data-old'))).toEqual(['false', 'true', 'true']);
        // 同じメッセージが続けて届いても、1 行ずつ足す
        run(vm, 'event_broadcast', { BROADCAST_OPTION: { id: 'm', name: 'メッセージ' } });
        run(vm, 'event_broadcast', { BROADCAST_OPTION: { id: 'm', name: 'メッセージ' } });
        expect(values()).toEqual(['え', 'え', 'え']);
        expect(items().map((item) => item.getAttribute('data-kind'))).toEqual(['message', 'message', 'variable']);
    });

    test('the new row flashes for about a second', () => {
        jest.useFakeTimers();
        try {
            const vm = makeVm();
            renderContainer({ vm });
            run(vm, 'event_broadcast', { BROADCAST_OPTION: { id: 'm', name: 'メッセージ' } });
            expect(items()[0]).toHaveAttribute('data-flash', 'true');
            act(() => {
                jest.advanceTimersByTime(500);
            });
            run(vm, 'event_broadcast', { BROADCAST_OPTION: { id: 'm', name: 'メッセージ' } });
            // 新しい行だけが光る（前の行は光りやめる）
            expect(items().map((item) => item.getAttribute('data-flash'))).toEqual(['true', 'false']);
            act(() => {
                jest.advanceTimersByTime(1000);
            });
            expect(items().map((item) => item.getAttribute('data-flash'))).toEqual(['false', 'false']);
        } finally {
            jest.useRealTimers();
        }
    });

    test('values are text, never HTML', () => {
        const vm = makeVm();
        renderContainer({ vm });
        run(vm, 'data_setvariableto', { VARIABLE: { id: 'v', name: 'メッセージ' }, VALUE: '<b>やあ</b>' });
        expect(values()).toEqual(['<b>やあ</b>']);
        expect(items()[0].querySelector('b')).toBeNull();
    });

    test('reads aloud only when a message reached the partner', () => {
        const vm = makeVm();
        renderContainer({ vm });
        const live = screen.getByTestId('lesson-practice-partner-announcement');
        expect(live).toHaveAttribute('aria-live', 'polite');
        expect(screen.getByTestId('lesson-practice-partner-received')).not.toHaveAttribute('aria-live');
        run(vm, 'event_broadcast', { BROADCAST_OPTION: { id: 'm', name: 'メッセージ' } });
        expect(live).toHaveTextContent('Reached ロボ: メッセージ');
    });

    test('moving to another challenge with the same partner starts over and still shows what reaches it', () => {
        const vm = makeVm();
        const { rerender } = renderContainer({ vm });
        run(vm, 'data_setvariableto', { VARIABLE: { id: 'v', name: 'メッセージ' }, VALUE: 'こんにちは' });
        run(vm, 'event_broadcast', { BROADCAST_OPTION: { id: 'm', name: 'メッセージ' } });
        expect(values()).toEqual(['こんにちは', 'こんにちは']);
        rerenderWith(rerender, vm, 'c2');
        expect(items()).toHaveLength(0);
        expect(screen.getByTestId('lesson-practice-partner-received')).toHaveTextContent('(nothing yet)');
        run(vm, 'event_broadcast', { BROADCAST_OPTION: { id: 'm', name: 'メッセージ' } });
        // 前のチャレンジで覚えた値（メッセージ = こんにちは）は持ち越さない
        expect(values()).toEqual(['メッセージ']);
    });

    test('headings use the partner name of the challenge (the role mirror swaps it)', () => {
        renderContainer({ vm: makeVm(), partnerDef: { ...PARTNER, name: 'シマラビ' } });
        expect(screen.getByTestId('lesson-practice-partner-send')).toHaveTextContent('Send as シマラビ');
        expect(screen.getByTestId('lesson-practice-partner-received-group')).toHaveTextContent('Reached シマラビ');
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

    // 4-5 の「あなたに DM」（教員レビュー）: 名前がまだ空なら送らず、パネルに「先に入れよう」と出す。入れたら送って消す
    test('a button that needs the student name says so instead of sending while the name is empty', () => {
        const vm = makeVm();
        const name = { id: 'n', name: 'なまえ', type: '', value: 0 };
        vm.runtime.targets[0].variables.n = name;
        renderContainer({
            vm,
            partnerDef: {
                name: 'シマネコ',
                buttons: [
                    {
                        label: 'あなたに DM',
                        set: { variable: 'あてさき', value: { fromVariable: 'なまえ', required: true } },
                        broadcast: 'メッセージ',
                    },
                ],
            },
        });
        const button = screen.getByTestId('lesson-practice-partner-button');
        expect(screen.queryByTestId('lesson-practice-partner-missing')).toBeNull();
        fireEvent.click(button);
        expect(screen.getByTestId('lesson-practice-partner-missing')).toHaveTextContent(
            '"なまえ" is still empty. Click the flag and enter it first.',
        );
        expect(vm.runtime.startHats).not.toHaveBeenCalled();
        name.value = 'たかお';
        fireEvent.click(button);
        expect(screen.queryByTestId('lesson-practice-partner-missing')).toBeNull();
        expect(vm.ext.meshService.remoteData[PRACTICE_PARTNER_NODE_ID].あてさき.value).toBe('たかお');
        expect(vm.runtime.startHats).toHaveBeenCalledTimes(1);
    });

    test('strings exist in en / ja / ja-Hira', () => {
        ['title', 'note', 'close', 'open', 'received', 'nothingReceived', 'sendHeading', 'receivedHeading', 'variableName', 'missingVariable'].forEach((key) => {
            const id = `gui.lessonPracticePartner.${key}`;
            [en, ja, jaHira].forEach((messages) => expect(typeof messages[id]).toBe('string'));
        });
    });
});
