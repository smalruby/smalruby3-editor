/* eslint-env jest */
/**
 * クラスの設定の「このクラスで使う AI」(#1277, #1290)。
 * 生成AI とルビティーの 2 行と、生徒の画面の見本。
 */
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import React, { useState } from 'react';
import { IntlProvider } from 'react-intl';
import ClassAiSettings from '../../../src/components/classroom-modal/class-ai-settings.jsx';
import ClassAiStudentPreview from '../../../src/components/classroom-modal/class-ai-student-preview.jsx';
import {
    changedAiSettings,
    draftFromGroup,
    GENAI_DEFAULT_URLS,
    isRubyteeUnconfirmed,
} from '../../../src/lib/classroom-genai-settings.js';

const byTestId = (id) => document.querySelector(`[data-testid="${id}"]`);

const GEMINI_GROUP = {
    genai: { enabled: true, service: 'gemini', url: GENAI_DEFAULT_URLS.gemini, confirmed: true },
};

// Keeps the draft like the settings form does, and exposes the latest value.
const Harness = ({ group, onDraft }) => {
    const [draft, setDraft] = useState(draftFromGroup(group));
    const handleChange = (next) => {
        setDraft(next);
        onDraft(next);
    };
    // The preview sits beside the settings, fed from the same unsaved draft.
    return (
        <React.Fragment>
            <ClassAiSettings
                changed={changedAiSettings(group, draft)}
                draft={draft}
                rubyteeUnconfirmed={isRubyteeUnconfirmed(group)}
                onChange={handleChange}
            />
            <ClassAiStudentPreview genai={draft.use} rubytee={draft.rubytee} />
        </React.Fragment>
    );
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
    test('shows both settings with what happens to the students, without steps', () => {
        renderSettings();
        expect(byTestId('classroom-class-ai-genai')).toHaveTextContent('both the Code tab and the Ruby tab');
        // Same name as the face the students see (and the preview beside it).
        expect(byTestId('classroom-class-ai-genai')).toHaveTextContent('“Ask AI” face');
        expect(byTestId('classroom-class-ai-genai')).toHaveTextContent('Smalruby sends nothing');
        expect(byTestId('classroom-class-ai-rubytee-row')).toHaveTextContent('Leave it to Rubytee');
        expect(byTestId('classroom-class-ai-rubytee-row')).toHaveTextContent('No sign-up needed');
        expect(byTestId('classroom-class-ai-service-none')).toHaveAttribute('aria-pressed', 'true');
        expect(byTestId('classroom-class-ai-service-claude')).toBeNull();
        expect(byTestId('classroom-class-ai-confirm-panel')).toBeNull();
        expect(byTestId('classroom-class-ai-step-tab-use')).toBeNull();
        expect(byTestId('classroom-class-ai-edit')).toBeNull();
    });

    test('enables Gemini: the check sits on one line with the folded URL', () => {
        const { lastDraft } = renderSettings();
        fireEvent.click(byTestId('classroom-class-ai-service-gemini'));
        expect(byTestId('classroom-class-ai-service-gemini')).toHaveAttribute('aria-pressed', 'true');
        expect(byTestId('classroom-class-ai-confirm-panel')).toBeInTheDocument();
        // Why the check is needed is said once, by the hint beside the disabled [Save] (#1439).
        expect(byTestId('classroom-class-ai-confirm-reason')).toBeNull();
        expect(lastDraft()).toMatchObject({
            use: true,
            service: 'gemini',
            url: GENAI_DEFAULT_URLS.gemini,
            confirmed: false,
        });

        expect(byTestId('classroom-class-ai-url')).toBeNull();
        expect(byTestId('classroom-class-ai-url-change')).toHaveTextContent('gemini.google.com/app');
        // The folded URL shares the required check's row, so it costs no line of its own (#1439).
        const confirmRow = byTestId('classroom-class-ai-confirm').closest('label').parentElement;
        expect(confirmRow).toContainElement(byTestId('classroom-class-ai-url-change'));
        expect(confirmRow).toContainElement(byTestId('classroom-class-ai-try'));
        expect(byTestId('classroom-class-ai-try')).toHaveAttribute('href', GENAI_DEFAULT_URLS.gemini);
        expect(byTestId('classroom-class-ai-try')).toHaveAttribute('target', '_blank');

        fireEvent.click(byTestId('classroom-class-ai-confirm'));
        expect(lastDraft()).toMatchObject({ confirmed: true, rubytee: false });

        fireEvent.click(byTestId('classroom-class-ai-url-change'));
        expect(byTestId('classroom-class-ai-url')).toHaveValue(GENAI_DEFAULT_URLS.gemini);
    });

    test('Rubytee is its own toggle and stays in place whatever the generative AI is', () => {
        const { lastDraft } = renderSettings();
        expect(byTestId('classroom-class-ai-rubytee')).not.toBeChecked();
        fireEvent.click(byTestId('classroom-class-ai-rubytee'));
        expect(lastDraft().rubytee).toBe(true);
        fireEvent.click(byTestId('classroom-class-ai-service-chatgpt'));
        expect(byTestId('classroom-class-ai-rubytee')).toBeChecked();
        expect(lastDraft()).toMatchObject({ service: 'chatgpt', rubytee: true });
    });

    test('turning Rubytee on asks the teacher to confirm what the student consent used to say', () => {
        const { lastDraft } = renderSettings();
        expect(byTestId('classroom-class-ai-rubytee-confirm-panel')).toBeNull();
        fireEvent.click(byTestId('classroom-class-ai-rubytee'));
        // The conditions fold into one line (R3); the details open on demand.
        expect(byTestId('classroom-class-ai-rubytee-conditions-summary')).toHaveTextContent('wrong answers');
        expect(byTestId('classroom-class-ai-rubytee-conditions')).toBeNull();
        fireEvent.click(byTestId('classroom-class-ai-rubytee-conditions-toggle'));
        const conditions = byTestId('classroom-class-ai-rubytee-conditions');
        expect(conditions).toHaveTextContent('may be wrong');
        expect(conditions).toHaveTextContent('personal information');
        expect(conditions).toHaveTextContent('under 18');
        fireEvent.click(byTestId('classroom-class-ai-rubytee-conditions-toggle'));
        expect(byTestId('classroom-class-ai-rubytee-conditions')).toBeNull();
        expect(byTestId('classroom-class-ai-rubytee-terms')).toHaveAttribute('href', '/terms-of-service.html');
        expect(byTestId('classroom-class-ai-rubytee-privacy')).toHaveAttribute('href', '/privacy-policy.html');
        expect(byTestId('classroom-class-ai-rubytee-confirm')).not.toBeChecked();
        expect(lastDraft()).toMatchObject({ rubytee: true, rubyteeConfirmed: false });

        fireEvent.click(byTestId('classroom-class-ai-rubytee-confirm'));
        expect(lastDraft()).toMatchObject({ rubytee: true, rubyteeConfirmed: true });

        // Off and on again asks again.
        fireEvent.click(byTestId('classroom-class-ai-rubytee'));
        expect(byTestId('classroom-class-ai-rubytee-confirm-panel')).toBeNull();
        fireEvent.click(byTestId('classroom-class-ai-rubytee'));
        expect(byTestId('classroom-class-ai-rubytee-confirm')).not.toBeChecked();
    });

    test('a class that turned Rubytee on before the confirmation existed is shown as not confirmed', () => {
        renderSettings({ rubytee: { enabled: true } });
        expect(byTestId('classroom-class-ai-rubytee')).toBeChecked();
        expect(byTestId('classroom-class-ai-rubytee-unconfirmed')).toBeInTheDocument();
        fireEvent.click(byTestId('classroom-class-ai-rubytee-confirm'));
        expect(byTestId('classroom-class-ai-rubytee-unconfirmed')).toBeNull();
    });

    test('a confirmed class shows its check without the notice', () => {
        renderSettings({ rubytee: { enabled: true, confirmed: true } });
        expect(byTestId('classroom-class-ai-rubytee-confirm')).toBeChecked();
        expect(byTestId('classroom-class-ai-rubytee-unconfirmed')).toBeNull();
    });

    test('changing the service asks for the confirmation again and folds the URL', () => {
        const { lastDraft } = renderSettings(GEMINI_GROUP);
        expect(byTestId('classroom-class-ai-confirm')).toBeChecked();
        fireEvent.click(byTestId('classroom-class-ai-url-change'));
        expect(byTestId('classroom-class-ai-url')).toBeInTheDocument();

        fireEvent.click(byTestId('classroom-class-ai-service-chatgpt'));
        expect(lastDraft()).toMatchObject({ service: 'chatgpt', url: GENAI_DEFAULT_URLS.chatgpt, confirmed: false });
        expect(byTestId('classroom-class-ai-confirm')).not.toBeChecked();
        expect(byTestId('classroom-class-ai-url')).toBeNull();
    });

    test('"Other" asks for the URL right away, which must be https and not adult-only', () => {
        renderSettings();
        fireEvent.click(byTestId('classroom-class-ai-service-other'));
        expect(byTestId('classroom-class-ai-url')).toHaveValue('');
        expect(byTestId('classroom-class-ai-url-change')).toBeNull();
        expect(byTestId('classroom-class-ai-try')).toBeNull();

        fireEvent.change(byTestId('classroom-class-ai-url'), { target: { value: 'http://ai.example.ed.jp/' } });
        expect(byTestId('classroom-class-ai-url-error')).toBeInTheDocument();
        fireEvent.change(byTestId('classroom-class-ai-url'), { target: { value: 'https://claude.ai/' } });
        expect(byTestId('classroom-class-ai-url-error')).toHaveTextContent('18 and up');
        fireEvent.change(byTestId('classroom-class-ai-url'), { target: { value: 'https://ai.example.ed.jp/' } });
        expect(byTestId('classroom-class-ai-url-error')).toBeNull();
        expect(byTestId('classroom-class-ai-try')).toBeInTheDocument();
    });

    test('"Don\'t use" clears the choice, and choosing again starts over', () => {
        const { lastDraft } = renderSettings(GEMINI_GROUP);
        fireEvent.click(byTestId('classroom-class-ai-service-none'));
        expect(lastDraft()).toMatchObject({ use: false, service: null, url: '', confirmed: false });
        expect(byTestId('classroom-class-ai-confirm-panel')).toBeNull();
        fireEvent.click(byTestId('classroom-class-ai-service-gemini'));
        expect(lastDraft()).toMatchObject({ use: true, service: 'gemini', confirmed: false });
    });

    test('marks only the changed row as unsaved', () => {
        renderSettings();
        expect(byTestId('classroom-class-ai-genai-unsaved')).toBeNull();
        expect(byTestId('classroom-class-ai-rubytee-unsaved')).toBeNull();
        fireEvent.click(byTestId('classroom-class-ai-rubytee'));
        expect(byTestId('classroom-class-ai-genai-unsaved')).toBeNull();
        expect(byTestId('classroom-class-ai-rubytee-unsaved')).toBeInTheDocument();
        fireEvent.click(byTestId('classroom-class-ai-service-gemini'));
        expect(byTestId('classroom-class-ai-genai-unsaved')).toBeInTheDocument();
        // Back to what is saved: no mark.
        fireEvent.click(byTestId('classroom-class-ai-service-none'));
        expect(byTestId('classroom-class-ai-genai-unsaved')).toBeNull();
    });

    test('the student preview follows the unsaved choices', () => {
        renderSettings();
        expect(byTestId('classroom-class-ai-preview')).toBeInTheDocument();
        expect(byTestId('classroom-class-ai-preview-consult')).toBeNull();
        expect(byTestId('classroom-class-ai-preview-consult-ruby')).toBeNull();
        expect(byTestId('classroom-class-ai-preview-rubytee')).toBeNull();
        expect(byTestId('classroom-class-ai-preview-consult-off')).toHaveTextContent(
            'neither the Code tab nor the Ruby tab',
        );
        expect(byTestId('classroom-class-ai-preview-rubytee-off')).toBeNull();
        expect(byTestId('classroom-class-ai-preview-rubytee-no-genai')).toBeNull();

        // The face of genai-concierge is in both tabs, and its panel has no Rubytee yet.
        fireEvent.click(byTestId('classroom-class-ai-service-gemini'));
        expect(byTestId('classroom-class-ai-preview-consult')).toHaveTextContent('Ask AI');
        expect(byTestId('classroom-class-ai-preview-consult-ruby')).toHaveTextContent('Ask AI');
        expect(byTestId('classroom-class-ai-preview-consult-off')).toBeNull();
        expect(byTestId('classroom-class-ai-preview-rubytee')).toHaveTextContent('Leave it to Rubytee');
        expect(byTestId('classroom-class-ai-preview-rubytee')).toHaveAttribute('data-on', 'false');
        expect(byTestId('classroom-class-ai-preview-rubytee-off')).toHaveTextContent("face's panel");

        fireEvent.click(byTestId('classroom-class-ai-rubytee'));
        expect(byTestId('classroom-class-ai-preview-rubytee')).toHaveAttribute('data-on', 'true');
        expect(byTestId('classroom-class-ai-preview-rubytee-off')).toBeNull();
    });

    test('the student preview says Rubytee needs the generative AI face', () => {
        renderSettings({ rubytee: { enabled: true, confirmed: true } });
        expect(byTestId('classroom-class-ai-preview-consult')).toBeNull();
        expect(byTestId('classroom-class-ai-preview-rubytee')).toBeNull();
        expect(byTestId('classroom-class-ai-preview-rubytee-off')).toBeNull();
        expect(byTestId('classroom-class-ai-preview-rubytee-no-genai')).toHaveTextContent('“Ask AI” panel');
    });
});
