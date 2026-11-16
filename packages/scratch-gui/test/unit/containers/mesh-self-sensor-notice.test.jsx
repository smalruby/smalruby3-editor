/* eslint-env jest */
// メッシュの「同じ名前」のお知らせを出すかどうか。レッスンのチャレンジを開いているあいだは出さない (#2081)。
import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import { EventEmitter } from 'events';
import React from 'react';
import { IntlProvider } from 'react-intl';
import { MeshSelfSensorNoticeContainer } from '../../../src/containers/mesh-self-sensor-notice.jsx';
import { hasSensorValueCollision } from '../../../src/lib/mesh-v2-sensor-collision.js';

jest.mock('../../../src/lib/mesh-v2-sensor-collision.js', () => ({
    hasSensorValueCollision: jest.fn(() => true),
}));

const SHOWN_KEY = 'smalruby:meshSelfSensorNoticeShown';

const renderNotice = (props) =>
    render(
        <IntlProvider locale="en" messages={{}}>
            <MeshSelfSensorNoticeContainer isOpen={false} onHide={jest.fn()} onShow={jest.fn()} {...props} />
        </IntlProvider>,
    );

describe('MeshSelfSensorNoticeContainer', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        window.localStorage.clear();
        hasSensorValueCollision.mockClear();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('shows once when a collision is found outside a lesson', () => {
        const onShow = jest.fn();
        renderNotice({ vm: new EventEmitter(), onShow, inLesson: false });
        act(() => jest.advanceTimersByTime(400));
        expect(onShow).toHaveBeenCalledTimes(1);
        expect(window.localStorage.getItem(SHOWN_KEY)).toBe('true');
    });

    test('stays silent while a lesson challenge is open and shows after it closes', () => {
        const vm = new EventEmitter();
        const onShow = jest.fn();
        const { rerender } = renderNotice({ vm, onShow, inLesson: true });
        act(() => jest.advanceTimersByTime(400));
        act(() => {
            vm.emit('PROJECT_CHANGED');
            jest.advanceTimersByTime(400);
        });
        expect(onShow).not.toHaveBeenCalled();
        expect(window.localStorage.getItem(SHOWN_KEY)).toBeNull();

        rerender(
            <IntlProvider locale="en" messages={{}}>
                <MeshSelfSensorNoticeContainer
                    isOpen={false}
                    onHide={jest.fn()}
                    onShow={onShow}
                    vm={vm}
                    inLesson={false}
                />
            </IntlProvider>,
        );
        act(() => {
            vm.emit('PROJECT_CHANGED');
            jest.advanceTimersByTime(400);
        });
        expect(onShow).toHaveBeenCalledTimes(1);
    });

    test('hides an open notice while a lesson challenge is open', () => {
        window.localStorage.setItem(SHOWN_KEY, 'true');
        renderNotice({ vm: new EventEmitter(), isOpen: true, inLesson: true });
        expect(screen.queryByTestId('mesh-self-sensor-notice')).toBeNull();
    });
});
