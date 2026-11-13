/* eslint-env jest */
import { render } from '@testing-library/react';
import React from 'react';
import { LessonAnalytics } from '../../../src/containers/lesson-analytics.jsx';
import { resetSharedLessonAnalytics } from '../../../src/lib/lessons/lesson-analytics';

const open = {
    courseId: 'kyou-kara-programmer',
    lessonId: 'blocks-l1',
    challengeId: 'blocks-l1-click-say',
    hintSession: 1,
    hintVisible: true,
    hintIndex: 0,
};

describe('LessonAnalytics container', () => {
    beforeEach(() => {
        resetSharedLessonAnalytics();
    });

    test('remounting (PC <-> SP layout switch) does not resend and keeps measuring the hint page', () => {
        const send = jest.fn();
        let time = 1000;
        const now = () => time;
        const first = render(<LessonAnalytics {...open} now={now} send={send} />);
        expect(send).toHaveBeenCalledTimes(1);
        first.unmount();
        time = 4000;
        const second = render(<LessonAnalytics {...open} now={now} send={send} />);
        expect(send).toHaveBeenCalledTimes(1);
        time = 11000;
        second.rerender(<LessonAnalytics {...open} hintIndex={1} now={now} send={send} />);
        expect(send).toHaveBeenCalledTimes(2);
        expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'hint_view', page: 1, seconds: 10 }));
    });

    test('sends nothing while a classroom teacher is logged in', () => {
        const send = jest.fn();
        const { rerender } = render(<LessonAnalytics {...open} teacherLoggedIn now={() => 0} send={send} />);
        rerender(<LessonAnalytics {...open} teacherLoggedIn hintIndex={1} now={() => 5000} send={send} />);
        expect(send).not.toHaveBeenCalled();
    });

    test('sends the events decided from the lesson state changes', () => {
        const send = jest.fn();
        let time = 0;
        const now = () => time;
        const { rerender } = render(<LessonAnalytics now={now} send={send} />);
        expect(send).not.toHaveBeenCalled();

        time = 1000;
        rerender(<LessonAnalytics {...open} now={now} send={send} />);
        expect(send).toHaveBeenLastCalledWith(
            expect.objectContaining({ category: 'lessons', action: 'challenge_open', label: 'blocks-l1-click-say' }),
        );

        time = 9000;
        rerender(<LessonAnalytics {...open} hintIndex={1} now={now} send={send} />);
        expect(send).toHaveBeenLastCalledWith(
            expect.objectContaining({
                action: 'hint_view',
                page: 1,
                seconds: 8,
                challenge_id: 'blocks-l1-click-say',
            }),
        );
    });

    test('does not resend when re-rendered with the same state', () => {
        const send = jest.fn();
        const now = () => 0;
        const { rerender } = render(<LessonAnalytics {...open} now={now} send={send} />);
        rerender(<LessonAnalytics {...open} now={now} send={send} />);
        expect(send).toHaveBeenCalledTimes(1);
    });

    test('keeps working when sending fails', () => {
        const send = jest.fn(() => {
            throw new Error('no dataLayer');
        });
        expect(() => render(<LessonAnalytics {...open} now={() => 0} send={send} />)).not.toThrow();
    });
});
