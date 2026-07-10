import React from 'react';
import {FormattedMessage} from 'react-intl';

import libraryIntro from '../thumbnails/getting-started.jpg';
import {CATEGORIES} from '../../tutorial-tags';

const decks = {
    'intro-getting-started': {
        name: (
            <FormattedMessage
                defaultMessage="さあ、始めましょう"
                description="Name for the 'Getting Started' tutorial"
                id="gui.howtos.getting-started.name"
            />
        ),
        tags: ['ruby', 'はじめて'],
        category: CATEGORIES.gettingStarted,
        img: libraryIntro,
        nameMessageId: 'gui.howtos.getting-started.name',
        steps: [
            {
                title: (
                    <FormattedMessage
                        defaultMessage="ブロックの次はルビー(Ruby)にチャレンジしてみよう！"
                        description="Step 1: Introduce Ruby tab"
                        id="gui.howtos.getting-started.step.rubyTab"
                    />
                ),
                image: 'introRubyTab',
                startTutorial: true,
                animationTarget: 'startTutorialButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="ルビーを表示してプログラムを入力してみよう"
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
end`,
                animationTarget: 'insertCodeButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="実行ボタンを押してプログラムを実行しよう"
                        description="Step 3: Run the program"
                        id="gui.howtos.getting-started.step.runRuby"
                    />
                ),
                image: 'introRunRuby',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="ネコが行ったり来たりするプログラムができました🎉"
                        description="Step 4: Celebrate first program"
                        id="gui.howtos.getting-started.step.firstProgram"
                    />
                ),
                image: 'introFirstProgram'
            }
        ],
        urlId: 'getStarted'
    },
};

export default decks;
