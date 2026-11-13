/* eslint-env jest */
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import LessonSettingsField from '../../../src/components/classroom-modal/lesson-settings-field.jsx';
import { createLessonDraft } from '../../../src/lib/classroom-lesson-settings.js';
import ja from '../../../src/locales/ja.js';

const renderField = () =>
    render(
        <IntlProvider locale="ja" messages={ja}>
            <LessonSettingsField
                draft={createLessonDraft('kyou-kara-programmer')}
                saved={null}
                onChange={jest.fn()}
            />
        </IntlProvider>,
    );

describe('LessonSettingsField ✕ (#1770)', () => {
    test('the open panel has a ✕ named「閉じる」that closes it and returns focus to the toggle', () => {
        const { getByTestId, queryByTestId } = renderField();
        fireEvent.click(getByTestId('classroom-lesson-toggle'));
        const close = getByTestId('classroom-lesson-close');
        expect(close).toHaveAttribute('aria-label', '閉じる');
        expect(close.tagName).toBe('BUTTON');

        fireEvent.click(close);

        expect(queryByTestId('classroom-lesson-panel')).toBeNull();
        expect(getByTestId('classroom-lesson-toggle')).toHaveFocus();
        expect(getByTestId('classroom-lesson-toggle')).toHaveAttribute('aria-expanded', 'false');
    });

    test('Escape still closes the panel', () => {
        const { getByTestId, queryByTestId } = renderField();
        fireEvent.click(getByTestId('classroom-lesson-toggle'));
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(queryByTestId('classroom-lesson-panel')).toBeNull();
    });
});
