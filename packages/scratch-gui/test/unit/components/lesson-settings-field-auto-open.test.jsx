/* eslint-env jest */
/**
 * レッスン欄のパネル: ［＋ 作成 ▾］→「レッスン」で開いた状態で始まる・閉じたら知らせる (#1780)。
 */
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import LessonSettingsField from '../../../src/components/classroom-modal/lesson-settings-field.jsx';
import { firstLessonDraft } from '../../../src/lib/classroom-lesson-description.js';
import ja from '../../../src/locales/ja.js';

const renderField = (props) =>
    render(
        <IntlProvider locale="ja" messages={ja}>
            <LessonSettingsField draft={firstLessonDraft()} saved={null} onChange={jest.fn()} {...props} />
        </IntlProvider>,
    );

describe('LessonSettingsField autoOpen / onClose (#1780)', () => {
    test('autoOpen opens the panel with the first lesson checked, once', () => {
        const onAutoOpened = jest.fn();
        const { getByTestId } = renderField({ autoOpen: true, onAutoOpened });
        expect(getByTestId('classroom-lesson-panel')).toBeInTheDocument();
        expect(getByTestId('classroom-lesson-lesson-blocks-l1')).toBeChecked();
        expect(onAutoOpened).toHaveBeenCalledTimes(1);
    });

    test.each([
        ['✕', (q) => fireEvent.click(q('classroom-lesson-close'))],
        ['Escape', () => fireEvent.keyDown(document, { key: 'Escape' })],
        ['outside', () => fireEvent.mouseDown(document.body)],
        ['toggle', (q) => fireEvent.click(q('classroom-lesson-toggle'))],
    ])('closing with %s calls onClose once and keeps the lesson', (_, close) => {
        const onClose = jest.fn();
        const onChange = jest.fn();
        const { getByTestId, queryByTestId } = renderField({ autoOpen: true, onClose, onChange });
        expect(onClose).not.toHaveBeenCalled();
        close(getByTestId);
        expect(queryByTestId('classroom-lesson-panel')).toBeNull();
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(onChange).not.toHaveBeenCalled();
    });

    test('no onClose without opening', () => {
        const onClose = jest.fn();
        renderField({ onClose });
        expect(onClose).not.toHaveBeenCalled();
    });
});
