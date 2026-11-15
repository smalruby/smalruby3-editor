/* eslint-env jest */
// ステージの上のメッシュのボタンの「練習」のしるし (#1845)。
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { EventEmitter } from 'events';
import React from 'react';
import { IntlProvider } from 'react-intl';
import { MeshStatusButton } from '../../../src/components/mesh-status-button/mesh-status-button.jsx';
import en from '../../../src/locales/en';

const makeVm = (connectionState = 'disconnected') => {
    const vm = new EventEmitter();
    vm.extensionManager = { isExtensionLoaded: (id) => id === 'meshV2' };
    vm.runtime = { peripheralExtensions: { meshV2: { connectionState } } };
    return vm;
};

const renderButton = (props) =>
    render(
        <IntlProvider locale="en" messages={en}>
            <MeshStatusButton onToggle={jest.fn()} vm={makeVm()} {...props} />
        </IntlProvider>,
    );

describe('MeshStatusButton practice badge (#1845)', () => {
    test('no badge while the practice partner is off', () => {
        renderButton({ practiceActive: false });
        expect(screen.queryByTestId('mesh-status-button-practice')).toBeNull();
        expect(screen.getByTestId('mesh-status-button')).toHaveAccessibleName('Mesh status and history');
    });

    test('a text badge and an accessible name while the practice partner is on (not color only)', () => {
        renderButton({ practiceActive: true });
        expect(screen.getByTestId('mesh-status-button-practice')).toHaveTextContent('Practice');
        expect(screen.getByTestId('mesh-status-button')).toHaveAccessibleName(
            'Mesh status and history (practicing with the practice partner)',
        );
    });
});
