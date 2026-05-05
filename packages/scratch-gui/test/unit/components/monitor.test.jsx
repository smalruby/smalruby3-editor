import React from 'react';
import {render} from '@testing-library/react';
import Monitor from '../../../src/components/monitor/monitor';
import {DARK_MODE, DEFAULT_MODE} from '../../../src/lib/settings/color-mode';

jest.mock('../../../src/lib/settings/color-mode/default', () => ({
    blockColors: {
        motion: {
            colourPrimary: '#111111',
            colourSecondary: '#222222',
            colourTertiary: '#333333'
        },
        pen: {
            colourPrimary: '#121212',
            colourSecondary: '#232323',
            colourTertiary: '#343434'
        },
        text: '#444444',
        workspace: '#555555'
    }
}));

jest.mock('../../../src/lib/settings/color-mode/dark', () => ({
    blockColors: {
        motion: {
            colourPrimary: '#AAAAAA'
        },
        pen: {
            colourPrimary: '#FFFFFF',
            colourSecondary: '#EEEEEE',
            colourTertiary: '#DDDDDD'
        },
        text: '#BBBBBB'
    },
    extensions: {
        pen: {
            blockIconURI: 'darkPenIcon'
        }
    }
}));

describe('Monitor Component', () => {
    const noop = jest.fn();

    const defaultProps = {
        category: 'motion',
         
        componentRef: noop,
        draggable: false,
        label: 'My label',
        mode: 'default',
         
        onDragEnd: noop,
         
        onNextMode: noop
    };

    test('it selects the correct colors based on default color mode', () => {
        const {container} = render(<Monitor
            {...defaultProps}
            colorMode={DEFAULT_MODE}
        />);

        expect(container.firstChild).toMatchSnapshot();
    });

    test('it selects the correct colors based on dark mode', () => {
        const {container} = render(<Monitor
            {...defaultProps}
            colorMode={DARK_MODE}
        />);

        expect(container.firstChild).toMatchSnapshot();
    });
});
