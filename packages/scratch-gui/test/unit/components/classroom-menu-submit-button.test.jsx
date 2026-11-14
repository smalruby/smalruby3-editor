/* eslint-env jest */
/**
 * メニューバーの「提出する」ボタン (#1795)。参加中はいつも出し、未提出はオレンジの「提出する」、
 * 提出済み・返却済みは緑の「提出済み ✓」「返却済み ✓」。押すと提出確認を開く。
 */
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import ClassroomMenuSubmitButton, {
    ClassroomMenuSubmitButtonView,
} from '../../../src/components/classroom-modal/classroom-menu-submit-button.jsx';

const withIntl = (node) => render(<IntlProvider locale="en">{node}</IntlProvider>);

describe('ClassroomMenuSubmitButtonView', () => {
    test.each([
        ['submit', 'Submit'],
        ['submitted', 'Submitted ✓'],
        ['returned', 'Returned ✓'],
    ])('%s は「%s」で data-kind を持つ', (kind, text) => {
        const { getByTestId } = withIntl(<ClassroomMenuSubmitButtonView kind={kind} onClick={jest.fn()} />);
        const button = getByTestId('classroom-menu-submit');
        expect(button).toHaveTextContent(text);
        expect(button).toHaveAttribute('data-kind', kind);
        expect(button.tagName).toBe('BUTTON');
    });

    test('提出済み・返却済みは「もう一度提出する」と読み上げる (押すと再提出の流れ)', () => {
        const { getByTestId, rerender } = withIntl(
            <ClassroomMenuSubmitButtonView kind="submitted" onClick={jest.fn()} />,
        );
        expect(getByTestId('classroom-menu-submit')).toHaveAttribute('title', 'Submit again');
        rerender(
            <IntlProvider locale="en">
                <ClassroomMenuSubmitButtonView kind="submit" onClick={jest.fn()} />
            </IntlProvider>,
        );
        expect(getByTestId('classroom-menu-submit')).not.toHaveAttribute('title');
    });

    test('押すと onClick (メニューバーのクラスのボタンには伝えない)', () => {
        const onClick = jest.fn();
        const parent = jest.fn();
        const { getByTestId } = withIntl(
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
            <div onClick={parent}>
                <ClassroomMenuSubmitButtonView kind="submit" onClick={onClick} />
            </div>,
        );
        fireEvent.click(getByTestId('classroom-menu-submit'));
        expect(onClick).toHaveBeenCalledTimes(1);
        expect(parent).not.toHaveBeenCalled();
    });
});

// #1795 Q1: 送信中は押せない（二重の提出を防ぐ）。
describe('ClassroomMenuSubmitButtonView — 送信中', () => {
    test('押せず、字は「提出中...」', () => {
        const onClick = jest.fn();
        const { getByTestId } = withIntl(
            <ClassroomMenuSubmitButtonView kind="submit" submitting onClick={onClick} />,
        );
        const button = getByTestId('classroom-menu-submit');
        expect(button).toBeDisabled();
        expect(button).toHaveTextContent('Submitting...');
        expect(button).toHaveAttribute('aria-busy', 'true');
        fireEvent.click(button);
        expect(onClick).not.toHaveBeenCalled();
    });

    test('スマホのドロワーに置く版は data-placement="drawer"', () => {
        const { getByTestId } = withIntl(
            <ClassroomMenuSubmitButtonView kind="submitted" placement="drawer" onClick={jest.fn()} />,
        );
        expect(getByTestId('classroom-menu-submit')).toHaveAttribute('data-placement', 'drawer');
    });
});

