/* eslint-env jest */
/**
 * クラス管理は、いちど開いたら閉じても隠して残す (#1990)。
 *
 * 作品を開くとクラス管理は閉じる。そこで外すと、選んでいたクラス・課題・タブ・席と採点の
 * 下書き（container の hooks の state）が消える。いちど開いたあとはログインしている間は
 * 残し、開き直すと同じ state のまま出す。ログアウトで外す（次の先生は最初から）。
 */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { combineReducers, createStore } from 'redux';
import ClassroomTeacherModalHost from '../../../src/containers/classroom-teacher-modal-host.jsx';
import classroomReducer, {
    closeTeacherModal,
    openTeacherModal,
    setTeacherLoggedIn,
    teacherLoggedOut,
} from '../../../src/reducers/classroom.js';

let mockMounts = 0;
jest.mock('../../../src/containers/classroom-teacher-modal.jsx', () => {
    const { useState } = jest.requireActual('react');
    const PropTypes = jest.requireActual('prop-types');
    const MockModal = ({ visible }) => {
        // 先生の画面の state（いた画面・採点の下書き）の代わり。
        const [draft, setDraft] = useState(() => {
            mockMounts += 1;
            return '';
        });
        if (!visible) return null;
        return (
            <div>
                <span data-testid="draft">{draft}</span>
                <button data-testid="write" onClick={() => setDraft('採点: A')} />
            </div>
        );
    };
    MockModal.propTypes = { visible: PropTypes.bool };
    return { __esModule: true, default: MockModal };
});

const renderHost = () => {
    const store = createStore(combineReducers({ scratchGui: combineReducers({ classroom: classroomReducer }) }));
    render(
        <Provider store={store}>
            <ClassroomTeacherModalHost />
        </Provider>,
    );
    return store;
};

beforeEach(() => {
    mockMounts = 0;
});

describe('ClassroomTeacherModalHost (#1990)', () => {
    test('開くまでは何も置かない', () => {
        renderHost();
        expect(mockMounts).toBe(0);
    });

    test('閉じて開き直しても、前の state（下書き）のまま出す', () => {
        const store = renderHost();
        act(() => {
            store.dispatch(setTeacherLoggedIn(true));
            store.dispatch(openTeacherModal());
        });
        fireEvent.click(screen.getByTestId('write'));
        act(() => store.dispatch(closeTeacherModal()));
        expect(screen.queryByTestId('draft')).toBeNull();
        act(() => store.dispatch(openTeacherModal()));
        expect(screen.getByTestId('draft')).toHaveTextContent('採点: A');
        expect(mockMounts).toBe(1);
    });

    test('ログアウトしたら外し、次に開くと最初から', () => {
        const store = renderHost();
        act(() => {
            store.dispatch(setTeacherLoggedIn(true));
            store.dispatch(openTeacherModal());
        });
        fireEvent.click(screen.getByTestId('write'));
        act(() => {
            store.dispatch(closeTeacherModal());
            store.dispatch(setTeacherLoggedIn(false));
            store.dispatch(teacherLoggedOut());
        });
        act(() => store.dispatch(openTeacherModal()));
        expect(screen.getByTestId('draft')).toHaveTextContent('');
        expect(mockMounts).toBe(2);
    });

    test('隠れている間にログインが切れても外さない（下書きはログインし直すまで残す）', () => {
        const store = renderHost();
        act(() => {
            store.dispatch(setTeacherLoggedIn(true));
            store.dispatch(openTeacherModal());
        });
        fireEvent.click(screen.getByTestId('write'));
        act(() => store.dispatch(closeTeacherModal()));
        act(() => store.dispatch(setTeacherLoggedIn(false)));
        act(() => store.dispatch(openTeacherModal()));
        expect(screen.getByTestId('draft')).toHaveTextContent('採点: A');
        expect(mockMounts).toBe(1);
    });

    test('開いているときのログアウトでは外さない（ログインの画面を出したまま）', () => {
        const store = renderHost();
        act(() => {
            store.dispatch(setTeacherLoggedIn(true));
            store.dispatch(openTeacherModal());
        });
        act(() => store.dispatch(teacherLoggedOut()));
        expect(screen.getByTestId('draft')).toBeInTheDocument();
        expect(mockMounts).toBe(1);
    });
});
