// === Smalruby: This file is Smalruby-specific (URL loader failure recovery, #972) ===
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

// url-loader-hoc's mergeProps puts ownProps last, so props passed in the test
// override the connected state/dispatch — letting us drive the HOC directly and
// observe which recovery action it dispatches.
describe('URLLoaderHOC failure handling (#972)', () => {
    const mockStore = configureStore();
    let store;

    beforeEach(() => {
        fetchProjectInfo.mockReset();
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

        const errorCallback = jest.fn();
        // eslint-disable-next-line react/prop-types
        const Child = ({ onUrlLoaderSubmit }) => {
            React.useEffect(() => {
                onUrlLoaderSubmit('https://scratch.mit.edu/projects/123456789/', errorCallback);
            }, []); // eslint-disable-line react-hooks/exhaustive-deps
            return <div />;
        };
        const WrappedComponent = URLLoaderHOC(Child);

        const restorePreviousProjectState = jest.fn();
        const onLoadedProject = jest.fn();
        const commonProps = {
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
            onSetRubyVersion: jest.fn(),
            setProjectId: jest.fn(),
            requestProjectUpload: jest.fn(),
            closeUrlLoaderModal: jest.fn(),
            closeFileMenu: jest.fn(),
            openUrlLoaderModal: jest.fn(),
            cancelFileUpload: jest.fn(),
            restorePreviousProjectState,
            onLoadedProject,
        };

        const { rerender } = renderWithIntl(<WrappedComponent {...commonProps} isLoadingUpload={false} />);

        // Flip isLoadingUpload so componentDidUpdate kicks off the load, mimicking
        // the upload-machinery finishing.
        rerender(
            <IntlProvider locale="en" messages={{}}>
                <WrappedComponent {...commonProps} isLoadingUpload />
            </IntlProvider>,
        );

        // Flush the async fetch/catch chain.
        await new Promise((resolve) => setTimeout(resolve, 0));

        // Recovery must restore the previous project (null → default) ...
        expect(restorePreviousProjectState).toHaveBeenCalledWith(null);
        // ... and must NOT go through the load-project state machine, whose
        // FETCHING_WITH_ID failure branch resolves to the fatal ERROR state.
        expect(onLoadedProject).not.toHaveBeenCalled();
        // The user still gets a message in the (still-open) modal.
        expect(errorCallback).toHaveBeenCalled();
    });
});
