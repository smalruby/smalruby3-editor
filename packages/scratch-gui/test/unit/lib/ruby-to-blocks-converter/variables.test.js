import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';
import {
    convertAndExpectToEqualBlocks,
    convertAndExpectRubyBlockError,
    rubyToExpected,
    expectedInfo
} from '../../../helpers/expect-to-equal-blocks';

describe('RubyToBlocksConverter/Variables', () => {
    let converter;
    let target;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null);
        target = null;
    });

    describe('@a', () => {
        const varName = '@a';

        test('data_variable', async () => {
            const code = varName;
            const expected = [
                {
                    opcode: 'data_variable',
                    fields: [
                        {
                            name: 'VARIABLE',
                            variable: varName
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('operator_length', async () => {
            const code = `${varName}.length`;
            const expected = [
                {
                    opcode: 'operator_length',
                    inputs: [
                        {
                            name: 'STRING',
                            block: (await rubyToExpected(converter, target, varName))[0]
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('operator_letter_of', async () => {
            const code = `${varName}[0]`;
            const expected = [
                {
                    opcode: 'operator_letter_of',
                    inputs: [
                        {
                            name: 'STRING',
                            block: (await rubyToExpected(converter, target, varName))[0]
                        },
                        {
                            name: 'LETTER',
                            block: expectedInfo.makeNumber(1)
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('data_setvariableto', async () => {
            const code = `${varName} = "world"`;
            const expected = [
                {
                    opcode: 'data_setvariableto',
                    fields: [
                        {
                            name: 'VARIABLE',
                            variable: varName
                        }
                    ],
                    inputs: [
                        {
                            name: 'VALUE',
                            block: expectedInfo.makeText('world')
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('data_changevariableby', async () => {
            const code = `${varName} += 1`;
            const expected = [
                {
                    opcode: 'data_changevariableby',
                    fields: [
                        {
                            name: 'VARIABLE',
                            variable: varName
                        }
                    ],
                    inputs: [
                        {
                            name: 'VALUE',
                            block: expectedInfo.makeNumber(1)
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('data_showvariable', async () => {
            const code = `show_variable("${varName.slice(1)}")`;
            const expected = [
                {
                    opcode: 'data_showvariable',
                    fields: [
                        {
                            name: 'VARIABLE',
                            variable: varName
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('data_hidevariable', async () => {
            const code = `hide_variable("${varName.slice(1)}")`;
            const expected = [
                {
                    opcode: 'data_hidevariable',
                    fields: [
                        {
                            name: 'VARIABLE',
                            variable: varName
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('data_listcontents', async () => {
            const code = `list("${varName.slice(1)}")`;
            const expected = [
                {
                    opcode: 'data_listcontents',
                    fields: [
                        {
                            name: 'LIST',
                            list: varName
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('data_addtolist', async () => {
            const code = `list("${varName.slice(1)}").push("thing")`;
            const expected = [
                {
                    opcode: 'data_addtolist',
                    fields: [
                        {
                            name: 'LIST',
                            list: varName
                        }
                    ],
                    inputs: [
                        {
                            name: 'ITEM',
                            block: expectedInfo.makeText('thing')
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('data_deleteoflist', async () => {
            const code = `list("${varName.slice(1)}").delete_at(1)`;
            const expected = [
                {
                    opcode: 'data_deleteoflist',
                    fields: [
                        {
                            name: 'LIST',
                            list: varName
                        }
                    ],
                    inputs: [
                        {
                            name: 'INDEX',
                            block: expectedInfo.makeNumber(1, 'math_integer')
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('data_deletealloflist', async () => {
            const code = `list("${varName.slice(1)}").clear`;
            const expected = [
                {
                    opcode: 'data_deletealloflist',
                    fields: [
                        {
                            name: 'LIST',
                            list: varName
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('data_insertatlist', async () => {
            const code = `list("${varName.slice(1)}").insert(1, "thing")`;
            const expected = [
                {
                    opcode: 'data_insertatlist',
                    fields: [
                        {
                            name: 'LIST',
                            list: varName
                        }
                    ],
                    inputs: [
                        {
                            name: 'INDEX',
                            block: expectedInfo.makeNumber(1, 'math_integer')
                        },
                        {
                            name: 'ITEM',
                            block: expectedInfo.makeText('thing')
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('data_replaceitemoflist', async () => {
            const code = `list("${varName.slice(1)}")[1] = "thing"`;
            const expected = [
                {
                    opcode: 'data_replaceitemoflist',
                    fields: [
                        {
                            name: 'LIST',
                            list: varName
                        }
                    ],
                    inputs: [
                        {
                            name: 'INDEX',
                            block: expectedInfo.makeNumber(1, 'math_integer')
                        },
                        {
                            name: 'ITEM',
                            block: expectedInfo.makeText('thing')
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('data_itemoflist', async () => {
            const code = `list("${varName.slice(1)}")[1]`;
            const expected = [
                {
                    opcode: 'data_itemoflist',
                    fields: [
                        {
                            name: 'LIST',
                            list: varName
                        }
                    ],
                    inputs: [
                        {
                            name: 'INDEX',
                            block: expectedInfo.makeNumber(1, 'math_integer')
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('data_itemnumoflist', async () => {
            const code = `list("${varName.slice(1)}").index("thing")`;
            const expected = [
                {
                    opcode: 'data_itemnumoflist',
                    fields: [
                        {
                            name: 'LIST',
                            list: varName
                        }
                    ],
                    inputs: [
                        {
                            name: 'ITEM',
                            block: expectedInfo.makeText('thing')
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('data_lengthoflist', async () => {
            const code = `list("${varName.slice(1)}").length`;
            const expected = [
                {
                    opcode: 'data_lengthoflist',
                    fields: [
                        {
                            name: 'LIST',
                            list: varName
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('data_listcontainsitem', async () => {
            const code = `list("${varName.slice(1)}").include?("thing")`;
            const expected = [
                {
                    opcode: 'data_listcontainsitem',
                    fields: [
                        {
                            name: 'LIST',
                            list: varName
                        }
                    ],
                    inputs: [
                        {
                            name: 'ITEM',
                            block: expectedInfo.makeText('thing')
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('data_showlist', async () => {
            const code = `show_list("${varName.slice(1)}")`;
            const expected = [
                {
                    opcode: 'data_showlist',
                    fields: [
                        {
                            name: 'LIST',
                            list: varName
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('data_hidelist', async () => {
            const code = `hide_list("${varName.slice(1)}")`;
            const expected = [
                {
                    opcode: 'data_hidelist',
                    fields: [
                        {
                            name: 'LIST',
                            list: varName
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });
    });

    describe('$a', () => {
        const varName = '$a';

        test('data_variable', async () => {
            const code = varName;
            const expected = [
                {
                    opcode: 'data_variable',
                    fields: [
                        {
                            name: 'VARIABLE',
                            variable: varName
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('operator_length', async () => {
            const code = `${varName}.length`;
            const expected = [
                {
                    opcode: 'operator_length',
                    inputs: [
                        {
                            name: 'STRING',
                            block: (await rubyToExpected(converter, target, varName))[0]
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('operator_letter_of', async () => {
            const code = `${varName}[0]`;
            const expected = [
                {
                    opcode: 'operator_letter_of',
                    inputs: [
                        {
                            name: 'STRING',
                            block: (await rubyToExpected(converter, target, varName))[0]
                        },
                        {
                            name: 'LETTER',
                            block: expectedInfo.makeNumber(1)
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('data_setvariableto', async () => {
            const code = `${varName} = "world"`;
            const expected = [
                {
                    opcode: 'data_setvariableto',
                    fields: [
                        {
                            name: 'VARIABLE',
                            variable: varName
                        }
                    ],
                    inputs: [
                        {
                            name: 'VALUE',
                            block: expectedInfo.makeText('world')
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('data_changevariableby', async () => {
            const code = `${varName} += 1`;
            const expected = [
                {
                    opcode: 'data_changevariableby',
                    fields: [
                        {
                            name: 'VARIABLE',
                            variable: varName
                        }
                    ],
                    inputs: [
                        {
                            name: 'VALUE',
                            block: expectedInfo.makeNumber(1)
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('data_showvariable', async () => {
            const code = `show_variable("${varName.slice(1)}")`;
            const expected = [
                {
                    opcode: 'data_showvariable',
                    fields: [
                        {
                            name: 'VARIABLE',
                            variable: varName
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('data_hidevariable', async () => {
            const code = `hide_variable("${varName.slice(1)}")`;
            const expected = [
                {
                    opcode: 'data_hidevariable',
                    fields: [
                        {
                            name: 'VARIABLE',
                            variable: varName
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('data_listcontents', async () => {
            const code = `list("${varName.slice(1)}")`;
            const expected = [
                {
                    opcode: 'data_listcontents',
                    fields: [
                        {
                            name: 'LIST',
                            list: varName
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('data_addtolist', async () => {
            const code = `list("${varName.slice(1)}").push("thing")`;
            const expected = [
                {
                    opcode: 'data_addtolist',
                    fields: [
                        {
                            name: 'LIST',
                            list: varName
                        }
                    ],
                    inputs: [
                        {
                            name: 'ITEM',
                            block: expectedInfo.makeText('thing')
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('data_deleteoflist', async () => {
            const code = `list("${varName.slice(1)}").delete_at(1)`;
            const expected = [
                {
                    opcode: 'data_deleteoflist',
                    fields: [
                        {
                            name: 'LIST',
                            list: varName
                        }
                    ],
                    inputs: [
                        {
                            name: 'INDEX',
                            block: expectedInfo.makeNumber(1, 'math_integer')
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('data_deletealloflist', async () => {
            const code = `list("${varName.slice(1)}").clear`;
            const expected = [
                {
                    opcode: 'data_deletealloflist',
                    fields: [
                        {
                            name: 'LIST',
                            list: varName
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('data_insertatlist', async () => {
            const code = `list("${varName.slice(1)}").insert(1, "thing")`;
            const expected = [
                {
                    opcode: 'data_insertatlist',
                    fields: [
                        {
                            name: 'LIST',
                            list: varName
                        }
                    ],
                    inputs: [
                        {
                            name: 'INDEX',
                            block: expectedInfo.makeNumber(1, 'math_integer')
                        },
                        {
                            name: 'ITEM',
                            block: expectedInfo.makeText('thing')
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('data_replaceitemoflist', async () => {
            const code = `list("${varName.slice(1)}")[1] = "thing"`;
            const expected = [
                {
                    opcode: 'data_replaceitemoflist',
                    fields: [
                        {
                            name: 'LIST',
                            list: varName
                        }
                    ],
                    inputs: [
                        {
                            name: 'INDEX',
                            block: expectedInfo.makeNumber(1, 'math_integer')
                        },
                        {
                            name: 'ITEM',
                            block: expectedInfo.makeText('thing')
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('data_itemoflist', async () => {
            const code = `list("${varName.slice(1)}")[1]`;
            const expected = [
                {
                    opcode: 'data_itemoflist',
                    fields: [
                        {
                            name: 'LIST',
                            list: varName
                        }
                    ],
                    inputs: [
                        {
                            name: 'INDEX',
                            block: expectedInfo.makeNumber(1, 'math_integer')
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('data_itemnumoflist', async () => {
            const code = `list("${varName.slice(1)}").index("thing")`;
            const expected = [
                {
                    opcode: 'data_itemnumoflist',
                    fields: [
                        {
                            name: 'LIST',
                            list: varName
                        }
                    ],
                    inputs: [
                        {
                            name: 'ITEM',
                            block: expectedInfo.makeText('thing')
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('data_lengthoflist', async () => {
            const code = `list("${varName.slice(1)}").length`;
            const expected = [
                {
                    opcode: 'data_lengthoflist',
                    fields: [
                        {
                            name: 'LIST',
                            list: varName
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('data_listcontainsitem', async () => {
            const code = `list("${varName.slice(1)}").include?("thing")`;
            const expected = [
                {
                    opcode: 'data_listcontainsitem',
                    fields: [
                        {
                            name: 'LIST',
                            list: varName
                        }
                    ],
                    inputs: [
                        {
                            name: 'ITEM',
                            block: expectedInfo.makeText('thing')
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('data_showlist', async () => {
            const code = `show_list("${varName.slice(1)}")`;
            const expected = [
                {
                    opcode: 'data_showlist',
                    fields: [
                        {
                            name: 'LIST',
                            list: varName
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('data_hidelist', async () => {
            const code = `hide_list("${varName.slice(1)}")`;
            const expected = [
                {
                    opcode: 'data_hidelist',
                    fields: [
                        {
                            name: 'LIST',
                            list: varName
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });
    });

    describe('Variable Scope Validation', () => {
        let mockTarget;
        let stageTarget;

        beforeEach(() => {
            stageTarget = {
                id: 'stage',
                isStage: true,
                variables: {
                    'global_var_id': {
                        id: 'global_var_id',
                        name: 'global_variable',
                        type: ''
                    }
                }
            };
            mockTarget = {
                id: 'sprite1',
                isStage: false,
                variables: {
                    'instance_var_id': {
                        id: 'instance_var_id',
                        name: 'instance_variable',
                        type: ''
                    }
                }
            };
            const vm = {
                runtime: {
                    getTargetForStage: () => stageTarget,
                    getEditingTarget: () => mockTarget
                }
            };
            converter = new RubyToBlocksConverter(vm);
        });

        test('should error when changing global variable to instance variable', async () => {
            const code = '@global_variable = 0';
            const res = await converter.targetCodeToBlocks(mockTarget, code);
            expect(converter.errors).toHaveLength(1);
            expect(converter.errors[0].text).toBe('"@global_variable", can\'t change variable scope');
            expect(res).toBeFalsy();
        });

        test('should error when changing instance variable to global variable', async () => {
            const code = '$instance_variable = 0';
            const res = await converter.targetCodeToBlocks(mockTarget, code);
            expect(converter.errors).toHaveLength(1);
            expect(converter.errors[0].text).toBe('"$instance_variable", can\'t change variable scope');
            expect(res).toBeFalsy();
        });

        test('should allow same scope variable reuse', async () => {
            const code = '$global_variable = 0';
            const res = await converter.targetCodeToBlocks(mockTarget, code);
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();
        });

        test('should allow same instance scope variable reuse', async () => {
            const code = '@instance_variable = 0';
            const res = await converter.targetCodeToBlocks(mockTarget, code);
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();
        });

        test('should error when reading variable with wrong scope', async () => {
            const code = '@global_variable';
            const res = await converter.targetCodeToBlocks(mockTarget, code);
            expect(converter.errors).toHaveLength(1);
            expect(converter.errors[0].text).toBe('"@global_variable", can\'t change variable scope');
            expect(res).toBeFalsy();
        });

        test('should allow creating new variables with different names', async () => {
            const code = '@new_variable = 0';
            const res = await converter.targetCodeToBlocks(mockTarget, code);
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();
        });
    });

    describe('Pseudo-Local Variable Naming', () => {
        test('local variable should have leading and trailing underscores and scope index', async () => {
            const code = 'x = 10';
            const res = await converter.targetCodeToBlocks(target, code);
            expect(res).toBeTruthy();
            const setVarBlock = Object.values(converter.blocks).find(b => b.opcode === 'data_setvariableto');
            expect(setVarBlock).toBeDefined();
            expect(setVarBlock.fields.VARIABLE.value).toBe('_x_1_');
        });

        test('local variable in method should have scope index 2', async () => {
            const code = 'def test; y = 20; end';
            const res = await converter.targetCodeToBlocks(target, code);
            expect(res).toBeTruthy();
            const setVarBlock = Object.values(converter.blocks).find(b => b.opcode === 'data_setvariableto');
            expect(setVarBlock).toBeDefined();
            expect(setVarBlock.fields.VARIABLE.value).toBe('_y_2_');
        });
    });
});
