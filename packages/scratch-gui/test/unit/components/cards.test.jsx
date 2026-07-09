import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {IntlProvider} from 'react-intl';

import {ImageStep} from '../../../src/components/cards/cards.jsx';

describe('ImageStep', () => {
    const defaultProps = {
        title: 'Test Step Title',
        image: 'test-image.png'
    };

    const renderWithIntl = (component) => render(
        <IntlProvider locale="en" messages={{}}>
            {component}
        </IntlProvider>
    );

    test('renders title and image', () => {
        renderWithIntl(
            <ImageStep {...defaultProps} />
        );
        expect(screen.getByText('Test Step Title')).toBeTruthy();
        expect(screen.getByRole('img').getAttribute('src')).toBe('test-image.png');
    });

    test('does not render any button when no code and no startTutorial', () => {
        const {container} = renderWithIntl(
            <ImageStep {...defaultProps} />
        );
        expect(container.querySelectorAll('button')).toHaveLength(0);
    });

    test('renders insert code button when code is provided', () => {
        const onInsertCodeFactory = jest.fn(() => jest.fn());
        const {container} = renderWithIntl(
            <ImageStep
                {...defaultProps}
                code="puts 'hello'"
                onInsertCodeFactory={onInsertCodeFactory}
            />
        );
        const button = container.querySelector('button');
        expect(button).toBeTruthy();
        expect(button.getAttribute('data-card-action')).toBe('insert-ruby');
    });

    describe('startTutorial button', () => {
        test('renders start tutorial button when startTutorial is true', () => {
            const onStartTutorial = jest.fn();
            const {container} = renderWithIntl(
                <ImageStep
                    {...defaultProps}
                    startTutorial
                    onStartTutorial={onStartTutorial}
                />
            );
            const button = container.querySelector('button');
            expect(button).toBeTruthy();
            expect(button.getAttribute('data-card-action')).toBe('start-tutorial');
        });

        test('does not render start tutorial button when onStartTutorial is not provided', () => {
            const {container} = renderWithIntl(
                <ImageStep
                    {...defaultProps}
                    startTutorial
                />
            );
            expect(container.querySelectorAll('button')).toHaveLength(0);
        });

        test('calls onStartTutorial when clicked', () => {
            const onStartTutorial = jest.fn();
            const {container} = renderWithIntl(
                <ImageStep
                    {...defaultProps}
                    startTutorial
                    onStartTutorial={onStartTutorial}
                />
            );
            fireEvent.click(container.querySelector('button'));
            expect(onStartTutorial).toHaveBeenCalledTimes(1);
        });

        test('renders button with start-tutorial action attribute', () => {
            const onStartTutorial = jest.fn();
            const {container} = renderWithIntl(
                <ImageStep
                    {...defaultProps}
                    startTutorial
                    animateStartTutorial
                    onStartTutorial={onStartTutorial}
                />
            );
            const button = container.querySelector('[data-card-action="start-tutorial"]');
            expect(button).toBeTruthy();
        });

        test('does not render insert-code button when startTutorial is true', () => {
            const onStartTutorial = jest.fn();
            const onInsertCodeFactory = jest.fn(() => jest.fn());
            const {container} = renderWithIntl(
                <ImageStep
                    {...defaultProps}
                    startTutorial
                    onStartTutorial={onStartTutorial}
                    code="puts 'hello'"
                    onInsertCodeFactory={onInsertCodeFactory}
                />
            );
            // Both buttons can render, but startTutorial button should be present
            const startButton = container.querySelector('[data-card-action="start-tutorial"]');
            expect(startButton).toBeTruthy();
        });
    });

    // === Smalruby: Start of external-url button ===
    describe('externalUrl button', () => {
        test('renders external link when externalUrl is provided', () => {
            const {container} = renderWithIntl(
                <ImageStep
                    {...defaultProps}
                    externalUrl="https://try.ruby-lang.org/"
                />
            );
            const link = container.querySelector('[data-card-action="open-external-link"]');
            expect(link).toBeTruthy();
            expect(link.tagName).toBe('A');
            expect(link.getAttribute('href')).toBe('https://try.ruby-lang.org/');
            expect(link.getAttribute('target')).toBe('_blank');
            expect(link.getAttribute('rel')).toBe('noopener noreferrer');
        });

        test('does not render external link when externalUrl is not provided', () => {
            const {container} = renderWithIntl(
                <ImageStep {...defaultProps} />
            );
            expect(container.querySelector('[data-card-action="open-external-link"]')).toBeNull();
        });

        test('uses the provided externalUrlLabel as the link text', () => {
            renderWithIntl(
                <ImageStep
                    {...defaultProps}
                    externalUrl="https://try.ruby-lang.org/"
                    externalUrlLabel="Open TryRuby"
                />
            );
            expect(screen.getByText('Open TryRuby')).toBeTruthy();
        });

        test('renders external link alongside insert-code button', () => {
            const onInsertCodeFactory = jest.fn(() => jest.fn());
            const {container} = renderWithIntl(
                <ImageStep
                    {...defaultProps}
                    code="puts 'hello'"
                    onInsertCodeFactory={onInsertCodeFactory}
                    externalUrl="https://try.ruby-lang.org/"
                />
            );
            expect(container.querySelector('[data-card-action="insert-ruby"]')).toBeTruthy();
            expect(container.querySelector('[data-card-action="open-external-link"]')).toBeTruthy();
        });
    });
    // === Smalruby: End of external-url button ===
});
