/* eslint-env jest */
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import BalloonButton from '../../../src/components/balloon/balloon-button.jsx';
import BalloonCloseButton from '../../../src/components/balloon/balloon-close-button.jsx';
import BalloonHeader from '../../../src/components/balloon/balloon-header.jsx';
import Balloon, { BALLOON_COLORS, BALLOON_VARIANTS } from '../../../src/components/balloon/balloon.jsx';

const arrowOf = (container) => container.querySelector('[data-balloon-arrow]');

describe('Balloon', () => {
    test('renders children and passes through data-testid, role and style', () => {
        const { getByTestId } = render(
            <Balloon data-testid="my-balloon" role="dialog" style={{ left: 10 }}>
                hello
            </Balloon>,
        );
        const el = getByTestId('my-balloon');
        expect(el).toHaveTextContent('hello');
        expect(el).toHaveAttribute('role', 'dialog');
        expect(el.style.left).toBe('10px');
    });

    test('defaults to the callout variant in blue', () => {
        const { getByTestId } = render(<Balloon data-testid="b">x</Balloon>);
        expect(getByTestId('b')).toHaveAttribute('data-balloon-variant', BALLOON_VARIANTS.CALLOUT);
        expect(getByTestId('b')).toHaveAttribute('data-balloon-color', BALLOON_COLORS.BLUE);
    });

    test('draws an arrow on the side facing the target', () => {
        const { container } = render(
            <Balloon arrowSide="bottom" arrowStyle={{ left: 24 }} color="green">
                x
            </Balloon>,
        );
        const arrow = arrowOf(container);
        expect(arrow).toHaveAttribute('data-balloon-arrow', 'bottom');
        expect(arrow.style.left).toBe('24px');
    });

    test('draws no arrow without arrowSide', () => {
        const { container } = render(<Balloon variant="panel">x</Balloon>);
        expect(arrowOf(container)).toBeNull();
    });

    test('forwards the ref to the root element', () => {
        const ref = React.createRef();
        render(
            <Balloon ref={ref} data-testid="b">
                x
            </Balloon>,
        );
        expect(ref.current).toHaveAttribute('data-testid', 'b');
    });
});

describe('BalloonCloseButton', () => {
    test('is a labelled × button that calls onClick', () => {
        const onClick = jest.fn();
        const { getByTestId } = render(<BalloonCloseButton label="Close" testId="c" onClick={onClick} />);
        const button = getByTestId('c');
        expect(button).toHaveAttribute('aria-label', 'Close');
        expect(button).toHaveAttribute('type', 'button');
        expect(button).toHaveTextContent('×');
        fireEvent.click(button);
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    test('has no hover title unless one is given', () => {
        const { getByTestId, rerender } = render(<BalloonCloseButton label="Close" testId="c" onClick={jest.fn()} />);
        expect(getByTestId('c')).not.toHaveAttribute('title');
        rerender(<BalloonCloseButton label="Close" title="Close" testId="c" onClick={jest.fn()} />);
        expect(getByTestId('c')).toHaveAttribute('title', 'Close');
    });
});

describe('BalloonHeader', () => {
    test('shows the heading and a close button when onClose is given', () => {
        const onClose = jest.fn();
        const { getByTestId, getByText } = render(
            <BalloonHeader closeLabel="Close" closeTestId="h-close" onClose={onClose}>
                Hint 1 of 3
            </BalloonHeader>,
        );
        expect(getByText('Hint 1 of 3')).toBeInTheDocument();
        expect(getByTestId('h-close')).toHaveAttribute('aria-label', 'Close');
        expect(getByTestId('h-close')).toHaveAttribute('title', 'Close');
        fireEvent.click(getByTestId('h-close'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    test('has no close button without onClose', () => {
        const { container } = render(<BalloonHeader>title</BalloonHeader>);
        expect(container.querySelector('button')).toBeNull();
    });
});

describe('BalloonButton', () => {
    test('passes through props and marks the primary button', () => {
        const onClick = jest.fn();
        const { getByTestId } = render(
            <BalloonButton primary data-testid="ok" onClick={onClick}>
                OK
            </BalloonButton>,
        );
        const button = getByTestId('ok');
        expect(button).toHaveAttribute('type', 'button');
        expect(button).toHaveAttribute('data-balloon-primary', 'true');
        fireEvent.click(button);
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    test('can be disabled', () => {
        const { getByTestId } = render(
            <BalloonButton disabled data-testid="back">
                Back
            </BalloonButton>,
        );
        expect(getByTestId('back')).toBeDisabled();
        expect(getByTestId('back')).toHaveAttribute('data-balloon-primary', 'false');
    });
});
