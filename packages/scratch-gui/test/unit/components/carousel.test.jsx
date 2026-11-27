/* eslint-env jest */
/**
 * カルーセル (#2364): ページ送りの形 (docs/design-system/components/pager.md) に、
 * 自動で送るきまり (7 秒・ホバー / フォーカスで止まる・一時停止・動きを減らす設定) を足した部品。
 */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import Carousel from '../../../src/components/carousel/carousel.jsx';

const slides = [1, 2, 3].map((n) => ({
    key: `s${n}`,
    title: `Title ${n}`,
    description: `Description ${n}`,
    image: `image-${n}.png`,
}));

const setReducedMotion = (reduce) => {
    window.matchMedia = jest.fn().mockImplementation((query) => ({
        matches: reduce && query.includes('reduce'),
        media: query,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
    }));
};

const renderCarousel = (props = {}) =>
    render(
        <IntlProvider locale="en" messages={{}}>
            <Carousel label="Features" slides={slides} testId="test-carousel" {...props} />
        </IntlProvider>,
    );

const title = () => screen.getByTestId('test-carousel-slide').querySelector('h3').textContent;
const advance = (ms) =>
    act(() => {
        jest.advanceTimersByTime(ms);
    });

describe('Carousel', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        setReducedMotion(false);
    });

    afterEach(() => {
        jest.useRealTimers();
        delete window.matchMedia;
    });

    test('should show the first slide and the dots for every slide', () => {
        renderCarousel();
        expect(title()).toBe('Title 1');
        expect(screen.getByText('Description 1')).toBeInTheDocument();
        expect(screen.getByTestId('test-carousel-dots').children).toHaveLength(3);
    });

    test('should move with the next and previous buttons and disable them at the ends', () => {
        renderCarousel();
        const prev = screen.getByTestId('test-carousel-prev');
        const next = screen.getByTestId('test-carousel-next');
        expect(prev).toHaveAttribute('aria-disabled', 'true');
        fireEvent.click(prev);
        expect(title()).toBe('Title 1');
        fireEvent.click(next);
        expect(title()).toBe('Title 2');
        expect(prev).toHaveAttribute('aria-disabled', 'false');
        fireEvent.click(next);
        expect(title()).toBe('Title 3');
        expect(next).toHaveAttribute('aria-disabled', 'true');
        fireEvent.click(next);
        expect(title()).toBe('Title 3');
        fireEvent.click(prev);
        expect(title()).toBe('Title 2');
    });

    test('should move with the arrow keys', () => {
        renderCarousel();
        const root = screen.getByTestId('test-carousel');
        fireEvent.keyDown(root, { key: 'ArrowRight' });
        expect(title()).toBe('Title 2');
        fireEvent.keyDown(root, { key: 'ArrowLeft' });
        expect(title()).toBe('Title 1');
    });

    test('should advance every 7 seconds and go back to the first after the last', () => {
        renderCarousel();
        advance(6999);
        expect(title()).toBe('Title 1');
        advance(1);
        expect(title()).toBe('Title 2');
        advance(7000);
        expect(title()).toBe('Title 3');
        advance(7000);
        expect(title()).toBe('Title 1');
    });

    test('should restart the 7 seconds when the user moves the slide', () => {
        renderCarousel();
        advance(5000);
        fireEvent.click(screen.getByTestId('test-carousel-next'));
        // フォーカスで止まらないよう、ボタンからフォーカスを外す
        fireEvent.focusOut(screen.getByTestId('test-carousel'), { relatedTarget: document.body });
        advance(5000);
        expect(title()).toBe('Title 2');
        advance(2000);
        expect(title()).toBe('Title 3');
    });

    test('should stop while the mouse is over it', () => {
        renderCarousel();
        const root = screen.getByTestId('test-carousel');
        fireEvent.mouseEnter(root);
        advance(14000);
        expect(title()).toBe('Title 1');
        fireEvent.mouseLeave(root);
        advance(7000);
        expect(title()).toBe('Title 2');
    });

    test('should stop while the focus is inside it', () => {
        renderCarousel();
        const root = screen.getByTestId('test-carousel');
        fireEvent.focusIn(screen.getByTestId('test-carousel-next'));
        advance(14000);
        expect(title()).toBe('Title 1');
        fireEvent.focusOut(root, { relatedTarget: document.body });
        advance(7000);
        expect(title()).toBe('Title 2');
    });

    test('should stop with the pause button and start again with the play button', () => {
        renderCarousel();
        const pause = screen.getByTestId('test-carousel-pause');
        expect(pause).toHaveTextContent('Pause');
        fireEvent.click(pause);
        fireEvent.focusOut(screen.getByTestId('test-carousel'), { relatedTarget: document.body });
        expect(pause).toHaveTextContent('Play');
        advance(21000);
        expect(title()).toBe('Title 1');
        fireEvent.click(pause);
        fireEvent.focusOut(screen.getByTestId('test-carousel'), { relatedTarget: document.body });
        expect(pause).toHaveTextContent('Pause');
        advance(7000);
        expect(title()).toBe('Title 2');
    });

    test('should not advance by itself and hide the pause button when motion is reduced', () => {
        setReducedMotion(true);
        renderCarousel();
        advance(21000);
        expect(title()).toBe('Title 1');
        expect(screen.queryByTestId('test-carousel-pause')).toBeNull();
        fireEvent.click(screen.getByTestId('test-carousel-next'));
        expect(title()).toBe('Title 2');
    });

    test('should announce the slide only while it is not moving by itself', () => {
        renderCarousel();
        const slide = screen.getByTestId('test-carousel-slide');
        expect(slide.parentElement).toHaveAttribute('aria-live', 'off');
        fireEvent.click(screen.getByTestId('test-carousel-pause'));
        expect(slide.parentElement).toHaveAttribute('aria-live', 'polite');
    });
});