describe('ClassroomMenuSubmitButton (connected)', () => {
    const buildStore = (classroom, progress = {}) =>
        configureStore()({
            scratchGui: {
                classroom: {
                    role: 'student',
                    sessionToken: 'tok',
                    seatNumber: 3,
                    submissionStatus: null,
                    studentLesson: null,
                    ...classroom,
                },
                lessonMode: { progress },
            },
        });

    const renderWith = (store) =>
        render(
            <Provider store={store}>
                <IntlProvider locale="en">
                    <ClassroomMenuSubmitButton />
                </IntlProvider>
            </Provider>,
        );

    test('参加していなければ何も出さない', () => {
        const { queryByTestId } = renderWith(buildStore({ role: null, sessionToken: null, seatNumber: null }));
        expect(queryByTestId('classroom-menu-submit')).toBeNull();
    });

    test('参加中で未提出ならオレンジの「提出する」。押すと提出確認をお願いする', () => {
        const store = buildStore({});
        const { getByTestId } = renderWith(store);
        expect(getByTestId('classroom-menu-submit')).toHaveAttribute('data-kind', 'submit');
        fireEvent.click(getByTestId('classroom-menu-submit'));
        expect(store.getActions()).toEqual([
            { type: 'scratch-gui/classroom/REQUEST_STUDENT_SUBMIT', from: 'menu_bar' },
        ]);
    });

    test('送信中 (studentSubmitting) は押せない', () => {
        const store = buildStore({ studentSubmitting: true });
        const { getByTestId } = renderWith(store);
        expect(getByTestId('classroom-menu-submit')).toBeDisabled();
        fireEvent.click(getByTestId('classroom-menu-submit'));
        expect(store.getActions()).toEqual([]);
    });

    test('押したあとに onAfterClick を呼ぶ (ドロワーを閉じる)', () => {
        const store = buildStore({});
        const onAfterClick = jest.fn();
        const { getByTestId } = render(
            <Provider store={store}>
                <IntlProvider locale="en">
                    <ClassroomMenuSubmitButton placement="drawer" onAfterClick={onAfterClick} />
                </IntlProvider>
            </Provider>,
        );
        fireEvent.click(getByTestId('classroom-menu-submit'));
        expect(store.getActions()).toEqual([
            { type: 'scratch-gui/classroom/REQUEST_STUDENT_SUBMIT', from: 'drawer' },
        ]);
        expect(onAfterClick).toHaveBeenCalledTimes(1);
    });

    test('返却済みなら「返却済み ✓」', () => {
        const { getByTestId } = renderWith(buildStore({ submissionStatus: 'returned' }));
        expect(getByTestId('classroom-menu-submit')).toHaveAttribute('data-kind', 'returned');
    });

    test('作品を提出しないレッスンの課題では出さない', () => {
        const studentLesson = {
            courseId: 'c',
            challengeIds: [],
            requiredChallengeIds: [],
            completion: { type: 'all', count: 0 },
            submitWork: false,
        };
        const { queryByTestId } = renderWith(buildStore({ studentLesson }));
        expect(queryByTestId('classroom-menu-submit')).toBeNull();
    });
});

