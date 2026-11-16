/* eslint-env jest */
/**
 * エディタの上の「戻る帯」(#1990)。
 *
 * - 先生がクラス管理から開いた作品がある間、出席番号と課題名と［‹ 採点に戻る］/［‹ 課題に戻る］を出す。
 * - ［戻る］はクラス管理を開く（中身は隠して残してあるので、元の画面に戻る）。
 * - ほかの作品を読み込む・新しく作る（ランタイムの PROJECT_LOADED）と消える。
 */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import EventEmitter from 'events';
import React from 'react';
import { IntlProvider } from 'react-intl';
import { Provider } from 'react-redux';
import { combineReducers, createStore } from 'redux';
import ClassroomTeacherWorkBar from '../../../src/containers/classroom-teacher-work-bar.jsx';
import classroomReducer, {
    closeTeacherModal,
    setTeacherLoggedIn,
    setTeacherOpenedWork,
} from '../../../src/reducers/classroom.js';

const renderBar = (work) => {
    const runtime = new EventEmitter();
    const vm = { runtime };
    const store = createStore(
        combineReducers({ scratchGui: combineReducers({ classroom: classroomReducer, vm: (s = vm) => s }) }),
    );
    store.dispatch(setTeacherLoggedIn(true));
    render(
        <Provider store={store}>
            <IntlProvider locale="en">
                <ClassroomTeacherWorkBar />
            </IntlProvider>
        </Provider>,
    );
    if (work) {
        act(() => {
            store.dispatch(closeTeacherModal());
            store.dispatch(setTeacherOpenedWork(work));
        });
    }
    return { store, runtime };
};

const bar = () => screen.queryByTestId('classroom-teacher-work-bar');

describe('ClassroomTeacherWorkBar (#1990)', () => {
    test('開いた作品が無ければ出さない', () => {
        renderBar(null);
        expect(bar()).toBeNull();
    });

    test('採点から開いたら、出席番号と課題名と［‹ Back to grading］', () => {
        renderBar({ from: 'evaluation', seatNumber: 3, assignmentName: '迷路' });
        expect(screen.getByTestId('classroom-teacher-work-bar-text')).toHaveTextContent(
            'Viewing the work of seat 3 · 迷路',
        );
        expect(screen.getByTestId('classroom-teacher-work-bar-back')).toHaveTextContent('‹ Back to grading');
    });

    test('課題の詳細から開いたら［‹ Back to the assignment］', () => {
        renderBar({ from: 'assignment', seatNumber: 5, assignmentName: '迷路' });
        expect(screen.getByTestId('classroom-teacher-work-bar-back')).toHaveTextContent('‹ Back to the assignment');
    });

    test('ログインが切れたら、帯を残したままログインし直すよう知らせる', () => {
        const { store } = renderBar({ from: 'evaluation', seatNumber: 3, assignmentName: '迷路' });
        expect(screen.queryByTestId('classroom-teacher-work-bar-expired')).toBeNull();
        act(() => store.dispatch(setTeacherLoggedIn(false)));
        expect(bar()).not.toBeNull();
        expect(screen.getByTestId('classroom-teacher-work-bar-expired')).toHaveTextContent('log in again');
    });

    test('［戻る］でクラス管理を開き、帯は消える', () => {
        const { store } = renderBar({ from: 'evaluation', seatNumber: 3, assignmentName: '迷路' });
        fireEvent.click(screen.getByTestId('classroom-teacher-work-bar-back'));
        expect(store.getState().scratchGui.classroom.teacherModalVisible).toBe(true);
        expect(bar()).toBeNull();
    });

    test('ほかの作品を読み込む・新しく作ると消える', () => {
        const { store, runtime } = renderBar({ from: 'evaluation', seatNumber: 3, assignmentName: '迷路' });
        act(() => runtime.emit('PROJECT_LOADED'));
        expect(store.getState().scratchGui.classroom.teacherOpenedWork).toBeNull();
        expect(bar()).toBeNull();
        expect(runtime.listenerCount('PROJECT_LOADED')).toBe(0);
    });
});
