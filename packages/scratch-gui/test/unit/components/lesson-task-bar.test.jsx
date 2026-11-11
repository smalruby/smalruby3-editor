/* eslint-env jest */
import '@testing-library/jest-dom';
import { act, fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import LessonTaskBar, { HOVER_DELAY_MS } from '../../../src/components/lesson-task-bar/lesson-task-bar.jsx';
import { findChallenge } from '../../../src/lib/lessons/courses';
import en from '../../../src/locales/en';
import ja from '../../../src/locales/ja';

// defaultMessage は ja なので、英語の表示は en の messages を渡して確かめる
const renderBar = (props = {}, { locale = 'en', messages = en } = {}) => {
    const { challenge, lesson } = findChallenge(props.challengeId || 'blocks-l1-click-say');
    const onHint = jest.fn();
    const onQuit = jest.fn();
    const utils = render(
        <IntlProvider locale={locale} messages={messages}>
            <LessonTaskBar
                challenge={challenge}
                challengeCount={lesson.challenges.length}
                hintAvailable
                onHint={onHint}
                onQuit={onQuit}
                {...props}
            />
        </IntlProvider>,
    );
    return { ...utils, onHint, onQuit };
};

describe('LessonTaskBar', () => {
    test('shows the task line and "n of N"', () => {
        const { getByTestId } = renderBar();
        expect(getByTestId('lesson-task-bar')).toBeInTheDocument();
        expect(getByTestId('lesson-task-bar-position')).toHaveTextContent('3 of 11');
        expect(getByTestId('lesson-task-bar-task')).toHaveTextContent(
            'Add a costume you like to the cat, and make it say "Hello!" and change its look when it is clicked',
        );
    });

    test('falls back to the challenge name when there is no task line yet', () => {
        // レッスン 1 のチャレンジはどれも課題があるので、課題の無いチャレンジに見せかける
        const { challenge } = findChallenge('blocks-l1-broadcast');
        const { getByTestId } = renderBar({ challenge: { ...challenge, task: null } });
        expect(getByTestId('lesson-task-bar-position')).toHaveTextContent('9 of 11');
        expect(getByTestId('lesson-task-bar-task')).toHaveTextContent('Signal a friend');
    });

    test('uses the Japanese strings', () => {
        const { getByTestId } = renderBar({}, { locale: 'ja', messages: ja });
        expect(getByTestId('lesson-task-bar-position')).toHaveTextContent('3 / 全部で 11');
        expect(getByTestId('lesson-task-bar-quit')).toHaveTextContent('ほかのチャレンジへ');
        expect(getByTestId('lesson-task-bar-hint')).toHaveTextContent('ヒント');
    });

    test('uses the English label for the button that opens the lessons library', () => {
        const { getByTestId } = renderBar();
        expect(getByTestId('lesson-task-bar-quit')).toHaveTextContent('Try another challenge');
    });

    test('quit button calls onQuit', () => {
        const { getByTestId, onQuit } = renderBar();
        fireEvent.click(getByTestId('lesson-task-bar-quit'));
        expect(onQuit).toHaveBeenCalledTimes(1);
    });

    test('hint button calls onHint', () => {
        const { getByTestId, onHint } = renderBar();
        fireEvent.click(getByTestId('lesson-task-bar-hint'));
        expect(onHint).toHaveBeenCalledTimes(1);
    });

    test('hint button is disabled when the challenge has no hints', () => {
        const { getByTestId } = renderBar({ hintAvailable: false });
        expect(getByTestId('lesson-task-bar-hint')).toBeDisabled();
    });

    describe('full text panel', () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });
        afterEach(() => {
            jest.useRealTimers();
        });

        // jsdom には PointerEvent が無いので、pointerType を持たせた MouseEvent で代わりにする
        const pointer = (el, type, pointerType = 'mouse', relatedTarget = null) => {
            const event = new MouseEvent(type, { bubbles: true, cancelable: true, relatedTarget });
            Object.defineProperty(event, 'pointerType', { value: pointerType });
            act(() => {
                el.dispatchEvent(event);
            });
        };
        // 乗せてから HOVER_DELAY_MS 待って出る
        const hover = (el) => {
            pointer(el, 'pointerover');
            act(() => {
                jest.advanceTimersByTime(HOVER_DELAY_MS);
            });
        };
        const unhover = (el) => pointer(el, 'pointerout', 'mouse', document.body);
        const tap = (el) => {
            pointer(el, 'pointerdown', 'touch');
            fireEvent.click(el);
        };

        test('is closed at first and has no "Read all" button', () => {
            const { queryByTestId, getByTestId } = renderBar();
            expect(queryByTestId('lesson-task-bar-full-text')).toBeNull();
            expect(queryByTestId('lesson-task-bar-full-text-toggle')).toBeNull();
            expect(getByTestId('lesson-task-bar-task')).toHaveAttribute('aria-expanded', 'false');
        });

        test('shows the whole task under the bar while the mouse is on the bar, even for a short task', () => {
            const { getByTestId, queryByTestId } = renderBar({ challengeId: 'blocks-l1-key-sound' });
            hover(getByTestId('lesson-task-bar'));
            expect(getByTestId('lesson-task-bar-full-text')).toHaveTextContent(
                'Make the cat meow and then play the "Owl" sound when the space key is pressed',
            );
            unhover(getByTestId('lesson-task-bar'));
            expect(queryByTestId('lesson-task-bar-full-text')).toBeNull();
        });

        test('does not flash when the mouse only crosses the bar', () => {
            const { getByTestId, queryByTestId } = renderBar();
            pointer(getByTestId('lesson-task-bar'), 'pointerover');
            act(() => {
                jest.advanceTimersByTime(HOVER_DELAY_MS - 50);
            });
            expect(queryByTestId('lesson-task-bar-full-text')).toBeNull();
            unhover(getByTestId('lesson-task-bar'));
            act(() => {
                jest.advanceTimersByTime(HOVER_DELAY_MS);
            });
            expect(queryByTestId('lesson-task-bar-full-text')).toBeNull();
        });

        test('keeps the line breaks of the task in the panel and joins them in the bar', () => {
            const { getByTestId } = renderBar({ challengeId: 'blocks-l1-if' }, { locale: 'ja', messages: ja });
            // バーの 1 行は改行を取って 1 行にする（日本語は空白を入れない）
            expect(getByTestId('lesson-task-bar-task').textContent).toBe(
                'マウスでネコにさわったら「くすぐったい！」、さわっていないときは「さわってみて」と言うようにしよう',
            );
            hover(getByTestId('lesson-task-bar'));
            expect(getByTestId('lesson-task-bar-full-text-text').textContent).toBe(
                'マウスでネコにさわったら「くすぐったい！」、\nさわっていないときは「さわってみて」と言うようにしよう',
            );
        });

        test('joins English lines with a space in the bar', () => {
            const { getByTestId } = renderBar({ challengeId: 'blocks-l1-if' });
            expect(getByTestId('lesson-task-bar-task').textContent).toBe(
                'Make the cat say "That tickles!" when the mouse touches it, and "Touch me" when it does not',
            );
        });

        test('shows the image of the challenge with its alt text', () => {
            const { getByTestId } = renderBar({ challengeId: 'blocks-l1-arrow-move' });
            hover(getByTestId('lesson-task-bar'));
            const image = getByTestId('lesson-task-bar-full-text-image');
            expect(image.tagName).toBe('IMG');
            expect(image).toHaveAttribute(
                'alt',
                'The up arrow key moves the cat up, and the down arrow key moves it down',
            );
        });

        test('shows no image for a challenge without one', () => {
            const { getByTestId, queryByTestId } = renderBar({ challengeId: 'blocks-l1-key-sound' });
            hover(getByTestId('lesson-task-bar'));
            expect(getByTestId('lesson-task-bar-full-text')).toBeInTheDocument();
            expect(queryByTestId('lesson-task-bar-full-text-image')).toBeNull();
        });

        test('does not open on a touch "hover" and a mouse click does not pin it', () => {
            const { getByTestId, queryByTestId } = renderBar();
            pointer(getByTestId('lesson-task-bar'), 'pointerover', 'touch');
            expect(queryByTestId('lesson-task-bar-full-text')).toBeNull();
            // マウスで押しても開いたままにはならない（離せば消える）
            hover(getByTestId('lesson-task-bar'));
            pointer(getByTestId('lesson-task-bar-task'), 'pointerdown', 'mouse');
            fireEvent.click(getByTestId('lesson-task-bar-task'));
            unhover(getByTestId('lesson-task-bar'));
            expect(queryByTestId('lesson-task-bar-full-text')).toBeNull();
        });

        test('opens with a tap on the task and closes with another tap (SP)', () => {
            const { getByTestId, queryByTestId } = renderBar();
            const task = getByTestId('lesson-task-bar-task');
            tap(task);
            expect(getByTestId('lesson-task-bar-full-text')).toBeInTheDocument();
            expect(task).toHaveAttribute('aria-expanded', 'true');
            expect(task).toHaveAttribute('aria-controls', getByTestId('lesson-task-bar-full-text').id);
            tap(task);
            expect(queryByTestId('lesson-task-bar-full-text')).toBeNull();
            expect(task).toHaveAttribute('aria-expanded', 'false');
        });

        test('a tapped panel closes by pressing outside or Escape, not by pressing inside', () => {
            const { getByTestId, queryByTestId } = renderBar();
            tap(getByTestId('lesson-task-bar-task'));
            fireEvent.pointerDown(getByTestId('lesson-task-bar-full-text'));
            expect(getByTestId('lesson-task-bar-full-text')).toBeInTheDocument();
            fireEvent.pointerDown(document.body);
            expect(queryByTestId('lesson-task-bar-full-text')).toBeNull();
            tap(getByTestId('lesson-task-bar-task'));
            fireEvent.keyDown(document, { key: 'Escape' });
            expect(queryByTestId('lesson-task-bar-full-text')).toBeNull();
        });

        const barWith = (extra, handlers) => {
            const { challenge, lesson } = findChallenge('blocks-l1-click-say');
            return (
                <IntlProvider locale="en" messages={en}>
                    <LessonTaskBar
                        challenge={challenge}
                        challengeCount={lesson.challenges.length}
                        hintAvailable
                        onHint={handlers.onHint}
                        onQuit={handlers.onQuit}
                        {...extra}
                    />
                </IntlProvider>
            );
        };

        test('closes a tapped panel when the hint balloon or the "You did it!" toast shows', () => {
            const { getByTestId, queryByTestId, rerender, onHint, onQuit } = renderBar();
            const bar = (extra) => barWith(extra, { onHint, onQuit });
            tap(getByTestId('lesson-task-bar-task'));
            rerender(bar({ hintVisible: true }));
            expect(queryByTestId('lesson-task-bar-full-text')).toBeNull();
            rerender(bar({ hintVisible: false }));
            // 吹き出しが閉じても、閉じたパネルは勝手に開き直さない
            expect(queryByTestId('lesson-task-bar-full-text')).toBeNull();
            tap(getByTestId('lesson-task-bar-task'));
            expect(getByTestId('lesson-task-bar-full-text')).toBeInTheDocument();
            rerender(bar({ toastVisible: true }));
            expect(queryByTestId('lesson-task-bar-full-text')).toBeNull();
        });

        test('shows the whole task on hover even while the hint balloon is open', () => {
            const { getByTestId, queryByTestId, onHint, onQuit } = renderBar({ hintVisible: true });
            hover(getByTestId('lesson-task-bar'));
            expect(getByTestId('lesson-task-bar-full-text')).toBeInTheDocument();
            expect(getByTestId('lesson-task-bar-task')).toHaveAttribute('aria-expanded', 'true');
            // 吹き出しには触らない（閉じるよう頼まない）
            expect(onHint).not.toHaveBeenCalled();
            expect(onQuit).not.toHaveBeenCalled();
            unhover(getByTestId('lesson-task-bar'));
            expect(queryByTestId('lesson-task-bar-full-text')).toBeNull();
        });

        test('hides the hover panel when the hint balloon is opened from the bar, until the mouse comes back', () => {
            const { getByTestId, queryByTestId, rerender, onHint, onQuit } = renderBar();
            const bar = (extra) => barWith(extra, { onHint, onQuit });
            hover(getByTestId('lesson-task-bar'));
            expect(getByTestId('lesson-task-bar-full-text')).toBeInTheDocument();
            rerender(bar({ hintVisible: true }));
            expect(queryByTestId('lesson-task-bar-full-text')).toBeNull();
            unhover(getByTestId('lesson-task-bar'));
            hover(getByTestId('lesson-task-bar'));
            expect(getByTestId('lesson-task-bar-full-text')).toBeInTheDocument();
        });

        test('does not open on hover while the "You did it!" toast shows', () => {
            const { getByTestId, queryByTestId } = renderBar({ toastVisible: true });
            hover(getByTestId('lesson-task-bar'));
            expect(queryByTestId('lesson-task-bar-full-text')).toBeNull();
        });

        test('a tap while the hint balloon is open asks to close the balloon and opens the panel', () => {
            const onOpenFullText = jest.fn();
            const { getByTestId, rerender, onHint, onQuit } = renderBar({ hintVisible: true, onOpenFullText });
            tap(getByTestId('lesson-task-bar-task'));
            expect(onOpenFullText).toHaveBeenCalledTimes(1);
            // 親（lesson-mode）が吹き出しを閉じる
            rerender(barWith({ hintVisible: false, onOpenFullText }, { onHint, onQuit }));
            expect(getByTestId('lesson-task-bar-full-text')).toBeInTheDocument();
            // タップで開いたので、マウスが離れても開いたまま
            unhover(getByTestId('lesson-task-bar'));
            expect(getByTestId('lesson-task-bar-full-text')).toBeInTheDocument();
        });

        test('asks to close the hint and the toast when it is opened with a tap', () => {
            const onOpenFullText = jest.fn();
            const { getByTestId } = renderBar({ onOpenFullText });
            tap(getByTestId('lesson-task-bar-task'));
            expect(onOpenFullText).toHaveBeenCalledTimes(1);
            // 閉じるときは呼ばない
            tap(getByTestId('lesson-task-bar-task'));
            expect(onOpenFullText).toHaveBeenCalledTimes(1);
        });

        test('closes a tapped panel when the challenge changes', () => {
            const { getByTestId, queryByTestId, rerender } = renderBar();
            tap(getByTestId('lesson-task-bar-task'));
            const { challenge, lesson } = findChallenge('blocks-l1-if');
            rerender(
                <IntlProvider locale="en" messages={en}>
                    <LessonTaskBar
                        challenge={challenge}
                        challengeCount={lesson.challenges.length}
                        hintAvailable
                        onHint={jest.fn()}
                        onQuit={jest.fn()}
                    />
                </IntlProvider>,
            );
            expect(queryByTestId('lesson-task-bar-full-text')).toBeNull();
        });
    });
});
