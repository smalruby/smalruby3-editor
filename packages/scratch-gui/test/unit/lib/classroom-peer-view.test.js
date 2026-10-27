import {
    PEER_LIST_MAX_AGE_MS,
    buildPeerSeats,
    isPeerListStale,
    isPeerSeatSelectable,
    peerViewEntryState,
    peerViewErrorState,
    peerViewerImages,
} from '../../../src/lib/classroom-peer-view.js';

describe('classroom-peer-view', () => {
    describe('peerViewEntryState', () => {
        test('should hide the entry when peer view is off', () => {
            expect(peerViewEntryState('none', true)).toBe('hidden');
        });

        test('should open when peer view is always', () => {
            expect(peerViewEntryState('always', false)).toBe('open');
        });

        test('should lock "after submit" until the student submits', () => {
            expect(peerViewEntryState('afterSubmit', false)).toBe('locked');
            expect(peerViewEntryState('afterSubmit', true)).toBe('open');
        });

        test('should offer the entry when the setting is not known yet', () => {
            // The server answers with the reason (403) when the panel opens.
            expect(peerViewEntryState(null, false)).toBe('open');
            expect(peerViewEntryState(undefined, true)).toBe('open');
        });
    });

    describe('peerViewErrorState', () => {
        test('should map the 403 reasons', () => {
            expect(peerViewErrorState({ status: 403, body: { reason: 'peer-view-off' } })).toBe('off');
            expect(peerViewErrorState({ status: 403, body: { reason: 'not-submitted' } })).toBe('notSubmitted');
        });

        test('should treat other errors as a retryable failure', () => {
            expect(peerViewErrorState({ status: 500 })).toBe('failed');
            expect(peerViewErrorState({ status: 403, body: {} })).toBe('failed');
            expect(peerViewErrorState(null)).toBe('failed');
        });

        test('should report an ended session / classroom', () => {
            expect(peerViewErrorState({ status: 401 })).toBe('ended');
            expect(peerViewErrorState({ status: 404 })).toBe('ended');
        });
    });

    describe('buildPeerSeats', () => {
        const submissions = [
            { seatNumber: 2, submittedAt: '2026-10-26T00:00:00Z', screenshotUrls: [] },
            { seatNumber: 5, submittedAt: '2026-10-26T00:01:00Z', screenshotUrls: [] },
        ];

        test('should list seats up to the larger of the submitted seats and the own seat', () => {
            const seats = buildPeerSeats({ submissions, ownSeatNumber: 7 });
            expect(seats.map((s) => s.seatNumber)).toEqual([1, 2, 3, 4, 5, 6, 7]);
        });

        test('should use the seat count when it is known', () => {
            expect(buildPeerSeats({ submissions, ownSeatNumber: 1, seatCount: 10 })).toHaveLength(10);
        });

        test('should mark submitted seats and the own seat', () => {
            const seats = buildPeerSeats({ submissions, ownSeatNumber: 3 });
            expect(seats[1]).toMatchObject({ seatNumber: 2, submitted: true, own: false });
            expect(seats[1].submission).toBe(submissions[1 - 1]);
            expect(seats[2]).toMatchObject({ seatNumber: 3, submitted: false, own: true });
            expect(seats[0]).toMatchObject({ seatNumber: 1, submitted: false, own: false, submission: null });
        });

        test('should return no seats when there is nothing to show', () => {
            expect(buildPeerSeats({ submissions: [], ownSeatNumber: null })).toEqual([]);
        });
    });

    describe('isPeerSeatSelectable', () => {
        test('should allow only classmates who submitted', () => {
            expect(isPeerSeatSelectable({ submitted: true, own: false })).toBe(true);
            expect(isPeerSeatSelectable({ submitted: false, own: false })).toBe(false);
            expect(isPeerSeatSelectable({ submitted: true, own: true })).toBe(false);
            expect(isPeerSeatSelectable(null)).toBe(false);
        });
    });

    describe('peerViewerImages', () => {
        const labels = {
            stage: 'Stage',
            sprite: (n) => `Sprite ${n}`,
        };

        test('should put the stage thumbnail first, then each sprite with its name', () => {
            const images = peerViewerImages(
                {
                    thumbnailUrl: 'https://s3/thumb.png',
                    screenshotUrls: ['https://s3/a.png', 'https://s3/b.png'],
                    screenshotLabels: ['Cat', 'Dog'],
                },
                labels,
            );
            expect(images).toEqual([
                { name: 'Stage', src: 'https://s3/thumb.png' },
                { name: 'Cat', src: 'https://s3/a.png' },
                { name: 'Dog', src: 'https://s3/b.png' },
            ]);
        });

        test('should fall back to numbered sprite names for old submissions', () => {
            const images = peerViewerImages(
                {
                    thumbnailUrl: null,
                    screenshotUrls: ['https://s3/a.png', 'https://s3/b.png'],
                    screenshotLabels: ['Cat'],
                },
                labels,
            );
            expect(images).toEqual([
                { name: 'Cat', src: 'https://s3/a.png' },
                { name: 'Sprite 2', src: 'https://s3/b.png' },
            ]);
        });

        test('should skip missing urls', () => {
            expect(peerViewerImages({ screenshotUrls: [null, ''] }, labels)).toEqual([]);
            expect(peerViewerImages(null, labels)).toEqual([]);
        });
    });

    describe('isPeerListStale', () => {
        test('should read again when never read or the image urls are about to expire', () => {
            expect(isPeerListStale(null, 1000)).toBe(true);
            expect(isPeerListStale(1000, 1000 + PEER_LIST_MAX_AGE_MS)).toBe(true);
            expect(isPeerListStale(1000, 1000 + PEER_LIST_MAX_AGE_MS - 1)).toBe(false);
        });
    });
});
