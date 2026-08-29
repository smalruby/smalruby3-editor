'use strict';
// read GraphQL 予算の一点集中を緩和する純粋関数のテスト（B: listItems 重複排除 /
// D: 未観測時の refreshBoard 抑制）。I/O 無し。
const { test } = require('node:test');
const assert = require('node:assert');
const {
    shouldReuseItemsCache,
    shouldRefreshBoardPeriodic,
    BOARD_WATCH_TTL_MS,
    BOARD_UPKEEP_MS,
} = require('../src/phases');

test('shouldReuseItemsCache: 新鮮なキャッシュは再利用する', () => {
    const cache = { items: [{ issue: 1 }], at: 1000 };
    assert.equal(shouldReuseItemsCache({ now: 1000 + 5_000, cache, maxAgeMs: 150_000 }), true);
});

test('shouldReuseItemsCache: maxAge を超えたら再取得', () => {
    const cache = { items: [{ issue: 1 }], at: 1000 };
    assert.equal(shouldReuseItemsCache({ now: 1000 + 200_000, cache, maxAgeMs: 150_000 }), false);
});

test('shouldReuseItemsCache: forceFetch は常に再取得', () => {
    const cache = { items: [{ issue: 1 }], at: 1000 };
    assert.equal(shouldReuseItemsCache({ now: 1000, cache, maxAgeMs: 150_000, forceFetch: true }), false);
});

test('shouldReuseItemsCache: キャッシュ無し / 不正は再取得', () => {
    assert.equal(shouldReuseItemsCache({ now: 1000, cache: null, maxAgeMs: 150_000 }), false);
    assert.equal(shouldReuseItemsCache({ now: 1000, cache: { at: 1000 }, maxAgeMs: 150_000 }), false);
    assert.equal(shouldReuseItemsCache({ now: 1000, cache: { items: [], at: 1000 }, maxAgeMs: 0 }), false);
});

test('shouldReuseItemsCache: ISO 文字列の時刻も toMs で扱える', () => {
    const cache = { items: [{ issue: 1 }], at: '2026-07-26T00:00:00.000Z' };
    const now = Date.parse('2026-07-26T00:00:10.000Z');
    assert.equal(shouldReuseItemsCache({ now, cache, maxAgeMs: 150_000 }), true);
});

test('shouldRefreshBoardPeriodic: 直近観測されていれば毎回走る', () => {
    const now = 1_000_000;
    assert.equal(shouldRefreshBoardPeriodic({
        now, watchedAt: now - 10_000, lastBoardAt: now - 10_000,
        watchTtlMs: BOARD_WATCH_TTL_MS, upkeepMs: BOARD_UPKEEP_MS,
    }), true);
});

test('shouldRefreshBoardPeriodic: 未観測 & アップキープ未満はスキップ', () => {
    const now = 1_000_000;
    assert.equal(shouldRefreshBoardPeriodic({
        now, watchedAt: now - (BOARD_WATCH_TTL_MS + 60_000), lastBoardAt: now - 60_000,
        watchTtlMs: BOARD_WATCH_TTL_MS, upkeepMs: BOARD_UPKEEP_MS,
    }), false);
});

test('shouldRefreshBoardPeriodic: 未観測でもアップキープ超過なら1度走る（トラッカー維持）', () => {
    const now = 1_000_000;
    assert.equal(shouldRefreshBoardPeriodic({
        now, watchedAt: null, lastBoardAt: now - (BOARD_UPKEEP_MS + 1),
        watchTtlMs: BOARD_WATCH_TTL_MS, upkeepMs: BOARD_UPKEEP_MS,
    }), true);
});

test('shouldRefreshBoardPeriodic: board 未構築（lastBoardAt=null）なら走る', () => {
    const now = 1_000_000;
    assert.equal(shouldRefreshBoardPeriodic({
        now, watchedAt: null, lastBoardAt: null,
        watchTtlMs: BOARD_WATCH_TTL_MS, upkeepMs: BOARD_UPKEEP_MS,
    }), true);
});

test('BOARD_WATCH_TTL_MS / BOARD_UPKEEP_MS は妥当な既定値', () => {
    assert.ok(BOARD_WATCH_TTL_MS > 0 && BOARD_WATCH_TTL_MS < BOARD_UPKEEP_MS);
});
