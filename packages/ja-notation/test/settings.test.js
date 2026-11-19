// SPDX-License-Identifier: MIT
// The settings of a program: read from the sentences at the top, kept in the
// JaAST (`program.settings`), and done on the syntax tree both ways
// (data: ./data/settings.json).
import assert from 'node:assert/strict';
import { before, describe, test } from 'node:test';
import {
    DEFAULT_SETTINGS,
    jaToRuby,
    parse,
    readSettings,
    rubyToJa,
    SETTINGS_PATTERNS,
    settingsOfSource,
    settingsSentences,
    withSettings,
} from '../src/index.js';
import { plain, prism, readData } from './helpers.js';

const data = readData('settings.json');

describe('the settings', () => {
    test('the defaults', () => {
        assert.deepEqual(DEFAULT_SETTINGS, data.defaults);
    });

    data.read.forEach(({ comments, settings }) => {
        test(`readSettings ${JSON.stringify(comments)}`, () => {
            assert.deepEqual(readSettings(comments), settings);
        });
    });

    data.sentences.forEach(({ settings, sentences }) => {
        test(`settingsSentences ${JSON.stringify(settings)}, read back the same`, () => {
            assert.deepEqual(settingsSentences(settings), sentences);
            assert.deepEqual(readSettings(sentences), settings);
        });
    });

    data.programs.forEach(({ title, ja, settings }) => {
        test(title, () => {
            assert.deepEqual(plain(parse(ja).program.settings), settings);
        });
    });

    data.withSettings.forEach(({ title, source, settings, out }) => {
        test(`withSettings: ${title}`, () => {
            const written = withSettings(source, settings);
            assert.equal(written, out);
            assert.deepEqual(settingsOfSource(written), { ...DEFAULT_SETTINGS, ...settings });
            assert.equal(withSettings(written, settings), written);
        });
    });

    data.settingsOfSource.forEach(({ source, settings }) => {
        test(`settingsOfSource ${JSON.stringify(source)}`, () => {
            assert.deepEqual(settingsOfSource(source), settings);
        });
    });

    test('the patterns: the form of 例示 is the default, each says its settings', () => {
        assert.deepEqual(
            SETTINGS_PATTERNS.map(({ id }) => id),
            ['example', 'indexFromOne'],
        );
        assert.deepEqual(SETTINGS_PATTERNS[0].settings, DEFAULT_SETTINGS);
        assert.deepEqual(SETTINGS_PATTERNS[1].settings, { indexBase: 1, commentMarker: '#', logicNote: true });
    });
});

describe('the settings both ways, with no table', () => {
    let prismParse;
    before(async () => {
        prismParse = await prism();
    });

    data.jaToRuby.forEach(({ ja, ruby }) => {
        test(`Japanese → Ruby → Japanese: ${ja.split('\n').at(-1)}`, () => {
            const made = jaToRuby(ja, {});
            assert.deepEqual(plain(made.errors), []);
            assert.equal(made.ruby, ruby);
            const back = rubyToJa(made.ruby, { parse: prismParse });
            assert.deepEqual(plain(back.errors), []);
            assert.equal(back.ja, ja);
        });
    });

    data.rubyToJa.forEach(({ ruby, ja }) => {
        test(`Ruby → Japanese → Ruby: ${ruby.split('\n').at(-1)}`, () => {
            const back = rubyToJa(ruby, { parse: prismParse });
            assert.deepEqual(plain(back.errors), []);
            assert.equal(back.ja, ja);
            assert.equal(jaToRuby(back.ja, {}).ruby, ruby);
        });
    });
});
