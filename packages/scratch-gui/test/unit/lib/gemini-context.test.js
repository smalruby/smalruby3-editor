/**
 * Unit tests for gemini-context.js
 * Tests the system instruction builder and state section builder
 */

import {buildSystemInstruction, buildStateSection} from '../../../src/lib/gemini-context';

describe('gemini-context', () => {
    describe('buildSystemInstruction', () => {
        test('should return a non-empty string', () => {
            const instruction = buildSystemInstruction();
            expect(typeof instruction).toBe('string');
            expect(instruction.length).toBeGreaterThan(100);
        });

        test('should include smalruby method references', () => {
            const instruction = buildSystemInstruction();
            expect(instruction).toContain('move');
            expect(instruction).toContain('turn_right');
            expect(instruction).toContain('when_flag_clicked');
            expect(instruction).toContain('loop do');
        });

        test('should include sample programs', () => {
            const instruction = buildSystemInstruction();
            expect(instruction).toContain('point_towards("_mouse_")');
        });

        test('should include generation guidelines', () => {
            const instruction = buildSystemInstruction();
            expect(instruction).toContain('```ruby');
        });

        test('should include sprite state when provided', () => {
            const stateContext = {
                sprite: {name: 'ネコ', x: 10, y: 20, costumes: [{name: 'コスチューム1'}]}
            };
            const instruction = buildSystemInstruction(stateContext);
            expect(instruction).toContain('ネコ');
            expect(instruction).toContain('コスチューム1');
        });

        test('should include stage state when provided', () => {
            const stateContext = {
                stage: {costumes: [{name: '背景1'}], sounds: []}
            };
            const instruction = buildSystemInstruction(stateContext);
            expect(instruction).toContain('背景1');
        });

        test('should include loaded extensions when provided', () => {
            const stateContext = {
                vm: {extensions: ['music', 'pen']}
            };
            const instruction = buildSystemInstruction(stateContext);
            expect(instruction).toContain('music');
            expect(instruction).toContain('pen');
        });

        test('should not include state section header when no context provided', () => {
            const instruction = buildSystemInstruction();
            expect(instruction).not.toContain('## 現在の状態');
        });

        test('should not include state section header when empty context provided', () => {
            const instruction = buildSystemInstruction({});
            expect(instruction).not.toContain('## 現在の状態');
        });

        test('should not include extensions section when vm has no extensions', () => {
            const stateContext = {vm: {extensions: []}};
            const instruction = buildSystemInstruction(stateContext);
            expect(instruction).not.toContain('有効な拡張機能');
        });

        test('should explain that loops automatically wait one frame per iteration', () => {
            const instruction = buildSystemInstruction();
            expect(instruction).toMatch(/loop.*1フレーム|ループ.*1フレーム|毎.*ループ.*自動|自動.*待機/);
        });

        test('should warn against using sleep for animation/FPS adjustment', () => {
            const instruction = buildSystemInstruction();
            expect(instruction).toMatch(/next_costume.*sleep|sleep.*next_costume|アニメーション.*sleep|sleep.*アニメーション/);
        });

        test('should not include sleep(0.1) in sample code blocks', () => {
            const instruction = buildSystemInstruction();
            // サンプルプログラム（```rubyブロック内）にsleep(0.1)が含まれていないこと
            // コードブロックを抽出してチェック
            const codeBlocks = instruction.match(/```ruby[\s\S]*?```/g) || [];
            const codeContent = codeBlocks.join('\n');
            expect(codeContent).not.toContain('sleep(0.1)');
        });
    });

    describe('buildStateSection', () => {
        test('should return empty string when all args are undefined', () => {
            const section = buildStateSection(undefined, undefined, undefined);
            expect(section).toBe('');
        });

        test('should include sprite section when sprite is provided', () => {
            const sprite = {name: 'Cat', x: 50, y: -30};
            const section = buildStateSection(sprite, undefined, undefined);
            expect(section).toContain('現在編集中のスプライト');
            expect(section).toContain('Cat');
        });

        test('should include stage section when stage is provided', () => {
            const stage = {costumes: [], sounds: []};
            const section = buildStateSection(undefined, stage, undefined);
            expect(section).toContain('ステージ');
        });

        test('should include vm extensions when extensions exist', () => {
            const vm = {extensions: ['music', 'pen']};
            const section = buildStateSection(undefined, undefined, vm);
            expect(section).toContain('music');
            expect(section).toContain('pen');
        });

        test('should not include extensions when empty', () => {
            const vm = {extensions: []};
            const section = buildStateSection(undefined, undefined, vm);
            expect(section).not.toContain('有効な拡張機能');
        });

        test('should format sprite state in markdown', () => {
            const sprite = {name: 'TestSprite', x: 10};
            const section = buildStateSection(sprite, undefined, undefined);
            expect(section).toContain('### 現在編集中のスプライト: "TestSprite"');
        });
    });
});
