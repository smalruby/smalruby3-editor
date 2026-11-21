/* eslint-env jest */
import '@testing-library/jest-dom';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import EventEmitter from 'events';
import React from 'react';
import { IntlProvider } from 'react-intl';
import {
    getStuduinoSettings,
    STUDUINO_SETTINGS_CHANGED,
} from '@smalruby/scratch-vm/src/extensions/scratch3_smalrubot_s1/studuino-settings';
import { PortSettingsModal } from '../../../src/containers/studuino-port-settings-modal.jsx';
import ja from '../../../src/locales/ja';

jest.mock('../../../src/containers/modal.jsx', () => {
    const FakeModal = ({ children }) => <div data-testid="fake-modal">{children}</div>;
    return FakeModal;
});

const makeVm = (storage) => {
    const runtime = new EventEmitter();
    runtime.extensionStorage = storage ? { smalrubotS1: storage } : {};
    runtime.emitProjectChanged = jest.fn();
    return { runtime };
};

const renderModal = (vm, onClose = jest.fn()) => {
    render(
        <IntlProvider locale="ja" messages={ja}>
            <PortSettingsModal vm={vm} onClose={onClose} />
        </IntlProvider>,
    );
    return onClose;
};

const port = (name) => screen.getByTestId(`studuino-port-settings-port-${name}`);

afterEach(cleanup);

describe('StuduinoPortSettingsModal', () => {
    test('shows the robot car wiring by default', () => {
        renderModal(makeVm());
        expect(port('m1')).toHaveValue('dc_motor');
        expect(port('a6')).toHaveValue('light_sensor');
        expect(port('d2')).toHaveValue('');
        expect(screen.getByText('光センサー', { selector: '#studuino-port-a6 option' })).toBeInTheDocument();
        expect(screen.getByTestId('studuino-port-settings-calibration-m1')).toHaveValue(100);
        expect(screen.queryByTestId('studuino-port-settings-calibration-d2')).toBeNull();
    });

    test('assigns the chosen parts to the VM settings', () => {
        const vm = makeVm({ version: 1, mode: 'studuino', ports: { A6: 'light_sensor' } });
        const changed = jest.fn();
        vm.runtime.on(STUDUINO_SETTINGS_CHANGED, changed);
        const onClose = renderModal(vm);

        fireEvent.change(port('d9'), { target: { value: 'servo_motor' } });
        fireEvent.change(screen.getByTestId('studuino-port-settings-calibration-d9'), { target: { value: '-5' } });
        fireEvent.change(port('a0'), { target: { value: 'push_switch' } });
        fireEvent.click(screen.getByTestId('studuino-port-settings-assign'));

        const settings = getStuduinoSettings(vm.runtime);
        expect(settings.mode).toBe('studuino');
        expect(settings.ports).toEqual({ D9: 'servo_motor', A0: 'push_switch', A6: 'light_sensor' });
        expect(settings.calibration.servoMotor).toEqual({ D9: -5 });
        expect(changed).toHaveBeenCalledTimes(1);
        expect(onClose).toHaveBeenCalled();
    });

    test('unassigns all ports', () => {
        const vm = makeVm();
        renderModal(vm);
        fireEvent.click(screen.getByTestId('studuino-port-settings-clear-all'));
        expect(port('m1')).toHaveValue('');
        fireEvent.click(screen.getByTestId('studuino-port-settings-assign'));
        expect(getStuduinoSettings(vm.runtime).ports).toEqual({});
    });

    test('does not change the VM until assigned', () => {
        const vm = makeVm();
        renderModal(vm);
        fireEvent.change(port('a6'), { target: { value: '' } });
        expect(getStuduinoSettings(vm.runtime).ports.A6).toBe('light_sensor');
    });

    test('shows the trademark notice', () => {
        renderModal(makeVm());
        expect(screen.getByText(/株式会社アーテックの登録商標/)).toBeInTheDocument();
    });
});
