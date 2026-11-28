/* eslint-env jest */
// The panel that shows the Ruby of the program: its title follows the menu
// that opened it (Issue #2557, B17-2).
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import RubyScriptPreview from '../../../src/components/ruby-script-preview/ruby-script-preview.jsx';
import en from '../../../src/locales/en';

const renderPreview = (props) =>
    render(
        <IntlProvider locale="en" messages={en}>
            <RubyScriptPreview code={'puts(1)\n'} onClose={jest.fn()} {...props} />
        </IntlProvider>,
    );

describe('RubyScriptPreview', () => {
    test('has the title of the Ruby tab when no title is given', () => {
        renderPreview();
        expect(screen.getByText('Preview Ruby Script')).toBeInTheDocument();
    });

    test('has the given title (the words of the menu of the Japanese tab)', () => {
        renderPreview({ title: 'Preview the program in Ruby' });
        expect(screen.getByText('Preview the program in Ruby')).toBeInTheDocument();
        expect(screen.queryByText('Preview Ruby Script')).not.toBeInTheDocument();
    });
});
