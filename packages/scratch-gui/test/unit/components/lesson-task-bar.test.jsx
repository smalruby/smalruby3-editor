/* eslint-env jest */
import '@testing-library/jest-dom';
import { act, fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import LessonTaskBar from '../../../src/components/lesson-task-bar/lesson-task-bar.jsx';
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
        expect(getByTestId('lesson-task-bar-quit')).toHaveTextContent('やめる');
        expect(getByTestId('lesson-task-bar-hint')).toHaveTextContent('ヒント');
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
        // jsdom はレイアウトしないので、課題の文の幅を決めて「切れている / 切れていない」を作る
        let scrollWidth;
        let clientWidth;
        let restore;
        beforeEach(() => {
            scrollWidth = 0;
            clientWidth = 0;
            const proto = window.HTMLElement.prototype;
            const isTask = (el) => el.getAttribute && el.getAttribute('data-testid') === 'lesson-task-bar-task';
            Object.defineProperty(proto, 'scrollWidth', {
                configurable: true,
                get() {
                    return isTask(this) ? scrollWidth : 0;
                },
            });
            Object.defineProperty(proto, 'clientWidth', {
                configurable: true,
                get() {
                    return isTask(this) ? clientWidth : 0;
                },
            });
            // jsdom の本物は Element.prototype にあるので、上書きを消せば元にもどる
            restore = () => {
                delete proto.scrollWidth;
                delete proto.clientWidth;
            };
        });
        afterEach(() => restore());

        test('cannot be opened when the task fits', () => {
            scrollWidth = 200;
            clientWidth = 300;
            const { getByTestId, queryByTestId } = renderBar();
            expect(getByTestId('lesson-task-bar-task')).toHaveAttribute('data-truncated', 'false');
            expect(queryByTestId('lesson-task-bar-full-text-toggle')).toBeNull();
            fireEvent.click(getByTestId('lesson-task-bar-task'));
            expect(queryByTestId('lesson-task-bar-full-text')).toBeNull();
        });

        test('opens and closes with the "Read all" button when the task is cut off', () => {
            scrollWidth = 600;
            clientWidth = 300;
            const { getByTestId, queryByTestId } = renderBar();
            const toggle = getByTestId('lesson-task-bar-full-text-toggle');
            expect(toggle).toHaveTextContent('Read all');
            expect(toggle).toHaveAttribute('aria-expanded', 'false');
            fireEvent.click(toggle);
            expect(toggle).toHaveAttribute('aria-expanded', 'true');
            expect(getByTestId('lesson-task-bar-full-text')).toHaveTextContent(
                'Add a costume you like to the cat, and make it say "Hello!" and change its look when it is clicked',
            );
            expect(toggle).toHaveAttribute('aria-controls', getByTestId('lesson-task-bar-full-text').id);
            fireEvent.click(toggle);
            expect(queryByTestId('lesson-task-bar-full-text')).toBeNull();
        });

        test('opens by pressing the task line, closes by pressing outside or Escape', () => {
            scrollWidth = 600;
            clientWidth = 300;
            const { getByTestId, queryByTestId } = renderBar();
            fireEvent.click(getByTestId('lesson-task-bar-task'));
            expect(getByTestId('lesson-task-bar-full-text')).toBeInTheDocument();
            // パネルの中を押しても閉じない
            fireEvent.pointerDown(getByTestId('lesson-task-bar-full-text'));
            expect(getByTestId('lesson-task-bar-full-text')).toBeInTheDocument();
            fireEvent.pointerDown(document.body);
            expect(queryByTestId('lesson-task-bar-full-text')).toBeNull();
            fireEvent.click(getByTestId('lesson-task-bar-task'));
            fireEvent.keyDown(document, { key: 'Escape' });
            expect(queryByTestId('lesson-task-bar-full-text')).toBeNull();
        });

        test('closes when the task fits again after a resize', () => {
            scrollWidth = 600;
            clientWidth = 300;
            const { getByTestId, queryByTestId } = renderBar();
            fireEvent.click(getByTestId('lesson-task-bar-full-text-toggle'));
            expect(getByTestId('lesson-task-bar-full-text')).toBeInTheDocument();
            clientWidth = 700;
            act(() => {
                window.dispatchEvent(new Event('resize'));
            });
            expect(queryByTestId('lesson-task-bar-full-text')).toBeNull();
            expect(queryByTestId('lesson-task-bar-full-text-toggle')).toBeNull();
        });

        describe('when fonts load', () => {
            // フォントが測ったあとに読み込まれると、文の幅だけが変わり要素の大きさは変わらない
            // （resize も ResizeObserver も来ない）。document.fonts の読み込みで測り直す
            let resolveReady;
            const makeFonts = () => {
                const fonts = new EventTarget();
                fonts.ready = new Promise((resolve) => {
                    resolveReady = resolve;
                });
                return fonts;
            };
            const setFonts = (value) => Object.defineProperty(document, 'fonts', { configurable: true, value });
            afterEach(() => {
                delete document.fonts;
            });

            test('measures again when a font finishes loading', () => {
                const fonts = makeFonts();
                setFonts(fonts);
                scrollWidth = 200;
                clientWidth = 300;
                const { getByTestId, queryByTestId } = renderBar();
                expect(getByTestId('lesson-task-bar-task')).toHaveAttribute('data-truncated', 'false');
                scrollWidth = 600;
                act(() => {
                    fonts.dispatchEvent(new Event('loadingdone'));
                });
                expect(getByTestId('lesson-task-bar-task')).toHaveAttribute('data-truncated', 'true');
                expect(queryByTestId('lesson-task-bar-full-text-toggle')).not.toBeNull();
            });

            test('measures again when document.fonts.ready resolves', async () => {
                setFonts(makeFonts());
                scrollWidth = 200;
                clientWidth = 300;
                const { getByTestId } = renderBar();
                expect(getByTestId('lesson-task-bar-task')).toHaveAttribute('data-truncated', 'false');
                scrollWidth = 600;
                await act(async () => {
                    resolveReady();
                    await Promise.resolve();
                });
                expect(getByTestId('lesson-task-bar-task')).toHaveAttribute('data-truncated', 'true');
            });

            test('stops listening to the fonts when it goes away', () => {
                const fonts = makeFonts();
                setFonts(fonts);
                const removeSpy = jest.spyOn(fonts, 'removeEventListener');
                const { unmount } = renderBar();
                unmount();
                expect(removeSpy).toHaveBeenCalledWith('loadingdone', expect.any(Function));
            });

            test('works where there is no document.fonts', () => {
                setFonts(undefined);
                scrollWidth = 600;
                clientWidth = 300;
                const { getByTestId, unmount } = renderBar();
                expect(getByTestId('lesson-task-bar-task')).toHaveAttribute('data-truncated', 'true');
                expect(() => unmount()).not.toThrow();
            });
        });

        test('closes when the hint balloon or the "You did it!" toast shows', () => {
            scrollWidth = 600;
            clientWidth = 300;
            const { getByTestId, queryByTestId, rerender, onHint, onQuit } = renderBar();
            const { challenge, lesson } = findChallenge('blocks-l1-click-say');
            const bar = (extra) => (
                <IntlProvider locale="en" messages={en}>
                    <LessonTaskBar
                        challenge={challenge}
                        challengeCount={lesson.challenges.length}
                        hintAvailable
                        onHint={onHint}
                        onQuit={onQuit}
                        {...extra}
                    />
                </IntlProvider>
            );
            fireEvent.click(getByTestId('lesson-task-bar-full-text-toggle'));
            rerender(bar({ hintVisible: true }));
            expect(queryByTestId('lesson-task-bar-full-text')).toBeNull();
            rerender(bar({ hintVisible: false }));
            fireEvent.click(getByTestId('lesson-task-bar-full-text-toggle'));
            expect(getByTestId('lesson-task-bar-full-text')).toBeInTheDocument();
            rerender(bar({ toastVisible: true }));
            expect(queryByTestId('lesson-task-bar-full-text')).toBeNull();
        });

        test('asks to close the hint and the toast when it opens', () => {
            scrollWidth = 600;
            clientWidth = 300;
            const onOpenFullText = jest.fn();
            const { getByTestId } = renderBar({ onOpenFullText });
            fireEvent.click(getByTestId('lesson-task-bar-full-text-toggle'));
            expect(onOpenFullText).toHaveBeenCalledTimes(1);
            // 閉じるときは呼ばない
            fireEvent.click(getByTestId('lesson-task-bar-full-text-toggle'));
            expect(onOpenFullText).toHaveBeenCalledTimes(1);
        });

        test('uses the Japanese label', () => {
            scrollWidth = 600;
            clientWidth = 300;
            const { getByTestId } = renderBar({}, { locale: 'ja', messages: ja });
            expect(getByTestId('lesson-task-bar-full-text-toggle')).toHaveTextContent('全文');
            expect(getByTestId('lesson-task-bar-full-text-toggle')).toHaveAttribute('aria-label', '課題の全文を見る');
        });
    });
});
