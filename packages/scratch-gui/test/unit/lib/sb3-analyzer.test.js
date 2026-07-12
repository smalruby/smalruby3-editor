import { analyzeProject, isHatOpcode, collectReachable } from '../../../src/lib/classroom-evaluation/sb3-analyzer';

/**
 * Minimal synthetic project.json: one sprite with
 *  - wired script: flag → forever → [if <touching> then move] + play sound
 *  - unwired fragment: a lone move block (topLevel, no hat)
 *  - a shadow block (menu) that must not count
 */
const project = () => ({
    targets: [
        {
            isStage: true,
            name: 'Stage',
            blocks: {},
        },
        {
            isStage: false,
            name: 'ねこ',
            blocks: {
                hat1: { opcode: 'event_whenflagclicked', next: 'loop1', topLevel: true },
                loop1: {
                    opcode: 'control_forever',
                    next: null,
                    inputs: { SUBSTACK: [2, 'if1'] },
                },
                if1: {
                    opcode: 'control_if',
                    next: 'snd1',
                    inputs: { CONDITION: [2, 'touch1'], SUBSTACK: [2, 'move1'] },
                },
                touch1: {
                    opcode: 'sensing_touchingobject',
                    inputs: { TOUCHINGOBJECTMENU: [1, 'menu1'] },
                },
                menu1: {
                    opcode: 'sensing_touchingobjectmenu',
                    shadow: true,
                    fields: { TOUCHINGOBJECTMENU: ['_mouse_', null] },
                },
                move1: {
                    opcode: 'motion_movesteps',
                    next: null,
                    inputs: { STEPS: [1, [4, '10']] },
                },
                snd1: {
                    opcode: 'sound_playuntildone',
                    next: null,
                    inputs: { SOUND_MENU: [1, 'sndmenu1'] },
                },
                sndmenu1: {
                    opcode: 'sound_sounds_menu',
                    shadow: true,
                    fields: { SOUND_MENU: ['ニャー', null] },
                },
                stray1: { opcode: 'motion_movesteps', next: null, topLevel: true, inputs: { STEPS: [1, [4, '5']] } },
            },
        },
    ],
});

describe('isHatOpcode', () => {
    test('detects event hats, extension hats, and procedure definitions', () => {
        expect(isHatOpcode('event_whenflagclicked')).toBe(true);
        expect(isHatOpcode('microbitMore_whenButtonEvent')).toBe(true);
        expect(isHatOpcode('procedures_definition')).toBe(true);
        expect(isHatOpcode('motion_movesteps')).toBe(false);
        expect(isHatOpcode('control_wait_until')).toBe(false);
    });
});

describe('collectReachable', () => {
    test('walks next chains, substacks, and reporter inputs', () => {
        const blocks = project().targets[1].blocks;
        const reachable = collectReachable(blocks, 'hat1');
        expect(reachable.has('loop1')).toBe(true);
        expect(reachable.has('if1')).toBe(true);
        expect(reachable.has('touch1')).toBe(true);
        expect(reachable.has('move1')).toBe(true);
        expect(reachable.has('snd1')).toBe(true);
        expect(reachable.has('stray1')).toBe(false);
    });
});

describe('analyzeProject', () => {
    test('extracts signals', () => {
        const { signals } = analyzeProject(project());
        expect(signals.spriteCount).toBe(1);
        expect(signals.scriptCount).toBe(2);
        expect(signals.wiredScriptCount).toBe(1);
        expect(signals.usesLoops).toBe(true);
        expect(signals.usesConditionals).toBe(true);
        expect(signals.usesVariables).toBe(false);
        expect(signals.wiredSoundBlockCount).toBe(1);
        expect(signals.changedSprites).toBe(true); // 'ねこ' is not a default name
        expect(signals.categories).toEqual(
            expect.arrayContaining(['event', 'control', 'motion', 'sound', 'sensing']),
        );
        // Shadow menu blocks must not count as real blocks: hat, forever,
        // if, touching, move, sound, stray = 7
        expect(signals.totalBlocks).toBe(7);
    });

    test('reconstructs readable pseudocode with nesting and args', () => {
        const { pseudocode } = analyzeProject(project());
        expect(pseudocode).toContain('=== スプライト: ねこ ===');
        expect(pseudocode).toContain('◆ スクリプト:');
        expect(pseudocode).toContain('緑の旗が押されたとき');
        expect(pseudocode).toContain('ずっと');
        // Nested condition resolves the shadow menu value
        expect(pseudocode).toContain('もし _mouse_ に触れた なら');
        // Substack indentation: move is one level deeper than if
        const lines = pseudocode.split('\n');
        const ifLine = lines.find((l) => l.includes('もし'));
        const moveLine = lines.find((l) => l.includes('10 歩動かす'));
        expect(moveLine.length - moveLine.trimStart().length).toBeGreaterThan(
            ifLine.length - ifLine.trimStart().length,
        );
        // Sound arg resolved from its shadow menu
        expect(pseudocode).toContain('終わるまで ニャー の音を鳴らす');
        // Unwired fragment marked distinctly
        expect(pseudocode).toContain('◇ スクリプト:');
    });

    test('unknown opcodes fall back to auditable raw form', () => {
        const p = project();
        p.targets[1].blocks.ext1 = {
            opcode: 'koshien_getMapArea',
            next: null,
            topLevel: true,
            fields: { AREA: ['A1', null] },
        };
        const { pseudocode } = analyzeProject(p);
        expect(pseudocode).toContain('[koshien_getMapArea] AREA=A1');
    });

    test('handles empty / malformed projects gracefully', () => {
        expect(analyzeProject({}).signals.totalBlocks).toBe(0);
        expect(analyzeProject(null).signals.spriteCount).toBe(0);
        expect(analyzeProject({ targets: [] }).pseudocode).toBe('');
    });
});
