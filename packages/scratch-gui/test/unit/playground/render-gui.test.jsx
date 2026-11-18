/* eslint-env jest */
import ReactDomClient from 'react-dom/client';
import renderGui from '../../../src/playground/render-gui.jsx';

// render-gui が <WrappedGui> に渡す props だけを確かめたいので、重い依存は差し替える。
jest.mock('react-dom/client', () => ({ createRoot: jest.fn() }));
jest.mock('../../../src/containers/gui.jsx', () => {
    const MockGui = () => null;
    MockGui.setAppElement = jest.fn();
    return MockGui;
});
jest.mock('../../../src/lib/responsive-gui.jsx', () => () => null);
jest.mock('../../../src/lib/app-state-hoc.jsx', () => (C) => C);
jest.mock('../../../src/lib/hash-parser-hoc.jsx', () => (C) => C);
jest.mock('../../../src/lib/storage-worker-timeout-hoc.jsx', () => (C) => C);

describe('render-gui playground', () => {
    test('passes hideTutorialProjects so starter-project tutorials are not listed', () => {
        const rootRender = jest.fn();
        ReactDomClient.createRoot.mockReturnValue({ render: rootRender });

        renderGui(document.createElement('div'));

        expect(rootRender).toHaveBeenCalledTimes(1);
        const element = rootRender.mock.calls[0][0];
        expect(element.props.hideTutorialProjects).toBe(true);
    });
});
