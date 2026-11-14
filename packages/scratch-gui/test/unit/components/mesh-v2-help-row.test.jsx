/* eslint-env jest */
// メッシュの接続のモーダルの［ヘルプ］は、濃い緑のヘッダーではなく、どの画面でも本文の下に出す (#1899)。
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import ConnectionModal, { PHASES } from '../../../src/components/connection-modal/connection-modal.jsx';
import MeshV2HelpRow from '../../../src/components/connection-modal/mesh-v2-help-row.jsx';
import en from '../../../src/locales/en';

// The shared Modal is connected to redux; a plain stand-in shows whether the header gets the help.
jest.mock('../../../src/containers/modal.jsx', () => {
    const React = require('react');
    const PropTypes = require('prop-types');
    const MockModal = ({ children, headerTitle, onHelp }) => (
        <div data-header-help={onHelp ? 'yes' : 'no'} data-testid="modal">
            <div data-testid="modal-title">{headerTitle}</div>
            {children}
        </div>
    );
    MockModal.propTypes = { children: PropTypes.node, headerTitle: PropTypes.node, onHelp: PropTypes.func };
    return MockModal;
});

// Each step is replaced by a stub: this test is only about where the help is.
// A function declaration, so it exists when the hoisted jest.mock factories run.
function mockStub(name) {
    const React = require('react');
    const Stub = () => React.createElement('div', { 'data-testid': `step-${name}` });
    return Stub;
}
jest.mock('../../../src/containers/scanning-step.jsx', () => mockStub('scanning'));
jest.mock('../../../src/containers/auto-scanning-step.jsx', () => mockStub('auto-scanning'));
jest.mock('../../../src/components/connection-modal/connecting-step.jsx', () => mockStub('connecting'));
jest.mock('../../../src/components/connection-modal/connected-step.jsx', () => mockStub('connected'));
jest.mock('../../../src/components/connection-modal/error-step.jsx', () => mockStub('error'));
jest.mock('../../../src/components/connection-modal/mesh-v2-network-filtered-step.jsx', () =>
    mockStub('network-filtered'),
);
jest.mock('../../../src/components/connection-modal/mesh-v2-initial-step.jsx', () => mockStub('initial'));
jest.mock('../../../src/containers/mesh-v2-seat-connect.jsx', () => mockStub('seat'));

const renderModal = (props) =>
    render(
        <IntlProvider locale="en" messages={en}>
            <ConnectionModal
                connectingMessage="Connecting"
                name="Mesh"
                onCancel={jest.fn()}
                onHelp={jest.fn()}
                title="meshV2"
                useAutoScan={false}
                {...props}
            />
        </IntlProvider>,
    );

describe('MeshV2HelpRow (#1899)', () => {
    test('a help button that calls onHelp', () => {
        const onHelp = jest.fn();
        render(
            <IntlProvider locale="en" messages={en}>
                <MeshV2HelpRow onHelp={onHelp} />
            </IntlProvider>,
        );
        const button = screen.getByTestId('meshV2-help');
        expect(button).toHaveTextContent('Help');
        fireEvent.click(button);
        expect(onHelp).toHaveBeenCalledTimes(1);
    });

    test('nothing without onHelp', () => {
        const { container } = render(<MeshV2HelpRow />);
        expect(container).toBeEmptyDOMElement();
    });
});

describe('ConnectionModal help placement for mesh (#1899)', () => {
    const meshPhases = [
        [PHASES.meshV2Initial, 'initial'],
        [PHASES.networkFiltered, 'network-filtered'],
        [PHASES.scanning, 'scanning'],
        [PHASES.connected, 'connected'],
        [PHASES.meshV2Seat, 'seat'],
    ];

    test.each(meshPhases)('mesh %s: help is in the body under the step, not in the header', (phase, step) => {
        const onHelp = jest.fn();
        renderModal({ extensionId: 'meshV2', meshV2Seat: { seat: 3, teacher: false }, onHelp, phase });
        expect(screen.getByTestId(`step-${step}`)).toBeInTheDocument();
        expect(screen.getByTestId('modal')).toHaveAttribute('data-header-help', 'no');
        fireEvent.click(screen.getByTestId('meshV2-help'));
        expect(onHelp).toHaveBeenCalledTimes(1);
    });

    test('mesh: the title is the bold large title', () => {
        renderModal({ extensionId: 'meshV2', phase: PHASES.meshV2Initial });
        expect(screen.getByTestId('modal-title').firstChild).toHaveTextContent('Mesh');
        expect(screen.getByTestId('modal-title').firstChild.tagName).toBe('SPAN');
    });

    test('other devices keep the upstream header help and no body help', () => {
        renderModal({ extensionId: 'microbit', name: 'micro:bit', phase: PHASES.scanning, title: 'microbit' });
        expect(screen.getByTestId('modal')).toHaveAttribute('data-header-help', 'yes');
        expect(screen.queryByTestId('meshV2-help')).toBeNull();
    });
});
