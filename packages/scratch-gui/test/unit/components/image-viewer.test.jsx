/* eslint-env jest */
import '@testing-library/jest-dom';
import { act, fireEvent, screen } from '@testing-library/react';
import React from 'react';
import ImageViewer from '../../../src/components/image-viewer/image-viewer.jsx';
import { renderWithIntl } from '../../helpers/intl-helpers.jsx';

const VIEWPORT = { width: 500, height: 500 };
const IMAGES = [
    { src: 'data:image/png;base64,stage', name: 'ステージ' },
    { src: 'data:image/png;base64,cat', name: 'ネコ' },
    { src: 'data:image/png;base64,dog', name: 'イヌ' },
];

// jsdom はレイアウトしないので、ビューポートの大きさと画像の実寸を与える
beforeEach(() => {
    jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(VIEWPORT.width);
    jest.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(VIEWPORT.height);
    jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        top: 0,
        right: VIEWPORT.width,
        bottom: VIEWPORT.height,
        width: VIEWPORT.width,
        height: VIEWPORT.height,
    });
});

afterEach(() => {
    jest.restoreAllMocks();
});

const loadImage = (width = 2000, height = 1000) => {
    const img = screen.getByTestId('image-viewer-image');
    Object.defineProperty(img, 'naturalWidth', { value: width, configurable: true });
    Object.defineProperty(img, 'naturalHeight', { value: height, configurable: true });
    fireEvent.load(img);
    return img;
};

const zoomLevel = () => screen.getByTestId('image-viewer-zoom-level').textContent;

const pointer = (type, init) => {
    const viewport = screen.getByTestId('image-viewer-viewport');
    // jsdom には PointerEvent が無いので MouseEvent に pointer 系のプロパティを足す
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, ...init });
    Object.defineProperty(event, 'pointerId', { value: init.pointerId });
    Object.defineProperty(event, 'pointerType', { value: init.pointerType || 'mouse' });
    act(() => {
        viewport.dispatchEvent(event);
    });
};

