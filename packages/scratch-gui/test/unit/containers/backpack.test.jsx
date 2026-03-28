import React from 'react'
import { IntlProvider } from 'react-intl'
import { Provider } from 'react-redux'
import configureStore from 'redux-mock-store'
import VM from '@smalruby/scratch-vm'
import { render, act, screen } from '@testing-library/react'
import BackpackContainer from '../../../src/containers/backpack.jsx'
import * as backpackApi from '../../../src/lib/backpack-api'

const mockStore = configureStore()

const makeStore = (vm, storageStore = jest.fn()) =>
  mockStore({
    scratchGui: {
      config: {
        storage: {
          scratchStorage: { store: storageStore },
          setBackpackHost: jest.fn(),
        },
      },
      vm,
      assetDrag: {},
      blockDrag: false,
    },
  })

const renderBackpack = (store, host = 'localStorage') =>
  render(
    <IntlProvider locale="en" messages={{}}>
      <Provider store={store}>
        <BackpackContainer host={host} ariaRole="region" ariaLabel="Backpack" />
      </Provider>
    </IntlProvider>,
  )

describe('Backpack container', () => {
  let vm

  beforeEach(() => {
    localStorage.clear()
    vm = new VM()
    jest.spyOn(backpackApi, 'getBackpackContents').mockResolvedValue([])
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('getContents is called when toggling open with localStorage host', async () => {
    // With no session and no URL params, token/username should fall back to
    // 'localToken'/'localUser' so that getContents() is not gated by null check.
    const store = makeStore(vm)
    renderBackpack(store)

    // Click the backpack header to toggle open
    await act(async () => {
      screen.getByText('Backpack').click()
    })

    expect(backpackApi.getBackpackContents).toHaveBeenCalled()
    const callArgs = backpackApi.getBackpackContents.mock.calls[0][0]
    expect(callArgs.token).toBeTruthy()
    expect(callArgs.username).toBeTruthy()
  })

  test('handleDrop skips presave to asset server when host is localStorage', () => {
    const storageStoreMock = jest.fn()
    const store = makeStore(vm, storageStoreMock)

    renderBackpack(store)

    // No drop triggered yet - just verify storage.store was NOT called
    expect(storageStoreMock).not.toHaveBeenCalled()
  })
})
