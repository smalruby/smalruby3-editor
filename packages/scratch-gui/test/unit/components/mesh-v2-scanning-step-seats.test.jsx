import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import MeshV2ScanningStep from '../../../src/components/connection-modal/mesh-v2-scanning-step.jsx';
import ja from '../../../src/locales/ja.js';

const renderJa = (ui) =>
    render(
        <IntlProvider locale="ja" messages={ja}>
            {ui}
        </IntlProvider>,
    );

const peripheralList = [
    {
        peripheralId: 'g1',
        name: '【ほしくま】',
        meshIdLabel: 'ほしくま',
        seatInfo: { baseName: 'a', seats: [3, 7, 12], host: 3 },
        rssi: 0,
    },
    {
        peripheralId: 'g2',
        name: '【るかみね】',
        meshIdLabel: 'るかみね',
        seatInfo: { baseName: 'b', seats: [], host: 7 },
    },
    {
        peripheralId: 'g3',
        name: '【せんせい】',
        meshIdLabel: 'せんせい',
        seatInfo: { baseName: 'c', seats: [], host: 'teacher' },
    },
    { peripheralId: 'g4', name: '【ふるいの】', meshIdLabel: 'ふるいの', seatInfo: null },
];

const props = (extra) => ({
    scanning: true,
    peripheralList,
    hiraganaInput: '',
    onHiraganaInput: jest.fn(),
    onHiraganaClear: jest.fn(),
    onConnecting: jest.fn(),
    onRefresh: jest.fn(),
    ...extra,
});

describe('MeshV2ScanningStep seat numbers', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('shows seat numbers inside a classroom', () => {
        renderJa(<MeshV2ScanningStep {...props({ mySeat: { seat: 7, teacher: false } })} />);
        expect(screen.getByText('3・7・12番のグループ（ほしくま）')).toBeInTheDocument();
        expect(screen.getByText('7番がホストのグループ（るかみね）')).toBeInTheDocument();
        expect(screen.getByText('先生のグループ（せんせい）')).toBeInTheDocument();
        expect(screen.getByText('【ふるいの】')).toBeInTheDocument();
    });

    test('keeps the plain names outside a classroom', () => {
        renderJa(<MeshV2ScanningStep {...props({ mySeat: null })} />);
        expect(screen.getByText('【ほしくま】')).toBeInTheDocument();
        expect(screen.getByText('【るかみね】')).toBeInTheDocument();
        expect(screen.queryByText(/番のグループ/)).toBeNull();
    });

    test('asks before joining a group for other seats', () => {
        const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
        const p = props({ mySeat: { seat: 20, teacher: false } });
        renderJa(<MeshV2ScanningStep {...p} />);
        fireEvent.click(screen.getAllByRole('button', { name: 'Connect' })[0]);
        expect(confirm).toHaveBeenCalledWith(
            'このグループは 3・7・12番用です。あなた（20番）は選ばれていません。それでも参加しますか？',
        );
        expect(p.onConnecting).not.toHaveBeenCalled();

        confirm.mockReturnValue(true);
        fireEvent.click(screen.getAllByRole('button', { name: 'Connect' })[0]);
        expect(p.onConnecting).toHaveBeenCalledWith('g1');
    });

    test('joins a chosen seat group without asking', () => {
        const confirm = jest.spyOn(window, 'confirm');
        const p = props({ mySeat: { seat: 7, teacher: false } });
        renderJa(<MeshV2ScanningStep {...p} />);
        fireEvent.click(screen.getAllByRole('button', { name: 'Connect' })[0]);
        expect(confirm).not.toHaveBeenCalled();
        expect(p.onConnecting).toHaveBeenCalledWith('g1');
    });
});
