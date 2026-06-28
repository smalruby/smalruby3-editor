'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { computeReviewApproval } = require('../src/project');

test('computeReviewApproval: reviewDecision=APPROVED -> approved', () => {
    assert.deepEqual(computeReviewApproval('APPROVED', []), {
        approved: true,
        changesRequested: false,
    });
});

test('computeReviewApproval: reviewDecision=CHANGES_REQUESTED -> changesRequested', () => {
    assert.deepEqual(computeReviewApproval('CHANGES_REQUESTED', []), {
        approved: false,
        changesRequested: true,
    });
});

test('computeReviewApproval: #811 empty reviewDecision but APPROVED review -> approved', () => {
    // ブランチ保護でレビュー必須でない場合 reviewDecision が空でも、APPROVED レビューで approved
    assert.deepEqual(computeReviewApproval(null, [{ login: 'alice', state: 'APPROVED' }]), {
        approved: true,
        changesRequested: false,
    });
    assert.deepEqual(
        computeReviewApproval('REVIEW_REQUIRED', [{ login: 'alice', state: 'APPROVED' }]),
        { approved: true, changesRequested: false },
    );
});

test('computeReviewApproval: empty reviewDecision + CHANGES_REQUESTED wins over APPROVED', () => {
    const reviews = [
        { login: 'alice', state: 'APPROVED' },
        { login: 'bob', state: 'CHANGES_REQUESTED' },
    ];
    assert.deepEqual(computeReviewApproval(null, reviews), {
        approved: false,
        changesRequested: true,
    });
});

test('computeReviewApproval: latest state per reviewer wins (re-approve after changes)', () => {
    // bob が CHANGES_REQUESTED 後に APPROVED で上書き -> approved
    const reviews = [
        { login: 'bob', state: 'CHANGES_REQUESTED' },
        { login: 'bob', state: 'APPROVED' },
    ];
    assert.deepEqual(computeReviewApproval(null, reviews), {
        approved: true,
        changesRequested: false,
    });
});

test('computeReviewApproval: COMMENTED/PENDING do not change approval state', () => {
    const reviews = [
        { login: 'alice', state: 'APPROVED' },
        { login: 'alice', state: 'COMMENTED' },
        { login: 'carol', state: 'PENDING' },
    ];
    assert.deepEqual(computeReviewApproval(null, reviews), {
        approved: true,
        changesRequested: false,
    });
});

test('computeReviewApproval: DISMISSED clears an earlier approval', () => {
    const reviews = [
        { login: 'alice', state: 'APPROVED' },
        { login: 'alice', state: 'DISMISSED' },
    ];
    assert.deepEqual(computeReviewApproval(null, reviews), {
        approved: false,
        changesRequested: false,
    });
});

test('computeReviewApproval: no reviews + empty decision -> not approved', () => {
    assert.deepEqual(computeReviewApproval(null, []), {
        approved: false,
        changesRequested: false,
    });
});
