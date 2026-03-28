// === Smalruby: This file is Smalruby-specific (Google Drive saver HOC tests) ===
import React from 'react'
import configureStore from 'redux-mock-store'
import 'web-audio-test-api'
import VM from '@smalruby/scratch-vm'
import GoogleDriveSaverHOC from '../../../src/containers/google-drive-saver-hoc.jsx'
import { renderWithIntl } from '../../helpers/intl-helpers.jsx'

// Mock google-drive-api module
jest.mock('../../../src/lib/google-drive-api', () => ({
  __esModule: true,
  default: {
    constructor: { isConfigured: () => true },
    uploadFile: jest.fn(),
    updateFile: jest.fn(),
    requestAccessToken: jest.fn(),
  },
}))

// Mock ruby-to-blocks-converter-hoc to pass through
jest.mock('../../../src/lib/ruby-to-blocks-converter-hoc.jsx', () => Component => Component)

const googleDriveAPI = require('../../../src/lib/google-drive-api').default

describe('GoogleDriveSaverHOC', () => {
  const mockStore = configureStore()
  let store
  let vm

  beforeEach(() => {
    vm = new VM()
    store = mockStore({
      scratchGui: {
        projectState: {
          loadingState: 'SHOWING_WITHOUT_ID',
        },
        projectChanged: false,
        projectTitle: 'test-project',
        vm: vm,
        googleDriveFile: {
          fileId: null,
          fileName: null,
          folderId: null,
          isGoogleDriveFile: false,
        },
      },
      locales: {
        locale: 'en',
      },
    })
  })

  test('should update project title when saving copy to Google Drive', async () => {
    googleDriveAPI.uploadFile.mockResolvedValue({ id: 'new-file-id' })

    let capturedOnSaveToGoogleDrive
    const Component = props => {
      capturedOnSaveToGoogleDrive = props.onSaveToGoogleDrive
      return <div />
    }
    const WrappedComponent = GoogleDriveSaverHOC(Component)

    renderWithIntl(
      <WrappedComponent
        store={store}
        saveProjectSb3={jest.fn().mockResolvedValue(new ArrayBuffer(8))}
        targetCodeToBlocks={jest.fn().mockResolvedValue({
          result: true,
          apply: jest.fn().mockResolvedValue(),
        })}
      />,
    )

    // Call save with a new filename
    await capturedOnSaveToGoogleDrive('new-project-name.sb3', null)

    // Check that SET_PROJECT_TITLE action was dispatched with filename without .sb3
    const actions = store.getActions()
    const setTitleAction = actions.find(a => a.type === 'projectTitle/SET_PROJECT_TITLE')
    expect(setTitleAction).toBeDefined()
    expect(setTitleAction.title).toBe('new-project-name')
  })

  test('should re-authenticate and retry when user clicks save during auth_error', async () => {
    // Setup store with a Google Drive file
    store = mockStore({
      scratchGui: {
        projectState: {
          loadingState: 'SHOWING_WITHOUT_ID',
        },
        projectChanged: true,
        projectTitle: 'test-project',
        vm: vm,
        googleDriveFile: {
          fileId: 'existing-file-id',
          fileName: 'test.sb3',
          folderId: null,
          isGoogleDriveFile: true,
        },
      },
      locales: {
        locale: 'en',
      },
    })

    // First call to updateFile throws 401, second succeeds
    const authError = new Error('Unauthorized')
    authError.status = 401
    googleDriveAPI.updateFile.mockRejectedValueOnce(authError).mockResolvedValueOnce({})
    googleDriveAPI.requestAccessToken.mockResolvedValue()

    let capturedProps
    const Component = props => {
      capturedProps = props
      return <div />
    }
    const WrappedComponent = GoogleDriveSaverHOC(Component)

    renderWithIntl(
      <WrappedComponent
        store={store}
        saveProjectSb3={jest.fn().mockResolvedValue(new ArrayBuffer(8))}
        targetCodeToBlocks={jest.fn().mockResolvedValue({
          result: true,
          apply: jest.fn().mockResolvedValue(),
        })}
      />,
    )

    // User clicks save directly (isUserInitiated=true)
    await capturedProps.onSaveDirectlyToGoogleDrive(true)

    // Should have called requestAccessToken for re-auth
    expect(googleDriveAPI.requestAccessToken).toHaveBeenCalled()
    // Should have retried updateFile after re-auth
    expect(googleDriveAPI.updateFile).toHaveBeenCalledTimes(2)
  })
})
