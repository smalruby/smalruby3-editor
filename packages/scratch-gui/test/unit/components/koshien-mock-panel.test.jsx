/* eslint-env jest */
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
// eslint-disable-next-line import/first
import KoshienMockPanel from '../../../src/components/koshien-mock-panel/koshien-mock-panel.jsx';

const renderPanel = (props) =>
    render(
        <IntlProvider locale="en">
            <KoshienMockPanel onClose={jest.fn()} {...props} />
        </IntlProvider>,
    );

const fakeSnapshot = () => ({
    connected: true,
    playerName: 'p1',
    side: 1,
    strategy: 'goal',
    finished: false,
    myMap: Array.from({ length: 3 }, () => [-1, -1, -1]),
    game: {
        mapId: 'meadow',
        turn: 3,
        over: false,
        goal: [1, 1],
        rows: ['222', '203', '211'],
        events: [],
        pawns: [
            {
                side: 1,
                isUser: true,
                name: 'p1',
                x: 1,
                y: 1,
                score: 30,
                status: 'playing',
                dynamiteLeft: 2,
                bombLeft: 1,
                actionsUsed: 1,
                actionsLimit: 2,
                canMove: true,
                inWater: false,
                walkCount: 2,
                message: '',
                level: 4,
            },
            {
                side: 2,
                isUser: false,
                name: 'rival',
                x: 1,
                y: 1,
                score: 10,
                status: 'playing',
                dynamiteLeft: 2,
                bombLeft: 2,
                actionsUsed: 0,
                actionsLimit: 2,
                canMove: true,
                inWater: false,
                walkCount: 0,
                message: '',
                level: 4,
            },
        ],
        fiend: { x: 1, y: 1, prev_x: 1, prev_y: 1, state: 'normal', kill_player: 'none', killed: false },
    },
    journal: [
        { turn: 1, kind: 'action', text: 'マップ取得 (1:1)' },
        { turn: 1, kind: 'error', text: '移動: このターンではもう行動できません' },
    ],
});

describe('KoshienMockPanel', () => {
    test('shows a hint before the AI connects', () => {
        const { getByTestId, queryByTestId } = renderPanel({ snapshot: null });
        expect(getByTestId('koshien-mock-panel')).toBeInTheDocument();
        expect(getByTestId('koshien-mock-panel-not-connected')).toBeInTheDocument();
        expect(queryByTestId('koshien-mock-panel-canvas')).not.toBeInTheDocument();
    });

    test('shows the board, turn, both pawns and the journal once connected', () => {
        const { getByTestId } = renderPanel({ snapshot: fakeSnapshot() });
        expect(getByTestId('koshien-mock-panel-canvas')).toBeInTheDocument();
        expect(getByTestId('koshien-mock-panel-turn')).toHaveTextContent('3 / 50');
        expect(getByTestId('koshien-mock-panel-me')).toHaveTextContent('p1');
        expect(getByTestId('koshien-mock-panel-rival')).toHaveTextContent('goal');
        const journal = getByTestId('koshien-mock-panel-journal');
        expect(journal).toHaveTextContent('マップ取得');
        expect(journal).toHaveTextContent('もう行動できません');
    });

    test('the close button calls onClose', () => {
        const onClose = jest.fn();
        const { getByTestId } = renderPanel({ snapshot: fakeSnapshot(), onClose });
        fireEvent.click(getByTestId('koshien-mock-panel-close'));
        expect(onClose).toHaveBeenCalled();
    });

    test('the toggle button collapses the body', () => {
        const { getByTestId, queryByTestId } = renderPanel({ snapshot: fakeSnapshot() });
        fireEvent.click(getByTestId('koshien-mock-panel-toggle'));
        expect(queryByTestId('koshien-mock-panel-canvas')).not.toBeInTheDocument();
        fireEvent.click(getByTestId('koshien-mock-panel-toggle'));
        expect(queryByTestId('koshien-mock-panel-canvas')).toBeInTheDocument();
    });

    test('the all / my-AI view switch renders and toggles without crashing', () => {
        const { getByTestId } = renderPanel({ snapshot: fakeSnapshot() });
        expect(getByTestId('koshien-mock-panel-view-all')).toHaveAttribute('aria-pressed', 'true');
        fireEvent.click(getByTestId('koshien-mock-panel-view-mine'));
        expect(getByTestId('koshien-mock-panel-view-mine')).toHaveAttribute('aria-pressed', 'true');
        expect(getByTestId('koshien-mock-panel-view-all')).toHaveAttribute('aria-pressed', 'false');
        expect(getByTestId('koshien-mock-panel-canvas')).toBeInTheDocument();
        fireEvent.click(getByTestId('koshien-mock-panel-view-all'));
        expect(getByTestId('koshien-mock-panel-view-all')).toHaveAttribute('aria-pressed', 'true');
    });
});
