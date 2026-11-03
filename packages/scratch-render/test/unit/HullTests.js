// === Smalruby: This file is Smalruby-specific (hull.js pinned to 0.2.1 for GHSA-q849-wxrc-vqrp) ===
const {test} = require('tap');

const hull = require('hull.js');
const hullPackage = require('hull.js/package.json');

const parseVersion = version => version.split('.').map(n => parseInt(n, 10));
const compareVersions = (a, b) => {
    const pa = parseVersion(a);
    const pb = parseVersion(b);
    for (let i = 0; i < 3; i++) {
        if (pa[i] !== pb[i]) return pa[i] - pb[i];
    }
    return 0;
};

// GHSA-q849-wxrc-vqrp: 0.2.2 <= version < 1.0.10 is flagged as critical by npm audit.
// The fixed 1.0.10 is not published to npm, so we stay on 0.2.1 (the last version before the range).
// This guard catches an upstream merge that silently restores "hull.js": "0.2.10".
test('hull.js is outside the GHSA-q849-wxrc-vqrp vulnerable range', t => {
    const version = hullPackage.version;
    const vulnerable = compareVersions(version, '0.2.2') >= 0 && compareVersions(version, '1.0.10') < 0;
    t.notOk(vulnerable, `hull.js ${version} must not be in >=0.2.2 <1.0.10`);
    t.end();
});

// RenderWebGL._getConvexHullPointsForDrawable passes its left/right hull points to
// hull(points, Infinity). These are the outputs of 0.2.10 (the upstream version) for
// representative inputs, so a different hull.js must keep the same convex hull.
test('hull(points, Infinity) keeps the convex hull used by RenderWebGL', t => {
    const cases = [
        {name: 'single pixel', points: [[3, 4], [3, 4]], expected: [[3, 4], [3, 4]]},
        {name: 'single row', points: [[0, 0], [5, 0], [5, 0], [0, 0]], expected: [[5, 0], [0, 0], [5, 0]]},
        {
            name: 'square',
            points: [[0, 0], [0, 9], [9, 9], [9, 0]],
            expected: [[9, 9], [0, 9], [0, 0], [9, 0], [9, 9]]
        },
        {
            name: 'square with collinear points',
            points: [[0, 0], [0, 5], [0, 9], [9, 9], [9, 5], [9, 0]],
            expected: [[9, 9], [0, 9], [0, 0], [9, 0], [9, 9]]
        },
        {
            name: 'diamond',
            points: [[5, 0], [0, 5], [5, 10], [10, 5], [5, 0]],
            expected: [[10, 5], [5, 10], [0, 5], [5, 0], [10, 5]]
        },
        {
            name: 'duplicated points',
            points: [[2, 0], [0, 3], [0, 3], [1, 6], [4, 6], [6, 3], [6, 3], [4, 0]],
            expected: [[6, 3], [4, 6], [1, 6], [0, 3], [2, 0], [4, 0], [6, 3]]
        }
    ];
    for (const {name, points, expected} of cases) {
        t.same(hull(points, Infinity), expected, name);
    }
    t.end();
});
