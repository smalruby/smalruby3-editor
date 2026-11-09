// The Ruby tab's panel does not talk about blocks: the check turns the answer into blocks
// to see that it runs, but the student only reads whether the program has a problem (#1446).
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import GenaiAnswerSteps from '../../../src/components/genai-concierge/genai-answer-steps.jsx';
// eslint-disable-next-line import/first
import { runTakeover } from '../../../src/lib/genai-takeover.js';
import ja from '../../../src/locales/ja.js';

jest.mock('../../../src/lib/genai-takeover.js', () => ({
    ...jest.requireActual('../../../src/lib/genai-takeover.js'),
    runTakeover: jest.fn(),
}));

const okResult = {
    ok: true,
    code: 'move(10)\n',
    parts: [{ name: 'Abby', code: 'move(10)\n', changes: [], lines: { added: 1, changed: 0, removed: 0 } }],
    fixes: [],
    problems: [],
};

const ngResult = {
    ok: false,
    code: 'class Foo\nend\nfoo.bar\n',
    parts: [],
    fixes: [],
    problems: [
        { type: 'classDef', source: 'class Foo', line: 1 },
        { type: 'raw', count: 2 },
    ],
};

// tab: 'code' (the code tab), 'ruby' or 'dncl' (modes of the Ruby tab; furigana is 'ruby').
const adapterOf = (tab, result) => ({
    check: jest.fn(() => Promise.resolve(result)),
    apply: jest.fn(),
    switchSides: jest.fn(),
    watchMarks: jest.fn(() => () => {}),
    takeoverState: jest.fn(() => ({})),
    takeoverMessage: jest.fn(() => 'first'),
    ...(tab === 'code' ? {} : { mountDiff: jest.fn(() => () => {}), puts: 'code', language: tab }),
});

const renderSteps = (tab, result, locale = 'ja') => {
    const noop = () => {};
    render(
        <IntlProvider locale={locale} messages={locale === 'ja' ? ja : {}}>
            <GenaiAnswerSteps
                vm={{}}
                adapter={adapterOf(tab, result)}
                step="paste"
                open
                rubyteeAvailable
                onStep={noop}
                onCopy={noop}
                onShowBlocks={noop}
                onClearNotice={noop}
                onClose={noop}
                onFinish={noop}
                onReset={noop}
            />
        </IntlProvider>,
    );
};

const paste = () => fireEvent.change(screen.getByTestId('genai-answer'), { target: { value: 'answer' } });

// A new answer: changing it takes the last result away and brings the check button back.
const paste2 = () => {
    fireEvent.click(screen.getByTestId('genai-answer-toggle'));
    fireEvent.change(screen.getByTestId('genai-answer'), { target: { value: 'answer 2' } });
};

const convert = async () => {
    await act(async () => {
        fireEvent.click(screen.getByTestId('genai-convert'));
        await new Promise((resolve) => setTimeout(resolve, 100));
    });
};

const panelText = () => document.body.textContent;

describe('GenaiAnswerSteps words (#1446)', () => {
    afterEach(() => runTakeover.mockReset());

    describe.each(['ruby', 'dncl'])('the Ruby tab (%s)', (tab) => {
        test('the button and the spinner say the program is checked', async () => {
            renderSteps(tab, okResult);
            paste();
            expect(screen.getByTestId('genai-convert')).toHaveTextContent('プログラムを確かめる');
            await act(async () => {
                fireEvent.click(screen.getByTestId('genai-convert'));
                await new Promise((resolve) => setTimeout(resolve, 10));
            });
            expect(screen.getByTestId('genai-checking')).toHaveTextContent('プログラムを確かめています');
            await act(() => new Promise((resolve) => setTimeout(resolve, 100)));
            expect(panelText()).not.toMatch(/ブロック/);
        });

        test('✔ says no problem was found, without blocks', async () => {
            renderSteps(tab, okResult);
            paste();
            await convert();
            expect(screen.getByTestId('genai-convert-ok')).toHaveTextContent('問題は見つかりませんでした');
            expect(panelText()).not.toMatch(/ブロック/);
        });

        test('✗ and its problems say the program has a problem, without blocks', async () => {
            renderSteps(tab, ngResult);
            paste();
            await convert();
            const ng = screen.getByTestId('genai-convert-ng');
            expect(ng).toHaveTextContent('このプログラムには問題があります');
            expect(ng).toHaveTextContent('クラスの定義（class Foo）は、スモウルビーでは使えません');
            expect(ng).toHaveTextContent('2 か所に、スモウルビーで使えない書き方があります');
            expect(panelText()).not.toMatch(/ブロック/);
        });

        test('in English too, the words do not talk about blocks', async () => {
            renderSteps(tab, ngResult, 'en');
            paste();
            expect(panelText()).not.toMatch(/block/i);
            await convert();
            expect(panelText()).not.toMatch(/block/i);
        });
    });

    test('Rubytee failing in the Ruby tab says a problem is left, without blocks', async () => {
        runTakeover.mockResolvedValue({ ok: false, tries: 3, text: 'x', result: ngResult });
        renderSteps('ruby', ngResult);
        paste();
        await convert();
        paste2();
        await convert();
        await act(async () => {
            fireEvent.click(screen.getByTestId('genai-takeover'));
            await new Promise((resolve) => setTimeout(resolve, 10));
        });
        expect(screen.getByTestId('genai-takeover-failed')).toHaveTextContent('3 回書き直しても、問題が残りました');
        expect(panelText()).not.toMatch(/ブロック/);
    });

    test('Ruby and furigana modes have no "See the Ruby": the answer is Ruby already', async () => {
        renderSteps('ruby', okResult);
        paste();
        await convert();
        expect(screen.queryByTestId('genai-ruby-toggle')).toBeNull();
    });

    test('the DNCL mode keeps "See the program"', async () => {
        renderSteps('dncl', okResult);
        paste();
        await convert();
        expect(screen.getByTestId('genai-ruby-toggle')).toHaveTextContent('プログラムを見る');
    });

    describe('the code tab keeps its words', () => {
        test('the button, ✔ and "See the Ruby"', async () => {
            renderSteps('code', okResult);
            paste();
            expect(screen.getByTestId('genai-convert')).toHaveTextContent('ブロックにできるか調べる');
            await convert();
            expect(screen.getByTestId('genai-convert-ok')).toHaveTextContent('ブロックにできます');
            expect(screen.getByTestId('genai-ruby-toggle')).toHaveTextContent('Ruby を見る');
        });

        test('✗ and its problems', async () => {
            renderSteps('code', ngResult);
            paste();
            await convert();
            const ng = screen.getByTestId('genai-convert-ng');
            expect(ng).toHaveTextContent('このままではブロックにできません');
            expect(ng).toHaveTextContent('クラスの定義（class Foo）はブロックにできません');
            expect(ng).toHaveTextContent('2 か所が、ふつうのブロックになりません');
        });

        test('Rubytee failing', async () => {
            runTakeover.mockResolvedValue({ ok: false, tries: 3, text: 'x', result: ngResult });
            renderSteps('code', ngResult);
            paste();
            await convert();
            paste2();
            await convert();
            await act(async () => {
                fireEvent.click(screen.getByTestId('genai-takeover'));
                await new Promise((resolve) => setTimeout(resolve, 10));
            });
            expect(screen.getByTestId('genai-takeover-failed')).toHaveTextContent('ブロックにできませんでした');
        });
    });
});
