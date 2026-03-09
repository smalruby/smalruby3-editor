import QuickFixProvider from '../../../../src/containers/ruby-tab/quick-fix-provider';

describe('QuickFixProvider', () => {
    let provider;
    let mockModel;

    beforeEach(() => {
        provider = new QuickFixProvider();
        mockModel = {
            uri: 'test-uri',
            getVersionId: () => 1,
            getLineContent: jest.fn()
        };
    });

    const createMarker = (message, lineContent, startLine = 1, startCol = 1) => {
        mockModel.getLineContent.mockReturnValue(lineContent);
        return {
            owner: 'smalruby',
            message,
            startLineNumber: startLine,
            startColumn: startCol,
            endLineNumber: startLine,
            endColumn: startCol + lineContent.length
        };
    };

    describe('variable scope errors', () => {
        test('should suggest changing @ to $ for instance-to-global scope change', () => {
            const marker = createMarker(
                '"@my_var", can\'t change variable scope. Delete the variable first, then recreate it with the correct scope.',
                '@my_var = 10'
            );
            const result = provider.provideCodeActions(
                mockModel, {}, {markers: [marker]}, null
            );
            expect(result.actions).toHaveLength(1);
            expect(result.actions[0].title).toBe('Change to $my_var');
            expect(result.actions[0].edit.edits[0].textEdit.text).toBe('$my_var');
        });

        test('should suggest changing $ to @ for global-to-instance scope change', () => {
            const marker = createMarker(
                '"$my_var", can\'t change variable scope. Delete the variable first, then recreate it with the correct scope.',
                '$my_var = 10'
            );
            const result = provider.provideCodeActions(
                mockModel, {}, {markers: [marker]}, null
            );
            expect(result.actions).toHaveLength(1);
            expect(result.actions[0].title).toBe('Change to @my_var');
        });
    });

    describe('costume does not exist errors', () => {
        test('should suggest existing costume names', () => {
            const mockVM = {
                editingTarget: {
                    getCostumes: () => [
                        {name: 'costume1'},
                        {name: 'costume2'}
                    ]
                }
            };
            provider.setVM(mockVM);

            const marker = createMarker(
                'costume "costume3" does not exist. Check the name or add the costume first.',
                'self.costume = "costume3"'
            );
            const result = provider.provideCodeActions(
                mockModel, {}, {markers: [marker]}, null
            );
            expect(result.actions).toHaveLength(2);
            expect(result.actions[0].title).toBe('Change to "costume1"');
            expect(result.actions[1].title).toBe('Change to "costume2"');
        });

        test('should return no actions if no costumes available', () => {
            provider.setVM(null);
            const marker = createMarker(
                'costume "missing" does not exist. Check the name or add the costume first.',
                'self.costume = "missing"'
            );
            const result = provider.provideCodeActions(
                mockModel, {}, {markers: [marker]}, null
            );
            expect(result.actions).toHaveLength(0);
        });
    });

    describe('backdrop does not exist errors', () => {
        test('should suggest existing backdrop names', () => {
            const mockVM = {
                runtime: {
                    getTargetForStage: () => ({
                        getCostumes: () => [
                            {name: 'backdrop1'},
                            {name: 'backdrop2'}
                        ]
                    })
                }
            };
            provider.setVM(mockVM);

            const marker = createMarker(
                'backdrop "backdrop3" does not exist. Check the name or add the backdrop first.',
                'self.backdrop = "backdrop3"'
            );
            const result = provider.provideCodeActions(
                mockModel, {}, {markers: [marker]}, null
            );
            expect(result.actions).toHaveLength(2);
            expect(result.actions[0].title).toBe('Change to "backdrop1"');
            expect(result.actions[1].title).toBe('Change to "backdrop2"');
        });
    });

    describe('sound does not exist errors', () => {
        test('should suggest existing sound names', () => {
            const mockVM = {
                editingTarget: {
                    getSounds: () => [
                        {name: 'Meow'},
                        {name: 'Pop'}
                    ]
                }
            };
            provider.setVM(mockVM);

            const marker = createMarker(
                'sound "Boing" does not exist. Check the name or add the sound first.',
                'play("Boing")'
            );
            const result = provider.provideCodeActions(
                mockModel, {}, {markers: [marker]}, null
            );
            expect(result.actions).toHaveLength(2);
            expect(result.actions[0].title).toBe('Change to "Meow"');
            expect(result.actions[1].title).toBe('Change to "Pop"');
        });
    });

    describe('non-smalruby markers', () => {
        test('should ignore markers from other owners', () => {
            const marker = {
                owner: 'other',
                message: '"@var", can\'t change variable scope.',
                startLineNumber: 1,
                startColumn: 1,
                endLineNumber: 1,
                endColumn: 10
            };
            const result = provider.provideCodeActions(
                mockModel, {}, {markers: [marker]}, null
            );
            expect(result.actions).toHaveLength(0);
        });
    });

    describe('unrecognized errors', () => {
        test('should return no actions for unknown error messages', () => {
            const marker = createMarker(
                'Stage selected: no motion blocks. Select a sprite to use motion blocks.',
                'self.x += 10'
            );
            const result = provider.provideCodeActions(
                mockModel, {}, {markers: [marker]}, null
            );
            expect(result.actions).toHaveLength(0);
        });
    });
});
