// Students' troubles in the Ruby tab's Japanese (DNCL) mode for the prompt lab
// (#1403). The editor's DNCL comes from the examples in test/fixtures/dncl/ (`file`), or
// is written here (`code`) when the student has only started. The lab fills in the
// editor's errors from the code, as the editor would show them.
import fs from 'fs';
import path from 'path';

const FIXTURES = path.resolve(__dirname, '../fixtures/dncl');

// The first `#` lines of an example say what is wrong with it: not what the student has.
const studentCode = (file) => fs.readFileSync(path.join(FIXTURES, file), 'utf8').replace(/^(#[^\n]*\n)+/, '');

const dnclScenarios = [
    {
        id: 'dncl-max',
        kind: 'wrong-answer',
        text: 'いちばん大きい数を表示したいのに、全部マイナスの数のときに 0 と表示されてしまう',
        file: 'pitfalls/max-start-zero.dncl',
    },
    {
        id: 'dncl-search',
        kind: 'how-write',
        text: '配列 Data の中から 7 を探して、見つかったら何番目か（添字）を表示し、無ければ「見つからない」と表示したい',
        code: 'Data = [4, 9, 7, 1, 3]\n',
    },
    {
        id: 'dncl-sort',
        kind: 'how-think',
        text: 'バブルソートで配列を小さい順に並べ替える問題で、どう考えればいいかわからない',
        code: 'Data = [5, 3, 8, 1, 4]\n表示する(Data)\n',
    },
    {
        id: 'dncl-average',
        kind: 'error',
        text: '点数の合計と平均を出したいのにエラーが出る',
        file: 'broken/missing-loop-close.dncl',
    },
    {
        id: 'dncl-count-even',
        kind: 'wrong-answer',
        text: '問題文では添字が 1 から始まっていて、そのとおりに書いたら偶数の数が合わない',
        file: 'pitfalls/index-from-one.dncl',
    },
    {
        id: 'dncl-gcd',
        kind: 'error',
        text: '最大公約数を求める関数を作ったらエラーが出る',
        file: 'broken/assign-to-param.dncl',
    },
    {
        id: 'dncl-comment',
        kind: 'error',
        text: '1 から 10 までの合計を出したいのにエラーが出る',
        file: 'broken/double-slash-comment.dncl',
    },
    {
        id: 'dncl-binary-search',
        kind: 'how-write',
        text: '小さい順に並んだ配列から、二分探索で 9 を探したい',
        code: 'Data = [1, 3, 4, 7, 9, 11, 15]\n',
    },
].map(({ file, code, ...scenario }) => ({
    ...scenario,
    editingName: 'スプライト1',
    code: file ? studentCode(file) : code,
}));

export default dnclScenarios;
