/**
 * A "sign in with <provider>" button that sits next to Google's own button.
 *
 * Google's button is drawn by Google (Identity Services) and can only be
 * adjusted through its options, so every other sign-in button follows its
 * shape instead: the same width and height, a white face with a thin border,
 * the provider's logo on the left and the label in the middle. The values and
 * the reasons are in docs/design-system/components/buttons.md.
 */
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import styles from './sign-in-button.css';

// The provider logos are the brands' own marks, so they keep their colors.
const GoogleLogo = () => (
    <svg aria-hidden="true" className={styles.logo} viewBox="0 0 48 48">
        <path
            d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
            fill="#FFC107"
        />
        <path
            d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
            fill="#FF3D00"
        />
        <path
            d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
            fill="#4CAF50"
        />
        <path
            d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
            fill="#1976D2"
        />
    </svg>
);

const MicrosoftLogo = () => (
    <svg aria-hidden="true" className={styles.logo} viewBox="0 0 21 21">
        <rect fill="#F25022" height="10" width="10" x="0" y="0" />
        <rect fill="#7FBA00" height="10" width="10" x="11" y="0" />
        <rect fill="#00A4EF" height="10" width="10" x="0" y="11" />
        <rect fill="#FFB900" height="10" width="10" x="11" y="11" />
    </svg>
);

const LOGOS = {
    google: GoogleLogo,
    microsoft: MicrosoftLogo,
};

const SignInButton = ({ children, className, disabled, onClick, provider, testId }) => {
    const Logo = LOGOS[provider];
    return (
        <button
            className={classNames(styles.signInButton, className)}
            data-testid={testId}
            disabled={disabled}
            type="button"
            onClick={onClick}
        >
            <Logo />
            <span className={styles.label}>{children}</span>
        </button>
    );
};

SignInButton.propTypes = {
    children: PropTypes.node.isRequired,
    className: PropTypes.string,
    disabled: PropTypes.bool,
    onClick: PropTypes.func.isRequired,
    provider: PropTypes.oneOf(Object.keys(LOGOS)).isRequired,
    testId: PropTypes.string,
};

/**
 * Stacks the sign-in buttons (ours and Google's) in one centered column, so
 * every provider gets the same width whatever the screen.
 * @param {object} props - The props.
 * @param {React.ReactNode} props.children - The buttons.
 * @returns {React.ReactElement} The column.
 */
const SignInButtonList = ({ children }) => <div className={styles.list}>{children}</div>;

SignInButtonList.propTypes = {
    children: PropTypes.node,
};

export { SignInButton as default, SignInButtonList };
