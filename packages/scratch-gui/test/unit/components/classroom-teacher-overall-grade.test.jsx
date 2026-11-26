/* eslint-env jest */
/**
 * 総合評価の画面 (EPIC #2421 / #2426): 確定していない課題があると、その課題へのリンクを出して
 * 書き出せない。設定はクラスごとにこのブラウザに残る。
 */
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import TeacherOverallGrade from '../../../src/components/classroom-modal/teacher-overall-grade.jsx';
import { STORAGE_PREFIX } from '../../../src/containers/use-overall-grade-settings.js';

const lessons = [
    { classroomId: 'robot', assignmentName: 'ロボット' },
    { classroomId: 'led', assignmentName: 'LED' },
];
const g = (grade) => ({ grade, reason: '', source: 'ai' });

const renderOverall = (props = {}) =>
    render(
        <IntlProvider locale="en">
            <TeacherOverallGrade
                gradings={{
                    robot: { grades: { 1: g('S'), 2: g('B') }, confirmedAt: '2026-11-20T00:00:00Z' },
                    led: { grades: { 1: g('A') }, confirmedAt: null },
                }}
                group={{ groupId: 'g1', name: '技術' }}
                lessons={lessons}
                onOpenAssignment={jest.fn()}
                {...props}
            />
        </IntlProvider>,
    );