// #1835: 時間がたっても出していない生徒に「提出しよう」の吹き出しを出す。
describe('ClassroomMenuSubmitButton — 「提出しよう」の吹き出し', () => {
    const DISMISS = 'scratch-gui/classroom/DISMISS_SUBMIT_REMINDER';
    const buildStore = (classroom) =>
        configureStore()({
            scratchGui: {
                classroom: {
                    role: 'student',
                    sessionToken: 'tok',
                    seatNumber: 3,
                    submissionStatus: null,
                    studentLesson: null,
                    submitReminderVisible: true,
                    ...classroom,
                },
                lessonMode: { progress: {} },
            },
        });
    const renderWith = (store, placement = 'menu-bar') =>
        render(
            <Provider store={store}>
                <IntlProvider locale="en">
                    <div>
                        <ClassroomMenuSubmitButton placement={placement} />
                        <button data-testid="elsewhere" type="button">
                            other
                        </button>
                    </div>
                </IntlProvider>
            </Provider>,
        );

    // jsdom は配置を持たないので、吹き出しが見えている（箱がある）ことにする。
    let rects;
    let box;
    beforeEach(() => {
        rects = jest.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{}]);
        box = jest
            .spyOn(Element.prototype, 'getBoundingClientRect')
            .mockReturnValue({ left: 10, right: 100, top: 60, bottom: 100, width: 90, height: 40 });
    });
    afterEach(() => {
        rects.mockRestore();
        box.mockRestore();
    });

    test('出す時なら「提出する」の下に文言と × を出す', () => {
        const { getByTestId } = renderWith(buildStore({}));
        const balloon = getByTestId('classroom-submit-reminder');
        expect(balloon).toHaveTextContent('Ready to hand in your work? You can send it again later.');
        expect(balloon).toHaveAttribute('data-placement', 'menu-bar');
        expect(getByTestId('classroom-submit-reminder-close')).toHaveAttribute('aria-label', 'Close');
    });

    test('出す時でなければ出さない', () => {
        const { queryByTestId } = renderWith(buildStore({ submitReminderVisible: false }));
        expect(queryByTestId('classroom-submit-reminder')).toBeNull();
    });

    test.each(['submitted', 'returned'])('提出済み・返却済み（%s）では出さない', (submissionStatus) => {
        const { queryByTestId } = renderWith(buildStore({ submissionStatus }));
        expect(queryByTestId('classroom-submit-reminder')).toBeNull();
    });

    test('作品を出さないレッスンの課題ではボタンも吹き出しも出さない', () => {
        const { queryByTestId } = renderWith(
            buildStore({
                studentLesson: {
                    courseId: 'c',
                    challengeIds: [],
                    requiredChallengeIds: [],
                    completion: { type: 'all', count: 0 },
                    submitWork: false,
                },
            }),
        );
        expect(queryByTestId('classroom-menu-submit')).toBeNull();
        expect(queryByTestId('classroom-submit-reminder')).toBeNull();
    });

    test('× で消す（クラスの画面は開かない）', () => {
        const store = buildStore({});
        const { getByTestId } = renderWith(store);
        fireEvent.click(getByTestId('classroom-submit-reminder-close'));
        expect(store.getActions()).toEqual([{ type: DISMISS, reason: 'close' }]);
    });

    test('ほかの場所を押すと消す', () => {
        const store = buildStore({});
        const { getByTestId } = renderWith(store);
        fireEvent.pointerDown(getByTestId('elsewhere'));
        expect(store.getActions()).toEqual([{ type: DISMISS, reason: 'outside' }]);
    });

    test('「提出する」をマウスで押すと、pointerdown の時点で「提出する」を理由に消す', () => {
        const store = buildStore({});
        const { getByTestId } = renderWith(store);
        fireEvent.pointerDown(getByTestId('classroom-menu-submit'));
        expect(store.getActions()).toEqual([{ type: DISMISS, reason: 'submit' }]);
    });

    test('「提出する」をキーボードで押しても（pointerdown 無し）、消して提出確認を開く', () => {
        const store = buildStore({});
        const { getByTestId } = renderWith(store);
        fireEvent.click(getByTestId('classroom-menu-submit'));
        expect(store.getActions()).toEqual([
            { type: DISMISS, reason: 'submit' },
            { type: 'scratch-gui/classroom/REQUEST_STUDENT_SUBMIT', from: 'menu_bar' },
        ]);
    });

    test('吹き出しが出ていないときに「提出する」を押しても、消したことにはしない', () => {
        const store = buildStore({ submitReminderVisible: false });
        const { getByTestId } = renderWith(store);
        fireEvent.click(getByTestId('classroom-menu-submit'));
        expect(store.getActions()).toEqual([
            { type: 'scratch-gui/classroom/REQUEST_STUDENT_SUBMIT', from: 'menu_bar' },
        ]);
    });

    test('下へ 56px ずらしても操作に重なるなら、吹き出しの代わりに「提出する」の右上へ点を出す', () => {
        box.mockImplementation(function () {
            if (this.getAttribute('data-testid') === 'elsewhere') {
                return { left: 0, right: 1300, top: 40, bottom: 600, width: 1300, height: 560 };
            }
            return { left: 10, right: 100, top: 8, bottom: 40, width: 90, height: 32 };
        });
        // 吹き出しを置く範囲を調べる elementsFromPoint は、どの点でも「ほかの場所」のボタンを返す。
        const original = document.elementsFromPoint;
        document.elementsFromPoint = () => [document.querySelector('[data-testid="elsewhere"]')].filter(Boolean);
        const store = buildStore({});
        let rendered;
        try {
            rendered = renderWith(store);
        } finally {
            document.elementsFromPoint = original;
        }
        const { getByTestId, queryByTestId } = rendered;
        expect(queryByTestId('classroom-submit-reminder')).toBeNull();
        const dot = getByTestId('classroom-submit-reminder-dot');
        expect(dot).toHaveTextContent('Ready to hand in your work? You can send it again later.');
        fireEvent.pointerDown(getByTestId('elsewhere'));
        expect(store.getActions()).toEqual([{ type: DISMISS, reason: 'outside' }]);
    });

    test('吹き出しの中を押しても消さない', () => {
        const store = buildStore({});
        const { getByTestId } = renderWith(store);
        fireEvent.pointerDown(getByTestId('classroom-submit-reminder'));
        expect(store.getActions()).toEqual([]);
    });

    test('見えていない吹き出し（スマホで隠れたメニューバー側）は、外を押しても何もしない', () => {
        rects.mockReturnValue([]);
        const store = buildStore({});
        const { getByTestId } = renderWith(store);
        fireEvent.pointerDown(getByTestId('elsewhere'));
        expect(store.getActions()).toEqual([]);
    });

    test('画面の外にある吹き出し（閉じたドロワーの中など）は、外を押しても何もしない', () => {
        box.mockReturnValue({ left: -320, right: -10, top: 60, bottom: 100, width: 310, height: 40 });
        const store = buildStore({});
        const { getByTestId } = renderWith(store);
        fireEvent.pointerDown(getByTestId('elsewhere'));
        expect(store.getActions()).toEqual([]);
    });

    test('ドロワーが閉じている（reminderAllowed=false）ときは吹き出しを描かない', () => {
        const { queryByTestId } = render(
            <Provider store={buildStore({})}>
                <IntlProvider locale="en">
                    <ClassroomMenuSubmitButton placement="drawer" reminderAllowed={false} />
                </IntlProvider>
            </Provider>,
        );
        expect(queryByTestId('classroom-menu-submit')).not.toBeNull();
        expect(queryByTestId('classroom-submit-reminder')).toBeNull();
    });

    test('スマホのドロワーでは data-placement="drawer" で出す', () => {
        const { getByTestId } = renderWith(buildStore({}), 'drawer');
        expect(getByTestId('classroom-submit-reminder')).toHaveAttribute('data-placement', 'drawer');
    });
});
