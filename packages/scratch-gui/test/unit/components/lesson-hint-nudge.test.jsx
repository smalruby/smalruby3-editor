import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import LessonHintNudge from '../../../src/components/lesson-hint/lesson-hint-nudge.jsx';
import en from '../../../src/locales/en';
import ja from '../../../src/locales/ja';
import jaHira from '../../../src/locales/ja-Hira';

const renderNudge = (visible, locale = 'en', messages = en) =>
    render(
        <IntlProvider locale={locale} messages={messages}>
            <LessonHintNudge visible={visible} />
        </IntlProvider>,
    );

describe('LessonHintNudge', () => {
    test('shows "Take a look at the hint" as text only while visible', () => {
        const hidden = renderNudge(false);
        expect(hidden.queryByTestId('lesson-hint-nudge')).not.toBeInTheDocument();
        hidden.unmount();
        const { getByTestId } = renderNudge(true);
        expect(getByTestId('lesson-hint-nudge')).toHaveTextContent('Take a look at the hint');
        expect(getByTestId('lesson-hint-nudge')).toHaveAttribute('role', 'status');
    });

    test('uses the Japanese strings', () => {
        expect(renderNudge(true, 'ja', ja).getByTestId('lesson-hint-nudge')).toHaveTextContent('ヒントを見てみよう');
    });

    test('uses the hiragana strings', () => {
        expect(renderNudge(true, 'ja-Hira', jaHira).getByTestId('lesson-hint-nudge')).toHaveTextContent(
            'ヒントをみてみよう',
        );
    });
});
