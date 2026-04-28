import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent } from '@testing-library/react';
import SmalrubotS1InitialStep from '../../../src/components/connection-modal/smalrubot-s1-initial-step.jsx';
import { renderWithIntl } from '../../helpers/intl-helpers.jsx';

const defaultProps = (overrides = {}) => ({
    onChooseConnect: jest.fn(),
    onChooseFlashFirmware: jest.fn(),
    onHelp: jest.fn(),
    ...overrides,
});

describe('SmalrubotS1InitialStep component', () => {
    test('renders both student-connect and teacher-flash-firmware buttons', () => {
        const { getByTestId } = renderWithIntl(<SmalrubotS1InitialStep {...defaultProps()} />);
        expect(getByTestId('smalrubot-s1-initial-connect')).toBeInTheDocument();
        expect(getByTestId('smalrubot-s1-initial-flash-firmware')).toBeInTheDocument();
    });

    test('calls onChooseConnect when student connect button is clicked', () => {
        const onChooseConnect = jest.fn();
        const { getByTestId } = renderWithIntl(
            <SmalrubotS1InitialStep {...defaultProps({ onChooseConnect })} />,
        );
        fireEvent.click(getByTestId('smalrubot-s1-initial-connect'));
        expect(onChooseConnect).toHaveBeenCalledTimes(1);
    });

    test('calls onChooseFlashFirmware when teacher firmware button is clicked', () => {
        const onChooseFlashFirmware = jest.fn();
        const { getByTestId } = renderWithIntl(
            <SmalrubotS1InitialStep {...defaultProps({ onChooseFlashFirmware })} />,
        );
        fireEvent.click(getByTestId('smalrubot-s1-initial-flash-firmware'));
        expect(onChooseFlashFirmware).toHaveBeenCalledTimes(1);
    });

    test('renders help button when onHelp is provided', () => {
        const onHelp = jest.fn();
        const { getByTestId } = renderWithIntl(<SmalrubotS1InitialStep {...defaultProps({ onHelp })} />);
        fireEvent.click(getByTestId('smalrubot-s1-initial-help'));
        expect(onHelp).toHaveBeenCalledTimes(1);
    });

    test('does not render help button when onHelp is not provided', () => {
        const { queryByTestId } = renderWithIntl(
            <SmalrubotS1InitialStep
                onChooseConnect={jest.fn()}
                onChooseFlashFirmware={jest.fn()}
                onHelp={undefined}
            />,
        );
        expect(queryByTestId('smalrubot-s1-initial-help')).toBeNull();
    });
});
