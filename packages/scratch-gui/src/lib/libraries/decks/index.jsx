import React from 'react';
import {FormattedMessage} from 'react-intl';

// Tutorial thumbnails: Avoid using any text that would need to be
// translated in thumbnails.
// Intro
import libraryIntro from './thumbnails/getting-started.jpg';

const decks = {
    'getting-started': {
        name: (
            <FormattedMessage
                defaultMessage="Getting Started"
                description="Name for the 'Getting Started' tutorial"
                id="gui.howtos.getting-started.name"
            />
        ),
        tags: ['animation'],
        img: libraryIntro,
        steps: [
            {
                video: 'intro-move-sayhello'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="Add a move block"
                        description="Step title for adding a move block"
                        id="gui.howtos.getting-started.step.move"
                    />
                ),
                image: 'introMove'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="Add a say block"
                        description="Step title for adding a say block"
                        id="gui.howtos.getting-started.step.say"
                    />
                ),
                image: 'introSay'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="Click the green flag to start"
                        description="Step title for clicking the green flag"
                        id="gui.howtos.getting-started.step.greenFlag"
                    />
                ),
                image: 'introGreenFlag'
            }
        ],
        urlId: 'getstarted'
    }
};

export default decks;
