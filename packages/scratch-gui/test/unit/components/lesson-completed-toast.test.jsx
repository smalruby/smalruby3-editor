/* eslint-env jest */
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import LessonCompletedToast from '../../../src/components/lesson-completed-toast/lesson-completed-toast.jsx';
import { ja } from '../../../src/lib/lessons/lessons.locale.js';

const challenge = {
    id: 'blocks-l1-key-sound',
    name: { id: 'gui.lessons.challenge.blocks-l1-key-sound.name', defaultMessage: 'Play a sound with a key' },
    skills: [
        { id: 'key', name: { id: 'gui.lessons.skill.key.name', defaultMessage: 'Move with keys' } },
        { id: 'sound', name: { id: 'gui.lessons.skill.sound.name', defaultMessage: 'Play sounds' } },
    ],
};

const renderToast = (props = {}, { locale = 'en', messages = {} } = {}) =>
    render(
        <IntlProvider locale={locale} messages={messages}>
            <LessonCompletedToast challenge={challenge} onClose={jest.fn()} {...props} />
        </IntlProvider>,
    );

describe('LessonCompletedToast', () => {
    test('shows the title, the challenge name and the skills', () => {
        const { getByTestId } = renderToast();
        expect(getByTestId('lesson-completed-toast')).toBeInTheDocument();
        expect(getByTestId('lesson-completed-toast-title')).toHaveTextContent('You did it!');
        expect(getByTestId('lesson-completed-toast-challenge')).toHaveTextContent('Play a sound with a key');
        expect(getByTestId('lesson-completed-toast-skills')).toHaveTextContent(
            'Now you can: Move with keys, Play sounds',
        );
    });

    test('uses the Japanese strings and separator', () => {
        const messages = {
            ...ja,
            'gui.lessons.skill.key.name': 'キーで動かす',
            'gui.lessons.skill.sound.name': '音を鳴らす',
        };
        const { getByTestId } = renderToast({}, { locale: 'ja', messages });
        expect(getByTestId('lesson-completed-toast-title')).toHaveTextContent('できた！');
        expect(getByTestId('lesson-completed-toast-skills')).toHaveTextContent(
            'できること: キーで動かす・音を鳴らす',
        );
    });

    test('omits the skills line when the challenge has none', () => {
        const { queryByTestId } = renderToast({ challenge: { ...challenge, skills: [] } });
        expect(queryByTestId('lesson-completed-toast-skills')).not.toBeInTheDocument();
    });

    test('close button invokes onClose', () => {
        const onClose = jest.fn();
        const { getByTestId } = renderToast({ onClose });
        fireEvent.click(getByTestId('lesson-completed-toast-close'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
