/* eslint-env jest */
import { render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import TipsLibrary from '../../../src/containers/tips-library.jsx';
import decks from '../../../src/lib/libraries/decks/index.jsx';

// LibraryComponent に渡る一覧（data）だけを見たいので、描画は差し替える。
const mockLibrary = jest.fn(() => null);
jest.mock('../../../src/components/library/library.jsx', () => (props) => mockLibrary(props));

// スタータープロジェクト付きのチュートリアル。選ぶと /projects/<id>/editor を新しいタブで開くが、
// smalruby.app にはそのパスが無い（S3 の AccessDenied になる）。
const PROJECT_TUTORIALS = ['code-cartoon', 'cartoon-network'];

const renderLibrary = (props = {}) => {
    const store = configureStore()({
        scratchGui: {
            modals: { tipsLibrary: true },
            projectState: { projectId: '0' },
            platform: { platform: 'WEB' },
        },
    });
    render(
        <Provider store={store}>
            <IntlProvider locale="en">
                <TipsLibrary {...props} />
            </IntlProvider>
        </Provider>,
    );
    const { data } = mockLibrary.mock.calls[mockLibrary.mock.calls.length - 1][0];
    return data.map((item) => item.id);
};

describe('TipsLibrary project tutorials', () => {
    beforeEach(() => mockLibrary.mockClear());

    test('the two starter-project tutorials still declare requiredProjectId', () => {
        PROJECT_TUTORIALS.forEach((id) => {
            expect(decks[id].requiredProjectId).toBeTruthy();
        });
    });

    test('lists the starter-project tutorials when hideTutorialProjects is not set', () => {
        const ids = renderLibrary();
        PROJECT_TUTORIALS.forEach((id) => expect(ids).toContain(id));
    });

    test('hides every starter-project tutorial when hideTutorialProjects is set', () => {
        const ids = renderLibrary({ hideTutorialProjects: true });
        PROJECT_TUTORIALS.forEach((id) => expect(ids).not.toContain(id));
        ids.forEach((id) => expect(decks[id].requiredProjectId).toBeUndefined());
        expect(ids.length).toBeGreaterThan(0);
    });
});
