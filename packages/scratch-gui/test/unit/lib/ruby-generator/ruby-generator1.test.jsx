import RubyGenerator from '../../../../src/lib/ruby-generator';

describe('RubyGenerator', () => {
    const SCALAR_TYPE = '';
    const LIST_TYPE = 'list';

    beforeEach(() => {
        RubyGenerator.cache_ = {};
        RubyGenerator.definitions_ = {};
        RubyGenerator.functionNames_ = {};

        RubyGenerator.currentTarget = null;
    });

    describe('quote_', () => {
        test('escape only " to \\"', async () => {
            const arg = '!"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~'; // eslint-disable-line
            const expected = '"!\\"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\\\]^_`abcdefghijklmnopqrstuvwxyz{|}~"'; // eslint-disable-line
            expect(RubyGenerator.quote_(arg)).toEqual(expected);
        });
    });

    describe('spriteName', () => {
        test('return self', async () => {
            RubyGenerator.currentTarget = {
                sprite: {
                    name: 'Sprite1'
                },
                comments: {}
            };
            expect(RubyGenerator.spriteName()).toEqual('self');
        });
    });

    describe('variableName, listName', () => {
        let renderedTarget;

        beforeEach(() => {
            renderedTarget = {
                sprite: {
                    name: 'Sprite1'
                },
                comments: {},
                variables: {
                    id1: {
                        name: 'Variable1',
                        type: SCALAR_TYPE
                    },
                    id2: {
                        name: 'List1',
                        type: LIST_TYPE
                    },
                    id3: {
                        name: 'Variable2',
                        type: SCALAR_TYPE
                    },
                    id4: {
                        name: 'List2',
                        type: LIST_TYPE
                    },
                    id2_1: {
                        name: 'Avg(Total / Count)',
                        type: SCALAR_TYPE
                    },
                    id2_2: {
                        name: 'List of Symbols.',
                        type: LIST_TYPE
                    },
                    id2_3: {
                        name: ' !"#$%&\'()*+,-./:;<=>?@[\\]^`{|}~]',
                        type: SCALAR_TYPE
                    },
                    id2_4: {
                        name: '平均(合計 / 件数)',
                        type: SCALAR_TYPE
                    },
                    id2_5: {
                        name: 'シンボル　配列。',
                        type: LIST_TYPE
                    }
                },
                runtime: {
                    getTargetForStage: function () {
                        return {
                            variables: {
                                id5: {
                                    name: 'Variable3',
                                    type: SCALAR_TYPE
                                },
                                id6: {
                                    name: 'List3',
                                    type: LIST_TYPE
                                }
                            }
                        };
                    }
                }
            };
            RubyGenerator.currentTarget = renderedTarget;
        });

        test('return @name if local variable', async () => {
            expect(RubyGenerator.variableName('id1')).toEqual('@Variable1');
            expect(RubyGenerator.listName('id2')).toEqual('@List1');
            expect(RubyGenerator.variableName('id3')).toEqual('@Variable2');
            expect(RubyGenerator.listName('id4')).toEqual('@List2');
        });

        test('return $name if global variable', async () => {
            expect(RubyGenerator.variableName('id5')).toEqual('$Variable3');
            expect(RubyGenerator.listName('id6')).toEqual('$List3');
        });

        test('return null if missmatch type', async () => {
            expect(RubyGenerator.listName('id1')).toEqual(null);
            expect(RubyGenerator.variableName('id2')).toEqual(null);
        });

        test('return null if not found', async () => {
            expect(RubyGenerator.variableName('unknown_id1')).toEqual(null);
            expect(RubyGenerator.listName('unknown_id2')).toEqual(null);
        });

        test('return $name if stage\'s local variable', async () => {
            renderedTarget.isStage = true;
            expect(RubyGenerator.variableName('id1')).toEqual('$Variable1');
            expect(RubyGenerator.listName('id2')).toEqual('$List1');
            expect(RubyGenerator.variableName('id3')).toEqual('$Variable2');
            expect(RubyGenerator.listName('id4')).toEqual('$List2');
        });

        test('return null if stage and not exist local variable', async () => {
            renderedTarget.isStage = true;
            expect(RubyGenerator.variableName('id5')).toEqual(null);
            expect(RubyGenerator.listName('id6')).toEqual(null);
        });

        test('escape except alphabet, number and _ to _', () => {
            expect(RubyGenerator.variableName('id2_1')).toEqual('@Avg_Total___Count_');
            expect(RubyGenerator.listName('id2_2')).toEqual('@List_of_Symbols_');
            expect(RubyGenerator.variableName('id2_3')).toEqual('@_________________________________');

            renderedTarget.isStage = true;
            expect(RubyGenerator.variableName('id2_1')).toEqual('$Avg_Total___Count_');
            expect(RubyGenerator.listName('id2_2')).toEqual('$List_of_Symbols_');
            expect(RubyGenerator.variableName('id2_3')).toEqual('$_________________________________');
        });

        test('do not escape multibyte character like Japanese', async () => {
            expect(RubyGenerator.variableName('id2_4')).toEqual('@平均_合計___件数_');
            expect(RubyGenerator.listName('id2_5')).toEqual('@シンボル　配列。');

            renderedTarget.isStage = true;
            expect(RubyGenerator.variableName('id2_4')).toEqual('$平均_合計___件数_');
            expect(RubyGenerator.listName('id2_5')).toEqual('$シンボル　配列。');
        });
    });
});
