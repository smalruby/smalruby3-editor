/* eslint-env jest */
// メッシュの接続のモーダルの「ヘルプ」は、濃い緑のヘッダーではなく本文に置く (#1899)。
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import MeshV2InitialStep from '../../../src/components/connection-modal/mesh-v2-initial-step.jsx';
import en from '../../../src/locales/en';

const renderStep = (props) =>
    render(
        <IntlProvider locale="en" messages={en}>
            <MeshV2InitialStep
                onCreateGroup={jest.fn()}
                onDomainChange={jest.fn()}
                onJoinGroup={jest.fn()}
                {...props}
            />
        </IntlProvider>,
    );

describe('MeshV2InitialStep help in the body (#1899)', () => {
    test('shows a help button in the body that calls onHelp', () => {
        const onHelp = jest.fn();
        renderStep({ onHelp });
        const button = screen.getByTestId('meshV2-help');
        expect(button).toHaveTextContent('Help');
        fireEvent.click(button);
        expect(onHelp).toHaveBeenCalledTimes(1);
    });

    test('no help button without onHelp', () => {
        renderStep({});
        expect(screen.queryByTestId('meshV2-help')).toBeNull();
    });
});
