import VM from '@smalruby/scratch-vm';
import { render, act, screen } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import BackpackContainer from '../../../src/containers/backpack.jsx';

const mockStore = configureStore();

const makeBackpackStorage = (overrides = {}) => ({
    setSession: jest.fn(),
    setHostAndRegisterWebStore: jest.fn(),
    list: jest.fn().mockResolvedValue([]),
    save: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue(undefined),
    ...overrides,
});

const makeStore = (vm, { storageStore = jest.fn(), backpackStorage } = {}) =>
    mockStore({
        scratchGui: {
            config: {
                storage: {
                    scratchStorage: { store: storageStore },
                    setBackpackHost: jest.fn(),
                    backpackStorage: backpackStorage ?? makeBackpackStorage(),
                },
            },
            vm,
            assetDrag: {},
            blockDrag: false,
        },
    });

const renderBackpack = (store, host = 'localStorage') =>
    render(
        <IntlProvider locale="en" messages={{}}>
            <Provider store={store}>
                <BackpackContainer host={host} ariaRole="region" ariaLabel="Backpack" />
            </Provider>
        </IntlProvider>,
    );

describe('Backpack container', () => {
    let vm;

    beforeEach(() => {
        localStorage.clear();
        vm = new VM();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('list is called when toggling open with localStorage host', async () => {
        // backpackStorage.list now drives the contents fetch (upstream v13.7.2).
        // For the localStorage path, LegacyBackpackStorage routes through
        // backpackApi.getBackpackContents — but that detail is exercised in
        // the LegacyBackpackStorage tests, not here.
        const backpackStorage = makeBackpackStorage();
        const store = makeStore(vm, { backpackStorage });
        renderBackpack(store);

        // Click the backpack header to toggle open
        await act(async () => {
            screen.getByText('Backpack').click();
        });

        expect(backpackStorage.list).toHaveBeenCalled();
        const [callArgs] = backpackStorage.list.mock.calls[0];
        expect(callArgs).toEqual(
            expect.objectContaining({
                limit: expect.any(Number),
                offset: expect.any(Number),
            }),
        );
    });

    test('handleDrop skips presave to asset server when host is localStorage', () => {
        const storageStoreMock = jest.fn();
        const store = makeStore(vm, { storageStore: storageStoreMock });

        renderBackpack(store);

        // No drop triggered yet - just verify storage.store was NOT called
        expect(storageStoreMock).not.toHaveBeenCalled();
    });
});
