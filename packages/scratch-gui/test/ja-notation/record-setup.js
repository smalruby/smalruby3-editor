/**
 * Jest setup for collecting the corpus (issue #2095): wraps `dnclToRuby` and `rubyToDncl` so every
 * code a test passes to them is appended to the file in `JA_CORPUS_RECORD` (one JSON per line).
 * Used only by `collect-corpus.mjs`; the unit tests do not load it.
 */
const mockPath = require('path');

const mockRecord = (kind, text) => {
    // Required here, not at the top: a jest.mock factory may only use what it requires itself.
    // eslint-disable-next-line global-require
    const fs = require('fs');
    const state = expect.getState();
    const from = mockPath.relative(mockPath.resolve(__dirname, '../..'), state.testPath || '');
    const line = JSON.stringify({ kind, text, from, test: state.currentTestName || '' });
    fs.appendFileSync(process.env.JA_CORPUS_RECORD, `${line}\n`);
};

// babel-jest hoists jest.mock above the constants, so the paths are made in place.
jest.mock(require('path').resolve(__dirname, '../../src/lib/dncl/dncl-to-ruby'), () => {
    const actual = jest.requireActual(require('path').resolve(__dirname, '../../src/lib/dncl/dncl-to-ruby'));
    return {
        ...actual,
        dnclToRuby: (source) => {
            if (typeof source === 'string') mockRecord('ja', source);
            return actual.dnclToRuby(source);
        },
    };
});

jest.mock(require('path').resolve(__dirname, '../../src/lib/dncl/ruby-to-dncl'), () => {
    const actual = jest.requireActual(require('path').resolve(__dirname, '../../src/lib/dncl/ruby-to-dncl'));
    return {
        ...actual,
        rubyToDncl: (source) => {
            if (typeof source === 'string') mockRecord('ruby', source);
            return actual.rubyToDncl(source);
        },
    };
});