describe('TeacherOverallGrade', () => {
    beforeEach(() => window.localStorage.clear());

    test('an unconfirmed assignment is linked and blocks the export', () => {
        const onOpenAssignment = jest.fn();
        const { getByTestId } = renderOverall({ onOpenAssignment });
        expect(getByTestId('classroom-overall-export')).toBeDisabled();
        fireEvent.click(getByTestId('classroom-overall-open-led'));
        expect(onOpenAssignment).toHaveBeenCalledWith('led');
        // The provisional result is still shown: seat 1 = (4 + 3) / 2.
        expect(getByTestId('classroom-overall-average-1')).toHaveTextContent('3.50');
        expect(getByTestId('classroom-overall-grade-1')).toHaveTextContent('S');
    });

    test('leaving the unconfirmed assignment out enables the export and is kept for the class', () => {
        const { getByTestId, queryByTestId } = renderOverall();
        fireEvent.click(getByTestId('classroom-overall-include-led'));
        expect(queryByTestId('classroom-overall-unconfirmed')).toBeNull();
        expect(getByTestId('classroom-overall-export')).toBeEnabled();
        expect(JSON.parse(window.localStorage.getItem(`${STORAGE_PREFIX}g1`)).included).toEqual({ led: false });
    });

    test('changing the points of 未提出 changes the average', () => {
        const { getByTestId } = renderOverall();
        fireEvent.change(getByTestId('classroom-overall-point-none'), { target: { value: '2' } });
        // seat 2: robot B(2) + led none(2) = 2.00
        expect(getByTestId('classroom-overall-average-2')).toHaveTextContent('2.00');
    });

    describe('the charts (#2458)', () => {
        // jsdom has no PointerEvent: a MouseEvent carries clientX.
        beforeAll(() => {
            if (!window.PointerEvent) window.PointerEvent = class extends window.MouseEvent {};
        });

        const leaveOutLed = (getByTestId) => fireEvent.click(getByTestId('classroom-overall-include-led'));

        test('the S+A+B share, the stacked band and a dot per seat', () => {
            const { getByTestId } = renderOverall();
            leaveOutLed(getByTestId);
            // robot only: seat 1 S (4), seat 2 B (2)
            expect(getByTestId('classroom-overall-chart-sab')).toHaveTextContent('S+A+B 2 (100%)');
            expect(getByTestId('classroom-overall-chart-sab')).toHaveAttribute('data-ok', 'true');
            expect(getByTestId('classroom-overall-chart-band-S')).toHaveStyle({ width: '50%' });
            expect(getByTestId('classroom-overall-chart-band-B')).toHaveStyle({ width: '50%' });
            expect(getByTestId('classroom-overall-chart-dot-1')).toHaveStyle({ left: '100%' });
            expect(getByTestId('classroom-overall-chart-dot-2')).toHaveStyle({ left: '50%' });
        });

        test('changing a cut field changes the band at once; the faint band keeps the opening settings', () => {
            const { getByTestId, queryByTestId } = renderOverall();
            leaveOutLed(getByTestId);
            fireEvent.change(getByTestId('classroom-overall-cut-B'), { target: { value: '2.5' } });
            // seat 2 (2.00) is now C: S+A+B 1 of 2 = 50%, below the target
            expect(getByTestId('classroom-overall-chart-sab')).toHaveAttribute('data-ok', 'false');
            expect(getByTestId('classroom-overall-chart-band-C')).toHaveStyle({ width: '50%' });
            expect(queryByTestId('classroom-overall-chart-band-B')).toBeNull();
            // When opened, led was in: seat 1 (4 + 3) / 2 = S, seat 2 (2 + 0) / 2 = C.
            expect(getByTestId('classroom-overall-chart-band-before-S')).toHaveStyle({ width: '50%' });
            expect(getByTestId('classroom-overall-chart-band-before-C')).toHaveStyle({ width: '50%' });
        });

        test('dragging a cut line sets the cut (and its field), kept between the other cuts', () => {
            const { getByTestId } = renderOverall();
            leaveOutLed(getByTestId);
            const track = getByTestId('classroom-overall-chart-dots');
            track.getBoundingClientRect = () => ({ left: 0, width: 400, top: 0, height: 80, right: 400, bottom: 80 });
            const line = getByTestId('classroom-overall-chart-cut-B');
            fireEvent.pointerDown(line, { clientX: 150 });
            fireEvent.pointerMove(line, { clientX: 230 });
            fireEvent.pointerUp(line, { clientX: 230 });
            // 230 / 400 of 0..4 = 2.3
            expect(getByTestId('classroom-overall-cut-B')).toHaveValue(2.3);
            expect(getByTestId('classroom-overall-grade-2')).toHaveTextContent('C');
            // Past the A cut (2.5), it stops there.
            fireEvent.pointerDown(line, { clientX: 230 });
            fireEvent.pointerMove(line, { clientX: 390 });
            fireEvent.pointerUp(line, { clientX: 390 });
            expect(getByTestId('classroom-overall-cut-B')).toHaveValue(2.5);
        });

        test('the line moves by how far the pointer moved; a cancelled pointer only stops', () => {
            const { getByTestId } = renderOverall();
            const track = getByTestId('classroom-overall-chart-dots');
            track.getBoundingClientRect = () => ({ left: 0, width: 400, top: 0, height: 80, right: 400, bottom: 80 });
            const line = getByTestId('classroom-overall-chart-cut-B');
            // Pressed 6px beside the line (at 150) and released: the cut stays.
            fireEvent.pointerDown(line, { clientX: 156 });
            fireEvent.pointerUp(line, { clientX: 156 });
            expect(getByTestId('classroom-overall-cut-B')).toHaveValue(1.5);
            // Moved by 40px (0.4) from there, then cancelled at 0: the cut stays at 1.9.
            fireEvent.pointerDown(line, { clientX: 156 });
            fireEvent.pointerMove(line, { clientX: 196 });
            fireEvent.pointerCancel(line, { clientX: 0 });
            expect(getByTestId('classroom-overall-cut-B')).toHaveValue(1.9);
            fireEvent.pointerMove(line, { clientX: 0 });
            expect(getByTestId('classroom-overall-cut-B')).toHaveValue(1.9);
        });

        test('a moved pointer without pressing does not move the line', () => {
            const { getByTestId } = renderOverall();
            const track = getByTestId('classroom-overall-chart-dots');
            track.getBoundingClientRect = () => ({ left: 0, width: 400, top: 0, height: 80, right: 400, bottom: 80 });
            fireEvent.pointerMove(getByTestId('classroom-overall-chart-cut-B'), { clientX: 300 });
            expect(getByTestId('classroom-overall-cut-B')).toHaveValue(1.5);
        });

        test('the arrow keys move a cut line by 0.1', () => {
            const { getByTestId } = renderOverall();
            const line = getByTestId('classroom-overall-chart-cut-A');
            expect(line).toHaveAttribute('role', 'slider');
            fireEvent.keyDown(line, { key: 'ArrowRight' });
            expect(getByTestId('classroom-overall-cut-A')).toHaveValue(2.6);
            expect(line).toHaveAttribute('aria-valuenow', '2.6');
            fireEvent.keyDown(line, { key: 'ArrowLeft' });
            fireEvent.keyDown(line, { key: 'ArrowLeft' });
            expect(getByTestId('classroom-overall-cut-A')).toHaveValue(2.4);
        });

        test('no chart without an included assignment', () => {
            const { getByTestId, queryByTestId } = renderOverall();
            fireEvent.click(getByTestId('classroom-overall-include-led'));
            fireEvent.click(getByTestId('classroom-overall-include-robot'));
            expect(queryByTestId('classroom-overall-chart')).toBeNull();
        });
    });
});