describe('ImageViewer', () => {
    test('shows the name and position of the current image', () => {
        renderWithIntl(<ImageViewer images={IMAGES} />);
        expect(screen.getByTestId('image-viewer-name')).toHaveTextContent('ステージ');
        expect(screen.getByTestId('image-viewer-counter')).toHaveTextContent('1 / 3');
        expect(screen.getByTestId('image-viewer-image')).toHaveAttribute('alt', 'ステージ');
    });

    test('switches between images with the previous / next buttons', () => {
        const onIndexChange = jest.fn();
        renderWithIntl(<ImageViewer images={IMAGES} onIndexChange={onIndexChange} />);
        expect(screen.getByTestId('image-viewer-prev')).toBeDisabled();
        fireEvent.click(screen.getByTestId('image-viewer-next'));
        expect(screen.getByTestId('image-viewer-name')).toHaveTextContent('ネコ');
        expect(onIndexChange).toHaveBeenLastCalledWith(1);
        fireEvent.click(screen.getByTestId('image-viewer-next'));
        expect(screen.getByTestId('image-viewer-next')).toBeDisabled();
        fireEvent.click(screen.getByTestId('image-viewer-prev'));
        expect(screen.getByTestId('image-viewer-counter')).toHaveTextContent('2 / 3');
    });

    test('hides the navigation for a single image', () => {
        renderWithIntl(<ImageViewer images={[IMAGES[0]]} />);
        expect(screen.queryByTestId('image-viewer-prev')).toBeNull();
        expect(screen.queryByTestId('image-viewer-counter')).toBeNull();
    });

    test('fits the whole image after it loads', () => {
        renderWithIntl(<ImageViewer images={IMAGES} />);
        const img = loadImage();
        expect(zoomLevel()).toBe('25%');
        expect(img.style.transform).toBe('translate(0px, 125px) scale(0.25)');
        expect(screen.getByTestId('image-viewer-zoom-out')).toBeDisabled();
    });

    test('toggles between fit and 100%', () => {
        renderWithIntl(<ImageViewer images={IMAGES} />);
        loadImage();
        const toggle = screen.getByTestId('image-viewer-toggle-fit');
        expect(toggle).toHaveTextContent('100%');
        fireEvent.click(toggle);
        expect(zoomLevel()).toBe('100%');
        expect(toggle).toHaveTextContent('Fit to screen');
        fireEvent.click(toggle);
        expect(zoomLevel()).toBe('25%');
    });

    test('zooms with the buttons up to 400%', () => {
        renderWithIntl(<ImageViewer images={IMAGES} />);
        loadImage();
        fireEvent.click(screen.getByTestId('image-viewer-zoom-in'));
        expect(zoomLevel()).toBe('31%');
        for (let i = 0; i < 20; i++) fireEvent.click(screen.getByTestId('image-viewer-zoom-in'));
        expect(zoomLevel()).toBe('400%');
        expect(screen.getByTestId('image-viewer-zoom-in')).toBeDisabled();
        fireEvent.click(screen.getByTestId('image-viewer-zoom-out'));
        expect(zoomLevel()).toBe('320%');
    });

    test('zooms with the keyboard and resets with 0', () => {
        renderWithIntl(<ImageViewer images={IMAGES} />);
        loadImage();
        const viewport = screen.getByTestId('image-viewer-viewport');
        fireEvent.keyDown(viewport, { key: '+' });
        expect(zoomLevel()).toBe('31%');
        fireEvent.keyDown(viewport, { key: '-' });
        expect(zoomLevel()).toBe('25%');
        fireEvent.keyDown(viewport, { key: '+' });
        fireEvent.keyDown(viewport, { key: '0' });
        expect(zoomLevel()).toBe('25%');
    });

    test('pans with the arrow keys', () => {
        renderWithIntl(<ImageViewer images={IMAGES} />);
        const img = loadImage();
        fireEvent.click(screen.getByTestId('image-viewer-toggle-fit'));
        expect(img.style.transform).toBe('translate(-750px, -250px) scale(1)');
        fireEvent.keyDown(screen.getByTestId('image-viewer-viewport'), { key: 'ArrowRight' });
        expect(img.style.transform).toBe('translate(-790px, -250px) scale(1)');
        fireEvent.keyDown(screen.getByTestId('image-viewer-viewport'), { key: 'ArrowUp' });
        expect(img.style.transform).toBe('translate(-790px, -210px) scale(1)');
    });

    test('switches images with PageDown and returns to fit', () => {
        renderWithIntl(<ImageViewer images={IMAGES} />);
        loadImage();
        fireEvent.click(screen.getByTestId('image-viewer-toggle-fit'));
        fireEvent.keyDown(screen.getByTestId('image-viewer-viewport'), { key: 'PageDown' });
        expect(screen.getByTestId('image-viewer-name')).toHaveTextContent('ネコ');
        loadImage(1000, 1000);
        expect(zoomLevel()).toBe('50%');
    });

    test('zooms around the cursor with the mouse wheel', () => {
        renderWithIntl(<ImageViewer images={IMAGES} />);
        const img = loadImage();
        const viewport = screen.getByTestId('image-viewer-viewport');
        const event = new WheelEvent('wheel', { deltaY: -500, clientX: 0, clientY: 250, cancelable: true });
        act(() => {
            viewport.dispatchEvent(event);
        });
        expect(event.defaultPrevented).toBe(true);
        expect(Number(zoomLevel().replace('%', ''))).toBeGreaterThan(25);
        // カーソル (左端) の下の画像点 x=0 は左端に留まる
        expect(img.style.transform).toMatch(/^translate\(0px, /);
    });

    test('pans by dragging with a pointer', () => {
        renderWithIntl(<ImageViewer images={IMAGES} />);
        const img = loadImage();
        fireEvent.click(screen.getByTestId('image-viewer-toggle-fit'));
        pointer('pointerdown', { pointerId: 1, clientX: 200, clientY: 200, button: 0 });
        pointer('pointermove', { pointerId: 1, clientX: 150, clientY: 230 });
        pointer('pointerup', { pointerId: 1, clientX: 150, clientY: 230 });
        expect(img.style.transform).toBe('translate(-800px, -220px) scale(1)');
        // 離した後の移動では動かない
        pointer('pointermove', { pointerId: 1, clientX: 0, clientY: 0 });
        expect(img.style.transform).toBe('translate(-800px, -220px) scale(1)');
    });

    test('zooms with a two-finger pinch', () => {
        renderWithIntl(<ImageViewer images={IMAGES} />);
        loadImage();
        fireEvent.click(screen.getByTestId('image-viewer-toggle-fit'));
        pointer('pointerdown', { pointerId: 1, pointerType: 'touch', clientX: 200, clientY: 250 });
        pointer('pointerdown', { pointerId: 2, pointerType: 'touch', clientX: 300, clientY: 250 });
        pointer('pointermove', { pointerId: 2, pointerType: 'touch', clientX: 400, clientY: 250 });
        expect(zoomLevel()).toBe('200%');
    });

    test('toggles zoom with a double click', () => {
        renderWithIntl(<ImageViewer images={IMAGES} />);
        loadImage();
        const viewport = screen.getByTestId('image-viewer-viewport');
        fireEvent.doubleClick(viewport, { clientX: 250, clientY: 250 });
        expect(zoomLevel()).toBe('100%');
        fireEvent.doubleClick(viewport, { clientX: 250, clientY: 250 });
        expect(zoomLevel()).toBe('25%');
    });

    test('toggles zoom with a double tap', () => {
        renderWithIntl(<ImageViewer images={IMAGES} />);
        loadImage();
        pointer('pointerdown', { pointerId: 1, pointerType: 'touch', clientX: 250, clientY: 250 });
        pointer('pointerup', { pointerId: 1, pointerType: 'touch', clientX: 250, clientY: 250 });
        pointer('pointerdown', { pointerId: 2, pointerType: 'touch', clientX: 252, clientY: 251 });
        pointer('pointerup', { pointerId: 2, pointerType: 'touch', clientX: 252, clientY: 251 });
        expect(zoomLevel()).toBe('100%');
    });

    test('has accessible labels and is keyboard focusable', () => {
        renderWithIntl(<ImageViewer images={IMAGES} />);
        expect(screen.getByTestId('image-viewer-zoom-in')).toHaveAttribute('aria-label', 'Zoom in');
        expect(screen.getByTestId('image-viewer-zoom-out')).toHaveAttribute('aria-label', 'Zoom out');
        expect(screen.getByTestId('image-viewer-viewport')).toHaveAttribute('tabindex', '0');
        expect(screen.getByTestId('image-viewer-viewport').getAttribute('aria-label')).toContain('ステージ');
    });
});
