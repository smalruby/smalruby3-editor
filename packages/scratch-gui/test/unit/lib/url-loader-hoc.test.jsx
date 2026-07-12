// === Smalruby: This file is Smalruby-specific (URL loader failure recovery, #972) ===
import { act } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import configureStore from 'redux-mock-store';
import { fetchProjectInfo } from '../../../src/lib/url-loader';
import URLLoaderHOC from '../../../src/lib/url-loader-hoc.jsx';
import { LoadingState } from '../../../src/reducers/project-state';
import { renderWithIntl } from '../../helpers/intl-helpers.jsx';

// Force the fetch step to fail so we exercise the failure path without any
// network access (the real projects are unreachable from CI/containers, #972).
jest.mock('../../../src/lib/url-loader', () => {
    const actual = jest.requireActual('../../../src/lib/url-loader');
    return {
        __esModule: true,
        ...actual,
        fetchProjectInfo: jest.fn(),
    };
});

const SCRATCH_URL = 'https://scratch.mit.edu/projects/123456789/';

// The wrapped component records the props it last received so tests can observe
// what the HOC injects (e.g. urlLoaderLoading) and drive it via the injected
// onUrlLoaderSubmit handler.
let capturedProps;
const RecordingChild = (props) => {
    capturedProps = props;
    return <div />;
};
const WrappedComponent = URLLoaderHOC(RecordingChild);

// url-loader-hoc's mergeProps puts ownProps last, so props passed in the test
// override the connected state/dispatch — letting us drive the HOC directly and
// observe which recovery action it dispatches.
describe('URLLoaderHOC (#972)', () => {
    const mockStore = configureStore();
    let store;

    const makeProps = (overrides = {}) => ({
        store,
        vm: {},
        storage: {},
        reduxProjectId: null,
        loadingState: LoadingState.SHOWING_WITHOUT_ID,
        isShowingWithoutId: true,
        projectChanged: false,
        userOwnsProject: false,
        onLoadingStarted: jest.fn(),
        onLoadingFinished: jest.fn(),
        onSetProjectTitle: jest.fn(),
        setProjectId: jest.fn(),
        requestProjectUpload: jest.fn(),
        closeUrlLoaderModal: jest.fn(),
        closeFileMenu: jest.fn(),
        openUrlLoaderModal: jest.fn(),
        cancelFileUpload: jest.fn(),
        restorePreviousProjectState: jest.fn(),
        onLoadedProject: jest.fn(),
        ...overrides,
    });

    beforeEach(() => {
        fetchProjectInfo.mockReset();
        capturedProps = null;
        store = mockStore({
            scratchGui: {
                projectState: { loadingState: LoadingState.SHOWING_WITHOUT_ID, projectId: null },
                projectChanged: false,
                settings: { rubyVersion: '1' },
                config: { storage: {} },
                vm: {},
            },
            session: {},
        });
    });

    test('a failed URL load restores the previous project instead of erroring the editor', async () => {
        fetchProjectInfo.mockRejectedValue(new Error('boom'));

        const props = makeProps();
        const errorCallback = jest.fn();
        const { rerender } = renderWithIntl(<WrappedComponent {...props} isLoadingUpload={false} />);

        // Submit sets the pending project id; the load only kicks off once the
        // upload machinery flips isLoadingUpload (componentDidUpdate).
        act(() => {
            capturedProps.onUrlLoaderSubmit(SCRATCH_URL, errorCallback);
        });
        rerender(
            <IntlProvider locale="en" messages={{}}>
                <WrappedComponent {...props} isLoadingUpload />
            </IntlProvider>,
        );

        // Flush the async fetch/catch chain.
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
        });

        // Recovery must restore the previous project (null → default) ...
        expect(props.restorePreviousProjectState).toHaveBeenCalledWith(null);
        // ... and must NOT go through the load-project state machine, whose
        // FETCHING_WITH_ID failure branch resolves to the fatal ERROR state.
        expect(props.onLoadedProject).not.toHaveBeenCalled();
        // The user still gets a message in the (still-open) modal.
        expect(errorCallback).toHaveBeenCalled();
        // The loading UX must clear once the (failed) load settles (#972).
        expect(capturedProps.urlLoaderLoading).toBe(false);
    });

    test('exposes urlLoaderLoading=true to the modal while a load is in flight (#972)', () => {
        const props = makeProps();
        renderWithIntl(<WrappedComponent {...props} isLoadingUpload={false} />);

        expect(capturedProps.urlLoaderLoading).toBe(false);

        act(() => {
            capturedProps.onUrlLoaderSubmit(SCRATCH_URL, jest.fn());
        });

        // Marked in flight synchronously so the modal disables its controls and
        // shows the spinner before the fetch even begins.
        expect(capturedProps.urlLoaderLoading).toBe(true);
    });

    test('rapid repeat submits only kick off a single load (#972)', () => {
        const requestProjectUpload = jest.fn();
        const props = makeProps({ requestProjectUpload });
        renderWithIntl(<WrappedComponent {...props} isLoadingUpload={false} />);

        act(() => {
            // Two submits in the same tick, before any re-render — mimics a user
            // hammering "Open"/Enter. The synchronous re-entry guard must drop
            // the second one so vm.loadProject() cannot run twice.
            capturedProps.onUrlLoaderSubmit(SCRATCH_URL, jest.fn());
            capturedProps.onUrlLoaderSubmit(SCRATCH_URL, jest.fn());
        });

        expect(requestProjectUpload).toHaveBeenCalledTimes(1);
    });
});
