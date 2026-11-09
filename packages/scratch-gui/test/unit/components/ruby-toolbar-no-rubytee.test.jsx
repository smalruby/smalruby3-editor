/* eslint-env jest */
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import RubyToolbar from '../../../src/components/ruby-toolbar/ruby-toolbar.jsx';

// The Rubytee chat moved out of the Ruby tab (#1401): asking an AI is the
// genai panel now, so the toolbar must not offer the old chat button even if a
// caller still passes the old handler.
describe('RubyToolbar without the Rubytee chat (#1401)', () => {
    test('does not render the Rubytee button', () => {
        const { container } = render(
            <IntlProvider locale="ja" messages={{}}>
                <RubyToolbar
                    locale="ja"
                    rubyVersion={2}
                    canExecute
                    targets={[]}
                    onChangeRubyVersion={jest.fn()}
                    onToggleExecute={jest.fn()}
                    onUndo={jest.fn()}
                    onRedo={jest.fn()}
                    onDownload={jest.fn()}
                    onInsertClass={jest.fn()}
                    onPreviewRubyScript={jest.fn()}
                    onDismissBubble={jest.fn()}
                    onOpenRubyteeModal={jest.fn()}
                    onToggleFurigana={jest.fn()}
                    onToggleDnclMode={jest.fn()}
                    onSelectTarget={jest.fn()}
                />
            </IntlProvider>,
        );
        expect(container.querySelector('[data-testid="ruby-toolbar-mode-ruby"]')).toBeTruthy();
        expect(container.querySelector('[data-testid="ruby-toolbar-rubytee"]')).toBeNull();
    });
});
