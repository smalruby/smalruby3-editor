/* eslint-env jest */
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import React from 'react';
import AssignmentPageText from '../../../src/components/classroom-modal/assignment-page-text.jsx';

const renderText = (text) => render(<AssignmentPageText dataTestId="t" text={text} />);

describe('AssignmentPageText', () => {
    test('heading, paragraph, ordered and bulleted lists, marker and label', () => {
        const { container, getByTestId } = renderText(
            'タイトル\nふつうの文\n\n1. ひとつめ\n3. *みっつめ*\n・【注意】あ',
        );
        expect(getByTestId('classroom-assignment-text-heading')).toHaveTextContent('タイトル');
        expect(container.querySelectorAll('p')).toHaveLength(2);
        const items = container.querySelectorAll('ol li');
        expect(items).toHaveLength(2);
        expect(items[1]).toHaveAttribute('value', '3');
        expect(container.querySelector('mark')).toHaveTextContent('みっつめ');
        expect(container.querySelectorAll('ul li')).toHaveLength(1);
        expect(container.querySelector('ul li span')).toHaveTextContent('注意');
    });

    test('lines of one paragraph are joined by line breaks', () => {
        const { container } = renderText('見出し\nあ\nい');
        expect(container.querySelectorAll('br')).toHaveLength(1);
    });

    test('HTML in the text is not rendered as elements', () => {
        const { container, getByTestId } = renderText('<img src=x onerror=alert(1)>\n<script>x</script>');
        expect(container.querySelector('img')).toBeNull();
        expect(container.querySelector('script')).toBeNull();
        expect(getByTestId('t')).toHaveTextContent('<img src=x onerror=alert(1)>');
    });

    test('empty text renders an empty box', () => {
        const { getByTestId } = renderText('');
        expect(getByTestId('t')).toBeEmptyDOMElement();
    });
});
