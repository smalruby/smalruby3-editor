import RubyGenerator from '../../../../src/lib/ruby-generator';

describe('RubyGenerator variable helpers', () => {
    const SCALAR_TYPE = '';
    const LIST_TYPE = 'list';

    beforeEach(() => {
        RubyGenerator.cache_ = {};
        RubyGenerator.definitions_ = {};
        RubyGenerator.functionNames_ = {};
        RubyGenerator.currentTarget = null;
    });

    describe('escapeVariableName', () => {
        test('replaces special characters with underscore', () => {
            expect(RubyGenerator.escapeVariableName('a b')).toEqual('a_b');
            expect(RubyGenerator.escapeVariableName('Avg(Total / Count)'))
                .toEqual('Avg_Total___Count_');
        });

        test('preserves multibyte characters', () => {
            expect(RubyGenerator.escapeVariableName('平均(合計 / 件数)'))
                .toEqual('平均_合計___件数_');
        });

        test('preserves alphanumeric and underscore', () => {
            expect(RubyGenerator.escapeVariableName('abc_123')).toEqual('abc_123');
        });
    });

    describe('escapeMethodName', () => {
        test('is the same function as escapeVariableName', () => {
            expect(RubyGenerator.escapeMethodName).toBe(RubyGenerator.escapeVariableName);
        });
    });

    describe('makeVariableName', () => {
        test('prefixes with @ for sprite variables', () => {
            expect(RubyGenerator.makeVariableName(false, 'foo')).toEqual('@foo');
        });

        test('prefixes with $ for stage variables', () => {
            expect(RubyGenerator.makeVariableName(true, 'foo')).toEqual('$foo');
        });

        test('escapes special characters in name', () => {
            expect(RubyGenerator.makeVariableName(false, 'my var')).toEqual('@my_var');
        });
    });

    describe('variableName', () => {
        let renderedTarget;

        beforeEach(() => {
            renderedTarget = {
                sprite: {name: 'Sprite1'},
                comments: {},
                variables: {
                    id1: {name: 'Var1', type: SCALAR_TYPE},
                    id2: {name: 'List1', type: LIST_TYPE}
                },
                runtime: {
                    getTargetForStage () {
                        return {
                            variables: {
                                id3: {name: 'GlobalVar', type: SCALAR_TYPE}
                            }
                        };
                    }
                }
            };
            RubyGenerator.currentTarget = renderedTarget;
        });

        test('returns @name for sprite scalar variable', () => {
            expect(RubyGenerator.variableName('id1')).toEqual('@Var1');
        });

        test('returns null for type mismatch', () => {
            expect(RubyGenerator.variableName('id2')).toEqual(null);
        });

        test('returns $name for stage variable accessed from sprite', () => {
            expect(RubyGenerator.variableName('id3')).toEqual('$GlobalVar');
        });

        test('returns null for unknown id', () => {
            expect(RubyGenerator.variableName('unknown')).toEqual(null);
        });
    });

    describe('listName', () => {
        beforeEach(() => {
            RubyGenerator.currentTarget = {
                sprite: {name: 'Sprite1'},
                comments: {},
                variables: {
                    id1: {name: 'MyList', type: LIST_TYPE}
                }
            };
        });

        test('returns @name for sprite list variable', () => {
            expect(RubyGenerator.listName('id1')).toEqual('@MyList');
        });
    });

    describe('variableNameByName', () => {
        beforeEach(() => {
            RubyGenerator.currentTarget = {
                sprite: {name: 'Sprite1'},
                comments: {},
                isStage: false,
                lookupVariableByNameAndType (name, type) {
                    if (name === 'LocalVar' && type === SCALAR_TYPE) {
                        return {name: 'LocalVar', type: SCALAR_TYPE};
                    }
                    return null;
                },
                runtime: {
                    getTargetForStage () {
                        return {
                            lookupVariableByNameAndType (name, type) {
                                if (name === 'StageVar' && type === SCALAR_TYPE) {
                                    return {name: 'StageVar', type: SCALAR_TYPE};
                                }
                                return null;
                            }
                        };
                    }
                }
            };
        });

        test('returns $name for stage variable (checked first)', () => {
            expect(RubyGenerator.variableNameByName('StageVar')).toEqual('$StageVar');
        });

        test('returns @name for local variable', () => {
            expect(RubyGenerator.variableNameByName('LocalVar')).toEqual('@LocalVar');
        });

        test('returns null for unknown name', () => {
            expect(RubyGenerator.variableNameByName('Unknown')).toEqual(null);
        });
    });

    describe('listNameByName', () => {
        beforeEach(() => {
            RubyGenerator.currentTarget = {
                sprite: {name: 'Sprite1'},
                comments: {},
                isStage: false,
                lookupVariableByNameAndType (name, type) {
                    if (name === 'MyList' && type === LIST_TYPE) {
                        return {name: 'MyList', type: LIST_TYPE};
                    }
                    return null;
                },
                runtime: {
                    getTargetForStage () {
                        return {
                            lookupVariableByNameAndType () {
                                return null;
                            }
                        };
                    }
                }
            };
        });

        test('returns @name for local list', () => {
            expect(RubyGenerator.listNameByName('MyList')).toEqual('@MyList');
        });
    });
});
