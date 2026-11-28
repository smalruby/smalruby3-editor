/* eslint-env jest */
// 日本語のプログラムを .txt で保存する（Issue #2453）
import { dnclTextBlob, dnclTextFilename } from '../../../../src/lib/dncl/dncl-download';

// jsdom's Blob has no text(): read it with a FileReader.
const readBlob = (blob) =>
    new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsText(blob, 'utf-8');
    });

describe('dncl-download', () => {
    test('the file is named by the project and the sprite', () => {
        expect(dnclTextFilename('作品', 'スプライト1')).toBe('作品_スプライト1_japanese.txt');
    });

    test('a project without a title or a sprite still has a name', () => {
        expect(dnclTextFilename('', '')).toBe('project_sprite_japanese.txt');
    });

    test('the program is saved in UTF-8 as the editor has it', async () => {
        const blob = dnclTextBlob('x ← 1\n表示する(x)\n');
        expect(blob.type).toBe('text/plain;charset=utf-8');
        expect(await readBlob(blob)).toBe('x ← 1\n表示する(x)\n');
    });
});
