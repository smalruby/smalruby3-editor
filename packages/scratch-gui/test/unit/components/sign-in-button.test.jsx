/* eslint-env jest */
/**
 * The sign-in buttons we draw next to Google's own button: one shape for
 * every provider, telling them apart by the logo and the label.
 */
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import SignInButton, { SignInButtonList } from '../../../src/components/sign-in-button/sign-in-button.jsx';

describe('SignInButton', () => {
    test('shows the label and calls onClick when pressed', () => {
        const onClick = jest.fn();
        render(
            <SignInButton provider="microsoft" testId="ms-login" onClick={onClick}>
                {'Sign in with Microsoft'}
            </SignInButton>,
        );
        const button = screen.getByTestId('ms-login');
        expect(button).toHaveTextContent('Sign in with Microsoft');
        expect(button).toHaveAttribute('type', 'button');
        fireEvent.click(button);
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    test.each(['google', 'microsoft'])('draws the %s logo, hidden from screen readers', (provider) => {
        render(
            <SignInButton provider={provider} testId="login" onClick={jest.fn()}>
                {'Sign in'}
            </SignInButton>,
        );
        const logo = screen.getByTestId('login').querySelector('svg');
        expect(logo).not.toBeNull();
        expect(logo).toHaveAttribute('aria-hidden', 'true');
    });

    test('a disabled button does not call onClick', () => {
        const onClick = jest.fn();
        render(
            <SignInButton disabled provider="google" testId="g-login" onClick={onClick}>
                {'Sign in with Google'}
            </SignInButton>,
        );
        fireEvent.click(screen.getByTestId('g-login'));
        expect(onClick).not.toHaveBeenCalled();
    });

    test('the list keeps the buttons it is given', () => {
        render(
            <SignInButtonList>
                <SignInButton provider="google" testId="a" onClick={jest.fn()}>
                    {'A'}
                </SignInButton>
                <SignInButton provider="microsoft" testId="b" onClick={jest.fn()}>
                    {'B'}
                </SignInButton>
            </SignInButtonList>,
        );
        expect(screen.getByTestId('a')).toBeInTheDocument();
        expect(screen.getByTestId('b')).toBeInTheDocument();
    });
});
