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
                defaultMessage="さあ、始めましょう"
                description="Name for the 'Getting Started' tutorial"
                id="gui.howtos.getting-started.name"
            />
        ),
        tags: ['ruby', 'はじめて'],
        img: libraryIntro,
        steps: [
            {
                title: (
                    <FormattedMessage
                        defaultMessage="ブロックだけじゃない。Rubyでもプログラムを作れる"
                        description="Step 1: Introduce Ruby tab"
                        id="gui.howtos.getting-started.step.rubyTab"
                    />
                ),
                image: 'introRubyTab'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="ネコが行ったり来たりするプログラムを作ってみよう"
                        description="Step 2: Create bounce program"
                        id="gui.howtos.getting-started.step.bounceCode"
                    />
                ),
                image: 'introBounceCode',
                code: `when_flag_clicked do
  loop do
    move(10)
    bounce_if_on_edge
  end
end`
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="作ったプログラムを実行しよう"
                        description="Step 3: Run the program"
                        id="gui.howtos.getting-started.step.runRuby"
                    />
                ),
                image: 'introRunRuby'
            }
        ],
        urlId: 'getstarted'
    }
};

export default decks;
