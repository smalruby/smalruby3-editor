import React from 'react'
import { IntlProvider } from 'react-intl'
import { Provider } from 'react-redux'
import configureStore from 'redux-mock-store'
import { render } from '@testing-library/react'
import ConnectedRubyTab from '../../../src/containers/ruby-tab.jsx'
import { legacyConfig } from '../../../src/legacy-config'

// Capture the onChange callback passed to Monaco Editor
let capturedOnChange = null
jest.mock('@monaco-editor/react', () => {
  const MockEditor = props => {
    capturedOnChange = props.onChange
    return <div data-testid="mock-editor" />
  }
  MockEditor.displayName = 'MockEditor'
  return { __esModule: true, default: MockEditor }
})
jest.mock('../../../src/lib/ruby-to-blocks-converter-hoc.jsx', () => C => C)
jest.mock('../../../src/containers/rubytee-modal-hoc.jsx', () => C => C)
jest.mock('../../../src/components/ruby-toolbar/ruby-toolbar.jsx', () => {
  const Mock = () => null
  return { __esModule: true, default: Mock }
})
jest.mock('../../../src/components/auto-correct-modal/auto-correct-modal.jsx', () => {
  const Mock = () => null
  return { __esModule: true, default: Mock }
})
jest.mock('../../../src/components/ruby-script-preview/ruby-script-preview.jsx', () => {
  const Mock = () => null
  return { __esModule: true, default: Mock }
})
jest.mock('../../../src/containers/ruby-tab/furigana-renderer', () => {
  const MockFuriganaRenderer = jest.fn().mockImplementation(() => ({
    renderFurigana: jest.fn(),
    clearFurigana: jest.fn(),
  }))
  return { __esModule: true, default: MockFuriganaRenderer }
})
jest.mock('../../../src/containers/ruby-tab/editor-setup', () => ({
  registerCustomPasteAction: jest.fn(),
  setupPasteDuplicateHider: jest.fn(() => ({
    pasteMutationObserver: null,
    bodyMutationObserver: null,
  })),
  registerLanguageAndProviders: jest.fn(() => ({ dispose: jest.fn() })),
}))
jest.mock('../../../src/containers/ruby-tab/quick-fix-provider', () => ({
  __esModule: true,
  default: class {
    dispose() {}
  },
}))
jest.mock('../../../src/containers/ruby-tab/debug-globals', () => jest.fn())
jest.mock('../../../src/containers/ruby-tab/execution-highlighter', () => ({
  clearDecoration: jest.fn(),
  highlightLine: jest.fn(),
  highlightLineRange: jest.fn(),
  findExecutableLine: jest.fn(),
}))
jest.mock('../../../src/containers/ruby-tab/visual-report-bubble', () => ({
  showBubble: jest.fn(),
  dismissBubble: jest.fn(),
  removeBubble: jest.fn(),
}))
jest.mock('../../../src/lib/prism-parser', () => ({
  getPrism: jest.fn(),
  loadPrism: jest.fn(() => Promise.resolve()),
}))
jest.mock('../../../src/lib/monaco-i18n-helper', () => ({
  loadMonacoLocale: jest.fn(() => Promise.resolve()),
}))
jest.mock('../../../src/lib/collect-metadata.js', () => jest.fn(() => ({})))
jest.mock('../../../src/lib/insert-class', () => ({
  wrapCurrentCodeWithClass: jest.fn(),
}))
jest.mock('../../../src/lib/auto-correct', () => ({
  autoCorrect: jest.fn(v => v),
  defaultSettings: {},
}))
jest.mock('../../../src/lib/ruby-script-preview', () => ({
  generatePreviewCode: jest.fn(() => ''),
}))
jest.mock('../../../src/containers/ruby-downloader.jsx', () => {
  const Mock = () => null
  return { __esModule: true, default: Mock }
})
jest.mock('../../../src/lib/ruby-generator', () => ({
  targetToCode: jest.fn(() => ''),
  targetsToCode: jest.fn(() => ''),
}))
jest.mock('../../../src/containers/ruby-tab/ruby-tab.css', () => ({}))

describe('Ruby tab projectChanged on edit', () => {
  const mockStore = configureStore()

  const createStore = () =>
    mockStore({
      scratchGui: {
        config: legacyConfig,
        projectChanged: false,
        editorTab: { activeTabIndex: 3 },
        targets: { editingTarget: 'target-1' },
        rubyCode: {
          target: { id: 'target-1', isStage: false },
          code: 'move(10)',
          modified: false,
          errors: [],
          markers: [],
          fontSize: 16,
        },
        settings: { rubyVersion: '2' },
        vm: {
          runtime: { targets: [] },
          on: jest.fn(),
          off: jest.fn(),
          addListener: jest.fn(),
          removeListener: jest.fn(),
        },
        projectTitle: 'Test Project',
        menus: {},
        alerts: { alertsList: [] },
        tutorialOnboarding: { rubyTabUsed: true },
        koshienFile: { aiSaveStatus: null },
      },
      locales: { locale: 'en' },
    })

  beforeEach(() => {
    capturedOnChange = null
  })

  test('editing Ruby code should dispatch setProjectChanged', () => {
    const store = createStore()
    render(
      <Provider store={store}>
        <IntlProvider locale="en">
          <ConnectedRubyTab
            targetCodeToBlocks={jest.fn()}
            vm={{
              runtime: { targets: [] },
              on: jest.fn(),
              off: jest.fn(),
              addListener: jest.fn(),
              removeListener: jest.fn(),
            }}
          />
        </IntlProvider>
      </Provider>,
    )

    // Monaco editor's onChange should have been captured
    expect(capturedOnChange).toBeTruthy()

    // Clear any actions dispatched during mount
    store.clearActions()

    // Simulate user editing code in Monaco editor
    capturedOnChange('move(20)')

    const actions = store.getActions()

    // updateRubyCode should be dispatched
    expect(actions).toContainEqual(
      expect.objectContaining({
        type: 'smalruby3-gui/ruby-code/UPDATE_RUBYCODE',
        code: 'move(20)',
      }),
    )

    // setProjectChanged should ALSO be dispatched
    expect(actions).toContainEqual(
      expect.objectContaining({
        type: 'scratch-gui/project-changed/SET_PROJECT_CHANGED',
        changed: true,
      }),
    )
  })
})
