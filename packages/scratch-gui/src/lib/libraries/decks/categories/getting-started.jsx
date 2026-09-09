import React from 'react';
import {FormattedMessage} from 'react-intl';

import libraryIntro from '../thumbnails/getting-started.jpg';
import libraryGettingStartedCostume from '../thumbnails/getting-started-costume.jpg';
import libraryGettingStartedSprites from '../thumbnails/getting-started-sprites.jpg';
import {CATEGORIES} from '../../tutorial-tags';
import GreenFlagIcon from '../green-flag-icon.jsx';

// 単機能チュートリアルの規約 (issue #1179 で確定。後続 leaf もこれに従う):
//   - deck id     : `getting-started-<機能スラッグ>` — Lv 番号も通し番号も付けない。
//                   このカテゴリの deck は 1 本完結・順番に依存しない
//                   （「好きなものを3つ」が成立する）ため、順序を示す番号は付けない
//   - locale キー : `gui.howtos.getting-started-<スラッグ>.{name,stepN.title}`
//   - step 画像   : `getting-started-<スラッグ>-<N>-<説明>.<ext>`。
//                   複数 deck で共有する素材は `getting-started-shared-<説明>.<ext>`
//   - 画像キー    : `gettingStarted<スラッグPascal>StepN`（ja-steps.js / en-steps.js）
//   - urlId       : `gettingStarted<スラッグPascal>`
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

    // ─── コスチュームをかえてみよう（単機能・見た目） ───────────────────────
    'getting-started-costume': {
        name: (
            <FormattedMessage
                defaultMessage="コスチュームをかえてみよう"
                description="Name for the single-feature 'switch costume' tutorial"
                id="gui.howtos.getting-started-costume.name"
            />
        ),
        tags: ['ブロック', 'はじめて'],
        category: CATEGORIES.gettingStarted,
        img: libraryGettingStartedCostume,
        nameMessageId: 'gui.howtos.getting-started-costume.name',
        // コスチュームタブを開いた状態から始める（この deck の主題がそこにある）。
        setup: {
            tab: 'costumes',
        },
        allowedBlocks: {
            motion: [],
            looks: ['looks_nextcostume', 'looks_switchcostumeto', 'looks_costume'],
            sound: [],
            event: ['event_whenflagclicked'],
            control: ['control_repeat', 'control_wait'],
            sensing: [],
            operators: [],
        },
        steps: [
            {
                title: (
                    <FormattedMessage
                        defaultMessage="スプライトの見た目（コスチューム）をかえてみよう！"
                        description="Getting Started Costume Step 1: Intro"
                        id="gui.howtos.getting-started-costume.step1.title"
                    />
                ),
                image: 'gettingStartedCostumeStep1',
                startTutorial: true,
                animationTarget: 'startTutorialButton',
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="「コスチューム」タブで、コスチュームをふやしてみよう"
                        description="Getting Started Costume Step 2: Add a costume in the costume tab"
                        id="gui.howtos.getting-started-costume.step2.title"
                    />
                ),
                image: 'gettingStartedCostumeStep2',
                animationTarget: 'nextButton',
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="「コード」タブにもどって、「見た目」のブロックを入れてみよう"
                        description="Getting Started Costume Step 3: Insert the next-costume blocks"
                        id="gui.howtos.getting-started-costume.step3.title"
                    />
                ),
                image: 'gettingStartedCostumeStep3',
                code: `when_flag_clicked do
  3.times do
    next_costume
    sleep(1)
  end
end`,
                codeType: 'blocks',
                animationTarget: 'insertCodeButton',
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="{greenFlag}を押すと、コスチュームが順番にかわるよ"
                        description="Getting Started Costume Step 4: Run and see the costume change"
                        id="gui.howtos.getting-started-costume.step4.title"
                        values={{greenFlag: <GreenFlagIcon />}}
                    />
                ),
                image: 'gettingStartedCostumeStep4',
                animationTarget: 'nextButton',
            },
        ],
        urlId: 'gettingStartedCostume',
    },

    // ─── スプライトを2つ使ってみよう（単機能・スプライト操作） ───────────────
    'getting-started-sprites': {
        name: (
            <FormattedMessage
                defaultMessage="スプライトを2つ使ってみよう"
                description="Name for the single-feature 'use two sprites' tutorial"
                id="gui.howtos.getting-started-sprites.name"
            />
        ),
        tags: ['ブロック', 'はじめて'],
        category: CATEGORIES.gettingStarted,
        img: libraryGettingStartedSprites,
        nameMessageId: 'gui.howtos.getting-started-sprites.name',
        // スプライトの追加・選択が主題なので、コードタブから始める。
        setup: {
            tab: 'code',
        },
        allowedBlocks: {
            motion: [],
            looks: ['looks_sayforsecs', 'looks_say'],
            sound: [],
            event: ['event_whenflagclicked'],
            control: ['control_wait'],
            sensing: [],
            operators: [],
        },
        steps: [
            {
                title: (
                    <FormattedMessage
                        defaultMessage="スプライトをふやして、2つのキャラクターを動かそう！"
                        description="Getting Started Sprites Step 1: Intro - add a second sprite"
                        id="gui.howtos.getting-started-sprites.step1.title"
                    />
                ),
                image: 'gettingStartedSpritesStep1',
                startTutorial: true,
                animationTarget: 'startTutorialButton',
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="スプライトをえらぶと、そのスプライトのプログラムになるよ"
                        description="Getting Started Sprites Step 2: Selecting a sprite switches its program"
                        id="gui.howtos.getting-started-sprites.step2.title"
                    />
                ),
                image: 'gettingStartedSpritesStep2',
                animationTarget: 'nextButton',
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="ネコ（スプライト1）をえらんで、このプログラムを入れよう"
                        description="Getting Started Sprites Step 3: Insert the cat's program"
                        id="gui.howtos.getting-started-sprites.step3.title"
                    />
                ),
                image: 'gettingStartedSpritesStep3',
                code: `when_flag_clicked do
  say("こんにちは！", 2)
end`,
                codeType: 'blocks',
                animationTarget: 'insertCodeButton',
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="ペンギンをえらんでこのプログラムを入れて、{greenFlag}を押してみよう"
                        description="Getting Started Sprites Step 4: Insert the penguin's program and run"
                        id="gui.howtos.getting-started-sprites.step4.title"
                        values={{greenFlag: <GreenFlagIcon />}}
                    />
                ),
                image: 'gettingStartedSpritesStep4',
                code: `when_flag_clicked do
  sleep(2)
  say("やあ！", 2)
end`,
                codeType: 'blocks',
                animationTarget: 'insertCodeButton',
            },
        ],
        urlId: 'gettingStartedSprites',
    },
};

export default decks;
