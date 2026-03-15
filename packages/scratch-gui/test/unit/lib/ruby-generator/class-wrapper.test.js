import RubyGenerator from '../../../../src/lib/ruby-generator';

describe('RubyGenerator class-wrapper helpers', () => {
    beforeEach(() => {
        RubyGenerator.cache_ = {};
        RubyGenerator.definitions_ = {};
        RubyGenerator.functionNames_ = {};
        RubyGenerator.currentTarget = null;
    });

    describe('_isValidClassName', () => {
        test('accepts PascalCase names', () => {
            expect(RubyGenerator._isValidClassName('Sprite1')).toBe(true);
            expect(RubyGenerator._isValidClassName('MyClass')).toBe(true);
        });

        test('rejects lowercase start', () => {
            expect(RubyGenerator._isValidClassName('sprite1')).toBe(false);
        });

        test('rejects names with spaces', () => {
            expect(RubyGenerator._isValidClassName('My Class')).toBe(false);
        });

        test('accepts Unicode letters (Japanese)', () => {
            expect(RubyGenerator._isValidClassName('Aスプライト')).toBe(true);
        });

        test('rejects empty string', () => {
            expect(RubyGenerator._isValidClassName('')).toBe(false);
        });
    });

    describe('_generateSetXxx', () => {
        test('generates set_x for non-default x', () => {
            const target = {x: 50, y: 0, direction: 90, visible: true, size: 100, currentCostume: 0, rotationStyle: 'all around', sprite: {}};
            const setLines = [];
            RubyGenerator._generateSetXxx(target, setLines, [], true);
            expect(setLines).toEqual(['set_x 50']);
        });

        test('generates multiple set_xxx for multiple non-defaults', () => {
            const target = {x: 10, y: 20, direction: 45, visible: true, size: 100, currentCostume: 0, rotationStyle: 'all around', sprite: {}};
            const setLines = [];
            RubyGenerator._generateSetXxx(target, setLines, [], true);
            expect(setLines).toContain('set_x 10');
            expect(setLines).toContain('set_y 20');
            expect(setLines).toContain('set_direction 45');
        });

        test('skips attributes not in allowedAttributes when not autoAll', () => {
            const target = {x: 50, y: 20, direction: 90, visible: true, size: 100, currentCostume: 0, rotationStyle: 'all around', sprite: {}};
            const setLines = [];
            RubyGenerator._generateSetXxx(target, setLines, ['x'], false);
            expect(setLines).toEqual(['set_x 50']);
        });

        test('generates set_costumes', () => {
            const target = {x: 0, y: 0, direction: 90, visible: true, size: 100, currentCostume: 0, rotationStyle: 'all around',
                sprite: {costumes: [{name: 'cat'}, {name: 'dog'}]}};
            const setLines = [];
            RubyGenerator._generateSetXxx(target, setLines, ['costumes'], false);
            expect(setLines).toEqual(['set_costumes ["cat", "dog"]']);
        });
    });

    describe('_generateStageSetXxx', () => {
        test('generates set_current_backdrop for non-default', () => {
            const target = {currentCostume: 2, sprite: {}};
            const setLines = [];
            RubyGenerator._generateStageSetXxx(target, setLines, ['current_backdrop'], false);
            expect(setLines).toEqual(['set_current_backdrop 3']);
        });

        test('generates set_backdrops', () => {
            const target = {currentCostume: 0, sprite: {costumes: [{name: 'bg1'}, {name: 'bg2'}]}};
            const setLines = [];
            RubyGenerator._generateStageSetXxx(target, setLines, ['backdrops'], false);
            expect(setLines).toEqual(['set_backdrops ["bg1", "bg2"]']);
        });
    });
});
