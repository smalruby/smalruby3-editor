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

    describe('_generateInitialize', () => {
        test('generates def initialize for sprite with instance variables', () => {
            const target = {
                isStage: false,
                variables: {
                    v1: {name: 'x', type: '', value: 10},
                    v2: {name: 'name', type: '', value: 'hello'}
                }
            };
            const lines = RubyGenerator._generateInitialize(target, []);
            expect(lines).toContain('def initialize');
            expect(lines).toContain('  @name = "hello"');
            expect(lines).toContain('  @x = 10');
            expect(lines).toContain('end');
        });

        test('generates def initialize for sprite with lists', () => {
            const target = {
                isStage: false,
                variables: {
                    l1: {name: 'items', type: 'list', value: ['a', 'b']}
                }
            };
            const lines = RubyGenerator._generateInitialize(target, []);
            expect(lines).toContain('def initialize');
            expect(lines).toContain('  @items = ["a", "b"]');
            expect(lines).toContain('end');
        });

        test('generates def initialize for stage with global variables', () => {
            const target = {
                isStage: true,
                variables: {
                    v1: {name: 'score', type: '', value: 100}
                }
            };
            const lines = RubyGenerator._generateInitialize(target, []);
            expect(lines).toContain('def initialize');
            expect(lines).toContain('  $score = 100');
            expect(lines).toContain('end');
        });

        test('returns empty array when no variables', () => {
            const target = {
                isStage: false,
                variables: {}
            };
            const lines = RubyGenerator._generateInitialize(target, []);
            expect(lines).toHaveLength(0);
        });

        test('excludes _return_ variables', () => {
            const target = {
                isStage: false,
                variables: {
                    v1: {name: 'x', type: '', value: 10},
                    v2: {name: '_return_foo_', type: '', value: ''}
                }
            };
            const lines = RubyGenerator._generateInitialize(target, []);
            expect(lines).toContain('  @x = 10');
            expect(lines.join('\n')).not.toMatch(/_return_/);
        });

        test('excludes local variables matching LOCAL_VARIABLE_PATTERN', () => {
            const target = {
                isStage: false,
                variables: {
                    v1: {name: 'x', type: '', value: 10},
                    v2: {name: '_temp_1_', type: '', value: 0}
                }
            };
            const lines = RubyGenerator._generateInitialize(target, []);
            expect(lines).toContain('  @x = 10');
            expect(lines.join('\n')).not.toMatch(/_temp_1_/);
        });

        test('sorts variables alphabetically', () => {
            const target = {
                isStage: false,
                variables: {
                    v1: {name: 'z_var', type: '', value: 3},
                    v2: {name: 'a_var', type: '', value: 1},
                    v3: {name: 'm_var', type: '', value: 2}
                }
            };
            const lines = RubyGenerator._generateInitialize(target, []);
            const bodyLines = lines.filter(l => l.startsWith('  @'));
            expect(bodyLines[0]).toBe('  @a_var = 1');
            expect(bodyLines[1]).toBe('  @m_var = 2');
            expect(bodyLines[2]).toBe('  @z_var = 3');
        });

        test('excludes broadcast message variables', () => {
            const target = {
                isStage: true,
                variables: {
                    v1: {name: 'score', type: '', value: 10},
                    b1: {name: 'message1', type: 'broadcast_msg', value: 'message1'}
                }
            };
            const lines = RubyGenerator._generateInitialize(target, []);
            expect(lines.join('\n')).not.toMatch(/message1/);
            expect(lines).toContain('  $score = 10');
        });

        test('restores args from comment', () => {
            const target = {
                isStage: false,
                variables: {
                    v1: {name: 'x', type: '', value: 10}
                }
            };
            const commentTexts = ['@ruby:initialize:args=(a, b)'];
            const lines = RubyGenerator._generateInitialize(target, commentTexts);
            expect(lines[0]).toBe('def initialize(a, b)');
        });

        test('restores super from comment', () => {
            const target = {
                isStage: false,
                variables: {
                    v1: {name: 'x', type: '', value: 10}
                }
            };
            const commentTexts = ['@ruby:initialize:super'];
            const lines = RubyGenerator._generateInitialize(target, commentTexts);
            expect(lines).toContain('  super');
        });

        test('restores super with args from comment', () => {
            const target = {
                isStage: false,
                variables: {
                    v1: {name: 'x', type: '', value: 10}
                }
            };
            const commentTexts = ['@ruby:initialize:args=(a),super=(a)'];
            const lines = RubyGenerator._generateInitialize(target, commentTexts);
            expect(lines[0]).toBe('def initialize(a)');
            expect(lines).toContain('  super(a)');
        });
    });
});
