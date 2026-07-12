// === Smalruby: This file is Smalruby-specific (URL loader modal loading UX, #972) ===
/* eslint-env jest */
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
// eslint-disable-next-line import/first
import URLLoaderModal from '../../../src/components/url-loader-modal/url-loader-modal.jsx';

// Avoid react-modal portal/store complexity: render the modal body inline.
jest.mock('../../../src/containers/modal.jsx', () => {
    const FakeModal = ({ children }) => <div data-testid="url-loader-modal">{children}</div>;
    return FakeModal;
});

const renderModal = (props) =>
    render(
        <IntlProvider locale="en">
            <URLLoaderModal onRequestClose={jest.fn()} onLoadUrl={jest.fn()} {...props} />
        </IntlProvider>,
    );

// #972: while a project is loading (which empties the stage for ~20s on big
// projects), the modal must show a loading indicator and disable its controls so
// the user cannot fire vm.loadProject() repeatedly and does not mistake the empty
// stage for "returned to the initial screen". The synchronous re-entry guard that
// stops rapid submits lives in url-loader-hoc (see url-loader-hoc.test.jsx).
describe('URLLoaderModal loading UX (#972)', () => {
    test('not loading: no indicator, Open enabled once a URL is entered, load fires', () => {
        const onLoadUrl = jest.fn();
        const { getByPlaceholderText, getByText, queryByTestId } = renderModal({ onLoadUrl });

        expect(queryByTestId('url-loader-loading')).not.toBeInTheDocument();

        const input = getByPlaceholderText('Enter project URL...');
        fireEvent.change(input, { target: { value: 'https://scratch.mit.edu/projects/123/' } });
        expect(input).not.toBeDisabled();
        const openButton = getByText('Open').closest('button');
        expect(openButton).not.toBeDisabled();

        fireEvent.click(openButton);
        expect(onLoadUrl).toHaveBeenCalledTimes(1);
    });

    test('loading: shows the indicator and disables the input and the Open button', () => {
        const { getByPlaceholderText, getByText, getByTestId } = renderModal({ loading: true });

        expect(getByTestId('url-loader-loading')).toBeInTheDocument();
        // Disabled regardless of URL content — the load is already in flight.
        expect(getByPlaceholderText('Enter project URL...')).toBeDisabled();
        expect(getByText('Open').closest('button')).toBeDisabled();
    });
});
