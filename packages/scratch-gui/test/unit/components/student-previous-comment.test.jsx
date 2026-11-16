/* eslint-env jest */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import StudentPreviousComment from '../../../src/components/classroom-modal/student-previous-comment.jsx';

const renderComment = (previousComment) =>
    render(
        <IntlProvider locale="en">
            <StudentPreviousComment previousComment={previousComment} />
        </IntlProvider>,
    );

describe('StudentPreviousComment (#1963)', () => {
    test('shows the comment in the 「from your teacher」 bubble with the earlier assignment', () => {
        renderComment({ assignmentName: 'ねこの迷路', teacherComment: 'よくできました' });
        const note = screen.getByTestId('classroom-previous-comment');
        expect(note).toHaveTextContent('From your teacher');
        expect(note).toHaveTextContent('Last time: ねこの迷路');
        expect(screen.getByTestId('classroom-previous-comment-text')).toHaveTextContent('よくできました');
    });

    test('an earlier assignment without a name still says it is from last time', () => {
        renderComment({ assignmentName: null, teacherComment: 'がんばったね' });
        expect(screen.getByTestId('classroom-previous-comment')).toHaveTextContent('Last time');
    });

    test('shows nothing without a comment', () => {
        renderComment({ assignmentName: 'ねこの迷路', teacherComment: '' });
        expect(screen.queryByTestId('classroom-previous-comment')).toBeNull();
    });
});
