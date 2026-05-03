/* eslint-env jest */
import '@testing-library/jest-dom';
import { render, fireEvent } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import StudentJoinForm from '../../../src/components/classroom-modal/student-join-form.jsx';

const renderForm = (props = {}) =>
    render(
        <IntlProvider locale="en">
            <StudentJoinForm onJoin={jest.fn()} {...props} />
        </IntlProvider>,
    );

const getInput = (container) => container.querySelector('[data-testid="classroom-join-code-input"]');

const getSubmitButton = (container) => container.querySelector('[data-testid="classroom-join-submit"]');

describe('StudentJoinForm', () => {
    describe('input normalization', () => {
        test('should convert half-width uppercase to lowercase', () => {
            const { container } = renderForm();
            fireEvent.change(getInput(container), {
                target: { value: 'ABC234' },
            });
            expect(getInput(container).value).toBe('abc234');
        });

        test('should keep half-width lowercase as-is', () => {
            const { container } = renderForm();
            fireEvent.change(getInput(container), {
                target: { value: 'abc234' },
            });
            expect(getInput(container).value).toBe('abc234');
        });

        test('should convert full-width digits to half-width', () => {
            const { container } = renderForm();
            // \uFF12\uFF13\uFF14 = ２３４
            fireEvent.change(getInput(container), {
                target: { value: '\uFF12\uFF13\uFF14abc' },
            });
            expect(getInput(container).value).toBe('234abc');
        });

        test('should convert full-width uppercase to half-width lowercase', () => {
            const { container } = renderForm();
            // \uFF21\uFF22\uFF23 = ＡＢＣ
            fireEvent.change(getInput(container), {
                target: { value: '\uFF21\uFF22\uFF23234' },
            });
            expect(getInput(container).value).toBe('abc234');
        });

        test('should convert full-width lowercase to half-width lowercase', () => {
            const { container } = renderForm();
            // \uFF41\uFF42\uFF43 = ａｂｃ
            fireEvent.change(getInput(container), {
                target: { value: '\uFF41\uFF42\uFF43234' },
            });
            expect(getInput(container).value).toBe('abc234');
        });

        test('should reject non-alphanumeric characters', () => {
            const { container } = renderForm();
            fireEvent.change(getInput(container), {
                target: { value: 'あいうabc' },
            });
            expect(getInput(container).value).toBe('abc');
        });

        test('should reject special characters', () => {
            const { container } = renderForm();
            fireEvent.change(getInput(container), {
                target: { value: 'a-b.c!2@3#4' },
            });
            expect(getInput(container).value).toBe('abc234');
        });

        test('should handle full-width mixed with hiragana', () => {
            const { container } = renderForm();
            // ＡあＢいＣう234
            fireEvent.change(getInput(container), {
                target: {
                    value: '\uFF21\u3042\uFF22\u3044\uFF23\u3046234',
                },
            });
            expect(getInput(container).value).toBe('abc234');
        });

        test('should have maxLength of 6', () => {
            const { container } = renderForm();
            expect(getInput(container).maxLength).toBe(6);
        });
    });

    describe('submit behavior', () => {
        test('should call onJoin with lowercase code on click', () => {
            const onJoin = jest.fn();
            const { container } = renderForm({ onJoin });
            fireEvent.change(getInput(container), {
                target: { value: 'abc234' },
            });
            fireEvent.click(getSubmitButton(container));
            expect(onJoin).toHaveBeenCalledWith('abc234');
        });

        test('should disable submit when code is less than 6 chars', () => {
            const { container } = renderForm();
            fireEvent.change(getInput(container), {
                target: { value: 'abc' },
            });
            expect(getSubmitButton(container).disabled).toBe(true);
        });

        test('should call onJoin on Enter key', () => {
            const onJoin = jest.fn();
            const { container } = renderForm({ onJoin });
            fireEvent.change(getInput(container), {
                target: { value: 'abc234' },
            });
            fireEvent.keyDown(getInput(container), { key: 'Enter' });
            expect(onJoin).toHaveBeenCalledWith('abc234');
        });
    });
});
