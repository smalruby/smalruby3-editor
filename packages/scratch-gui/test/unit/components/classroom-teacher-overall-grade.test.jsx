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
});
