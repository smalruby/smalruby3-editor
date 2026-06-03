/* eslint-env jest */
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import MeshV2UpgradeModal from '../../../src/components/mesh-v2-upgrade-modal/mesh-v2-upgrade-modal.jsx';

const renderModal = (props) =>
    render(
        <IntlProvider locale="en">
            <MeshV2UpgradeModal
                onKeepLegacy={jest.fn()}
                onLearnMore={jest.fn()}
                onSwitchToNew={jest.fn()}
                {...props}
            />
        </IntlProvider>,
    );

describe('MeshV2UpgradeModal', () => {
    test('renders the dialog with the three actions', () => {
        const { getByTestId } = renderModal();
        expect(getByTestId('mesh-v2-upgrade-modal')).toBeInTheDocument();
        expect(getByTestId('mesh-v2-upgrade-switch')).toBeInTheDocument();
        expect(getByTestId('mesh-v2-upgrade-keep')).toBeInTheDocument();
        expect(getByTestId('mesh-v2-upgrade-learn-more')).toBeInTheDocument();
    });

    test('switch button invokes onSwitchToNew', () => {
        const onSwitchToNew = jest.fn();
        const { getByTestId } = renderModal({ onSwitchToNew });
        fireEvent.click(getByTestId('mesh-v2-upgrade-switch'));
        expect(onSwitchToNew).toHaveBeenCalledTimes(1);
    });

    test('keep button invokes onKeepLegacy', () => {
        const onKeepLegacy = jest.fn();
        const { getByTestId } = renderModal({ onKeepLegacy });
        fireEvent.click(getByTestId('mesh-v2-upgrade-keep'));
        expect(onKeepLegacy).toHaveBeenCalledTimes(1);
    });

    test('learn-more link invokes onLearnMore', () => {
        const onLearnMore = jest.fn();
        const { getByTestId } = renderModal({ onLearnMore });
        fireEvent.click(getByTestId('mesh-v2-upgrade-learn-more'));
        expect(onLearnMore).toHaveBeenCalledTimes(1);
    });
});
