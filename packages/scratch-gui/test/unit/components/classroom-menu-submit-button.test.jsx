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
        expect(store.getActions()).toEqual([{ type: 'scratch-gui/classroom/REQUEST_STUDENT_SUBMIT' }]);
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
        expect(store.getActions()).toEqual([{ type: 'scratch-gui/classroom/REQUEST_STUDENT_SUBMIT' }]);
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
