// === Smalruby: This file is Smalruby-specific (Ruby to blocks converter HOC tests) ===
import React from 'react';
import configureStore from 'redux-mock-store';
import RubyToBlocksConverterHOC from '../../../src/lib/ruby-to-blocks-converter-hoc.jsx';
import { renderWithIntl } from '../../helpers/intl-helpers.jsx';

jest.mock('../../../src/lib/ruby-to-blocks-converter', () => ({
    NullRubyToBlocksConverter: { result: true, errors: [], apply: () => Promise.resolve() },
    targetCodeToBlocks: jest.fn(),
}));

const { targetCodeToBlocks } = require('../../../src/lib/ruby-to-blocks-converter');

// Issue #2560: Japanese lines that make no Ruby stay only in the editor. Saving, submitting
// and the green flag go through the HOC, which used to see only `rubyCode.modified` and saved
// the program without those lines. While they are there, the HOC stops like a Ruby error.
describe('RubyToBlocksConverterHOC', () => {
    const mockStore = configureStore();
    const target = { id: 'sprite1', isStage: false };
    let vm;

    const renderHOC = (dnclState, rubyCode = { modified: false, target, code: '' }) => {
        vm = { setEditingTarget: jest.fn() };
        const store = mockStore({
            scratchGui: {
                dnclMode: dnclState,
                targets: { editingTarget: 'sprite1' },
                rubyCode,
                settings: { rubyVersion: '2' },
                vm,
            },
        });
        let captured;
        const Component = (props) => {
            captured = props.targetCodeToBlocks;
            return <div />;
        };
        const Wrapped = RubyToBlocksConverterHOC(Component);
        renderWithIntl(<Wrapped store={store} />);
        return { store, targetCodeToBlocksProp: captured };
    };

    beforeEach(() => {
        targetCodeToBlocks.mockReset();
    });

    test('stops on the Japanese tab when the Japanese program has lines with an error', async () => {
        const { store, targetCodeToBlocksProp } = renderHOC({ dnclMode: true, japaneseEditError: true });
        const converter = await targetCodeToBlocksProp(null);
        expect(converter.result).toBe(false);
        expect(targetCodeToBlocks).not.toHaveBeenCalled();
        expect(vm.setEditingTarget).toHaveBeenCalledWith('sprite1');
        const types = store.getActions().map((a) => a.type);
        expect(store.getActions()).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ type: 'scratch-gui/navigation/ACTIVATE_TAB', activeTabIndex: 4 }),
            ]),
        );
        expect(store.getActions()).toEqual(
            expect.arrayContaining([expect.objectContaining({ alertId: 'convertJapaneseError' })]),
        );
        expect(types).not.toContain('scratch-gui/ruby-code/CONVERTED_RUBY_CODE');
    });

    test('stops even when the Ruby code is modified', async () => {
        const { targetCodeToBlocksProp } = renderHOC(
            { dnclMode: true, japaneseEditError: true },
            { modified: true, target, code: 'move(10)' },
        );
        const converter = await targetCodeToBlocksProp(null);
        expect(converter.result).toBe(false);
        expect(targetCodeToBlocks).not.toHaveBeenCalled();
    });

    test('passes when the Japanese program has no error', async () => {
        const { targetCodeToBlocksProp } = renderHOC({ dnclMode: true, japaneseEditError: false });
        const converter = await targetCodeToBlocksProp(null);
        expect(converter.result).toBe(true);
        expect(vm.setEditingTarget).not.toHaveBeenCalled();
    });
});
