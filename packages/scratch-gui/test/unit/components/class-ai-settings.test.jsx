/* eslint-env jest */
/**
 * クラスの設定の「生成AI・ルビティー」3 ステップ (#1277)。
 */
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import React, { useState } from 'react';
import { IntlProvider } from 'react-intl';
import ClassAiSettings from '../../../src/components/classroom-modal/class-ai-settings.jsx';
import { draftFromGroup, GENAI_DEFAULT_URLS } from '../../../src/lib/classroom-genai-settings.js';

const byTestId = (id) => document.querySelector(`[data-testid="${id}"]`);

// Keeps the draft like the settings form does, and exposes the latest value.
const Harness = ({ group, onDraft }) => {
    const [draft, setDraft] = useState(draftFromGroup(group));
    const handleChange = (next) => {
        setDraft(next);
        onDraft(next);
    };
    return <ClassAiSettings draft={draft} onChange={handleChange} />;
};

const renderSettings = (group = {}) => {
    const onDraft = jest.fn();
    render(
        <IntlProvider locale="en">
            <Harness group={group} onDraft={onDraft} />
        </IntlProvider>,
    );
    return { lastDraft: () => onDraft.mock.calls[onDraft.mock.calls.length - 1][0] };
};

describe('ClassAiSettings', () => {
    test('shows a collapsed summary until the teacher opens it', () => {
        renderSettings();
        expect(byTestId('classroom-class-ai-summary')).toHaveTextContent('Not used');
        expect(byTestId('classroom-class-ai-step-use')).toBeNull();
        fireEvent.click(byTestId('classroom-class-ai-edit'));
        expect(byTestId('classroom-class-ai-step-use')).toBeInTheDocument();
    });

    test('enables Gemini in 3 steps', () => {
        const { lastDraft } = renderSettings();
        fireEvent.click(byTestId('classroom-class-ai-edit'));
        fireEvent.click(byTestId('classroom-class-ai-use-yes'));
        expect(byTestId('classroom-class-ai-step-service')).toBeInTheDocument();
        expect(byTestId('classroom-class-ai-service-claude')).toBeDisabled();

        fireEvent.click(byTestId('classroom-class-ai-service-gemini'));
        expect(byTestId('classroom-class-ai-step-confirm')).toBeInTheDocument();
        expect(byTestId('classroom-class-ai-url')).toHaveValue(GENAI_DEFAULT_URLS.gemini);
        expect(byTestId('classroom-class-ai-not-confirmed')).toBeInTheDocument();
        expect(lastDraft()).toMatchObject({ use: true, service: 'gemini', confirmed: false });

        fireEvent.click(byTestId('classroom-class-ai-confirm'));
        expect(byTestId('classroom-class-ai-not-confirmed')).toBeNull();
        expect(lastDraft()).toMatchObject({ use: true, service: 'gemini', confirmed: true, rubytee: false });

        fireEvent.click(byTestId('classroom-class-ai-rubytee'));
        expect(lastDraft().rubytee).toBe(true);
        expect(byTestId('classroom-class-ai-try')).toHaveAttribute('href', GENAI_DEFAULT_URLS.gemini);
        expect(byTestId('classroom-class-ai-try')).toHaveAttribute('target', '_blank');
    });

    test('changing the service asks for the confirmation again', () => {
        const group = {
            genai: { enabled: true, service: 'gemini', url: GENAI_DEFAULT_URLS.gemini, confirmed: true },
        };
        const { lastDraft } = renderSettings(group);
        expect(byTestId('classroom-class-ai-summary')).toHaveTextContent('Gemini');
        fireEvent.click(byTestId('classroom-class-ai-edit'));
        expect(byTestId('classroom-class-ai-step-confirm')).toBeInTheDocument();
        expect(byTestId('classroom-class-ai-confirm')).toBeChecked();

        fireEvent.click(byTestId('classroom-class-ai-step-tab-service'));
        fireEvent.click(byTestId('classroom-class-ai-service-chatgpt'));
        expect(lastDraft()).toMatchObject({ service: 'chatgpt', url: GENAI_DEFAULT_URLS.chatgpt, confirmed: false });
    });

    test('the other service needs an https URL that is not adult-only', () => {
        renderSettings();
        fireEvent.click(byTestId('classroom-class-ai-edit'));
        fireEvent.click(byTestId('classroom-class-ai-use-yes'));
        fireEvent.click(byTestId('classroom-class-ai-service-other'));
        expect(byTestId('classroom-class-ai-url')).toHaveValue('');
        expect(byTestId('classroom-class-ai-try')).toBeNull();

        fireEvent.change(byTestId('classroom-class-ai-url'), { target: { value: 'http://ai.example.ed.jp/' } });
        expect(byTestId('classroom-class-ai-url-error')).toBeInTheDocument();
        fireEvent.change(byTestId('classroom-class-ai-url'), { target: { value: 'https://claude.ai/' } });
        expect(byTestId('classroom-class-ai-url-error')).toBeInTheDocument();
        fireEvent.change(byTestId('classroom-class-ai-url'), { target: { value: 'https://ai.example.ed.jp/' } });
        expect(byTestId('classroom-class-ai-url-error')).toBeNull();
    });

    test('choosing not to use it still lets the teacher set Rubytee', () => {
        const group = {
            genai: { enabled: true, service: 'gemini', url: GENAI_DEFAULT_URLS.gemini, confirmed: true },
        };
        const { lastDraft } = renderSettings(group);
        fireEvent.click(byTestId('classroom-class-ai-edit'));
        fireEvent.click(byTestId('classroom-class-ai-step-tab-use'));
        fireEvent.click(byTestId('classroom-class-ai-use-no'));
        expect(lastDraft().use).toBe(false);
        expect(byTestId('classroom-class-ai-rubytee')).toBeInTheDocument();
    });

    test('warns on the collapsed summary when the settings are left unfinished', () => {
        renderSettings();
        expect(byTestId('classroom-class-ai-incomplete')).toBeNull();
        fireEvent.click(byTestId('classroom-class-ai-edit'));
        fireEvent.click(byTestId('classroom-class-ai-use-yes'));
        fireEvent.click(byTestId('classroom-class-ai-service-gemini'));
        expect(byTestId('classroom-class-ai-incomplete')).toBeNull();
        fireEvent.click(byTestId('classroom-class-ai-edit'));
        expect(byTestId('classroom-class-ai-incomplete')).toBeInTheDocument();
        fireEvent.click(byTestId('classroom-class-ai-edit'));
        fireEvent.click(byTestId('classroom-class-ai-confirm'));
        fireEvent.click(byTestId('classroom-class-ai-edit'));
        expect(byTestId('classroom-class-ai-incomplete')).toBeNull();
    });
});
