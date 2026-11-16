/* eslint-env jest */
/**
 * 生徒の作品を開く前の確認（#1983）。先生自身の作品か、前に開いた生徒の作品の上の変更かで文を変える。
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import TeacherOpenWorkConfirm from '../../../src/components/classroom-teacher-modal/teacher-open-work-confirm.jsx';
import ja from '../../../src/locales/ja.js';

const renderConfirm = (kind) => {
    const onCancel = jest.fn();
    const onConfirm = jest.fn();
    render(
        <IntlProvider locale="ja" messages={ja}>
            <TeacherOpenWorkConfirm kind={kind} onCancel={onCancel} onConfirm={onConfirm} />
        </IntlProvider>,
    );
    return { onCancel, onConfirm };
};

describe('TeacherOpenWorkConfirm', () => {
    test('先生自身の作品のときは、そう書く', () => {
        renderConfirm('own');
        expect(screen.getByTestId('classroom-teacher-open-work-confirm-message').textContent).toContain('先生の作品');
    });

    test('前に開いた生徒の作品のときは、生徒の作品の上の変更だと書く', () => {
        renderConfirm('opened');
        expect(screen.getByTestId('classroom-teacher-open-work-confirm-message').textContent).toContain(
            '生徒の作品の上の変更',
        );
    });

    test('［やめる］・［開く］がそれぞれを呼ぶ', () => {
        const { onCancel, onConfirm } = renderConfirm('own');
        fireEvent.click(screen.getByTestId('classroom-teacher-open-work-cancel'));
        expect(onCancel).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByTestId('classroom-teacher-open-work-confirm'));
        expect(onConfirm).toHaveBeenCalledTimes(1);
    });
});
