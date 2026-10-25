/* eslint-env jest */
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import ClassroomStatusIcon, {
    ClassroomStatusIcons,
    getPresenceStatus,
    getSubmissionStatus,
    STATUS_KINDS,
} from '../../../src/components/classroom-modal/classroom-status-icon.jsx';

const renderIntl = (node) => render(<IntlProvider locale="en">{node}</IntlProvider>);

describe('getPresenceStatus (#1196)', () => {
    test('returns notJoined when there is no member', () => {
        expect(getPresenceStatus(null, false)).toBe('notJoined');
    });

    test('returns notJoined when the member has left', () => {
        expect(getPresenceStatus({ left: true }, true)).toBe('notJoined');
    });

    test('returns seated / notSeated for a joined member', () => {
        expect(getPresenceStatus({}, true)).toBe('seated');
        expect(getPresenceStatus({}, false)).toBe('notSeated');
    });
});

describe('getSubmissionStatus (#1196)', () => {
    test('returns null when there is no member', () => {
        expect(getSubmissionStatus(null)).toBeNull();
    });

    test('returns returned before submitted', () => {
        expect(getSubmissionStatus({ hasSubmission: true, submissionStatus: 'returned' })).toBe('returned');
    });

    test('returns submitted / notSubmitted from hasSubmission', () => {
        expect(getSubmissionStatus({ hasSubmission: true, submissionStatus: 'submitted' })).toBe('submitted');
        expect(getSubmissionStatus({ hasSubmission: false })).toBe('notSubmitted');
    });

    test('accepts the student-side status string', () => {
        expect(getSubmissionStatus('submitted')).toBe('submitted');
        expect(getSubmissionStatus('returned')).toBe('returned');
        expect(getSubmissionStatus(null)).toBeNull();
    });
});

describe('ClassroomStatusIcon (#1196)', () => {
    const LABELS = {
        seated: 'Seated',
        notSeated: 'Not seated',
        notJoined: 'Not joined',
        submitted: 'Submitted',
        notSubmitted: 'Not submitted',
        returned: 'Returned',
        kickRequested: 'Leave request',
        occupied: 'In use',
    };

    test('covers every status kind', () => {
        expect(Object.keys(LABELS).sort()).toEqual([...STATUS_KINDS].sort());
    });

    test.each(Object.entries(LABELS))('renders %s with an accessible label and its own shape', (status, label) => {
        renderIntl(<ClassroomStatusIcon status={status} />);
        const el = document.querySelector(`[data-testid="classroom-status-icon-${status}"]`);
        expect(el).toBeInTheDocument();
        expect(el).toHaveAttribute('role', 'img');
        expect(el).toHaveAttribute('aria-label', label);
        expect(el).toHaveAttribute('title', label);
        expect(el).toHaveAttribute('data-status', status);
        expect(el.querySelector('svg')).toBeInTheDocument();
    });

    test('uses a distinct SVG shape per status (not just color)', () => {
        const shapes = STATUS_KINDS.map((status) => {
            const { container } = renderIntl(<ClassroomStatusIcon status={status} />);
            const svg = container.querySelector('svg');
            // strip fill/stroke colors so only geometry is compared
            return svg.innerHTML.replace(/(fill|stroke)="[^"]*"/g, '');
        });
        expect(new Set(shapes).size).toBe(STATUS_KINDS.length);
    });

    test('renders nothing for an unknown / empty status', () => {
        const { container } = renderIntl(<ClassroomStatusIcon status={null} />);
        expect(container).toBeEmptyDOMElement();
    });
});

describe('ClassroomStatusIcons (#1196)', () => {
    test('renders presence and submission side by side', () => {
        renderIntl(<ClassroomStatusIcons presence="seated" submission="submitted" />);
        const group = document.querySelector('[data-testid="classroom-status-icons"]');
        const icons = group.querySelectorAll('[role="img"]');
        expect(Array.from(icons).map((i) => i.dataset.status)).toEqual(['seated', 'submitted']);
    });

    test('adds the leave-request icon when requested', () => {
        renderIntl(<ClassroomStatusIcons presence="notSeated" submission="notSubmitted" kickRequested />);
        expect(document.querySelector('[data-testid="classroom-status-icon-kickRequested"]')).toBeInTheDocument();
    });

    test('omits missing statuses', () => {
        renderIntl(<ClassroomStatusIcons presence="notJoined" submission={null} />);
        const icons = document.querySelectorAll('[data-testid="classroom-status-icons"] [role="img"]');
        expect(icons).toHaveLength(1);
    });
});
