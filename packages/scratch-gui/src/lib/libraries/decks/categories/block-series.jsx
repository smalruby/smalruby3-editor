// Deck definitions for the blockBasics/blockGames tutorial categories
// (Phase 3, issue #680). This module holds the blockGames (第4章
// シューティング) decks (issue #958).
//
// These decks are book-excerpt "試食" tutorials: each opens with the book's
// bibliographic info and closes with a "続きは書籍で" purchase link. The
// shared opening/closing steps and book constant live in book-promo.jsx
// (issue #956). The excerpted programs come from
// docs/tutorial/book-kirakira-ruby-source.md 第4章 (chapter 4), converted to
// Ruby v2 syntax so they convert cleanly into blocks.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {CATEGORIES} from '../../tutorial-tags';
import GreenFlagIcon from '../green-flag-icon.jsx';
import {bookOpeningStep, bookClosingStep, bookAdvancedClosingStep} from './book-promo.jsx';

import libraryBlockShootingLv0 from '../thumbnails/block-shooting-lv0.jpg';
import libraryBlockShootingLv2 from '../thumbnails/block-shooting-lv2.jpg';
import libraryBlockShootingLv3 from '../thumbnails/block-shooting-lv3.jpg';
import libraryBlockShootingAdvanced from '../thumbnails/block-shooting-advanced.jpg';

// Chapter this series excerpts from (see book-kirakira-ruby-source.md).
const CHAPTER = 4;

// ネコ（スプライト1）を上下に動かすプログラム。Lv0/Lv2/Lv3 で共通の題材。
const CAT_MOVE_CODE = `when_key_pressed("up arrow") do
  self.y += 10
end
when_key_pressed("down arrow") do
  self.y += -10
end`;

// タマ（Arrow1）を発射して右へ飛ばし、端で消すプログラム。
const BULLET_CODE = `when_flag_clicked do
  hide
end
when_key_pressed("space") do
  go_to("スプライト1")
  show
  until touching?("_edge_")
    self.x += 10
  end
  hide
end`;

// 発展：クローンでタマをたくさん出すプログラム（見せるだけ）。
const CLONE_CODE = `when_flag_clicked do
  hide
end
when_key_pressed("space") do
  create_clone("_myself_")
end
when_start_as_a_clone do
  go_to("スプライト1")
  show
  until touching?("_edge_")
    self.x += 10
  end
  delete_this_clone
end`;

const decks = {
    // ─── blockGames 第4章 Lv0：コードを挿入して動かしてみる ───
    'block-shooting-lv0': {
        name: (
            <FormattedMessage
                defaultMessage="シューティングゲームを作ろう Lv0"
                description="Name for blockGames chapter 4 Lv0: insert code and play"
                id="gui.howtos.block-shooting-lv0.name"
            />
        ),
        tags: [],
        category: CATEGORIES.blockGames,
        img: libraryBlockShootingLv0,
        nameMessageId: 'gui.howtos.block-shooting-lv0.name',
        allowedBlocks: {
            motion: ['motion_changeyby'],
            looks: [],
            sound: [],
            event: ['event_whenkeypressed'],
            control: [],
            sensing: [],
            operators: [],
        },
        steps: [
            bookOpeningStep(CHAPTER, 'blockShootingOpening'),
            {
                title: (
                    <FormattedMessage
                        defaultMessage="この章ではネコが上下に動いてタマをうつシューティングゲームを作るよ。まずは動かしてみよう！"
                        description="blockShooting Lv0 Step: intro"
                        id="gui.howtos.block-shooting-lv0.step.intro"
                    />
                ),
                image: 'blockShootingLv0Intro',
                startTutorial: true,
                animationTarget: 'startTutorialButton',
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="「コードを挿入」ボタンを押して、ネコを上下に動かすプログラムを入れてみよう"
                        description="blockShooting Lv0 Step: insert cat up/down code"
                        id="gui.howtos.block-shooting-lv0.step.move"
                    />
                ),
                image: 'blockShootingLv0Move',
                code: CAT_MOVE_CODE,
                codeType: 'blocks',
                animationTarget: 'insertCodeButton',
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="キーボードの上・下の矢印キーを押すと、ネコが上下に動くよ"
                        description="blockShooting Lv0 Step: try arrow keys"
                        id="gui.howtos.block-shooting-lv0.step.run"
                    />
                ),
                image: 'blockShootingRun',
                animationTarget: 'nextButton',
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="「10」の数を変えると、動く速さが変わるよ。好きな数に変えて試してみよう"
                        description="blockShooting Lv0 Step: change step amount"
                        id="gui.howtos.block-shooting-lv0.step.customize"
                    />
                ),
                image: 'blockShootingLv0Customize',
                animationTarget: 'nextButton',
            },
            bookClosingStep(CHAPTER, 'blockShootingClosing'),
        ],
        urlId: 'blockShootingLv0',
    },

    // ─── blockGames 第4章 Lv2：ブロックを自分で組み立てる ───
    'block-shooting-lv2': {
        name: (
            <FormattedMessage
                defaultMessage="シューティングゲームを作ろう Lv2"
                description="Name for blockGames chapter 4 Lv2: build blocks manually"
                id="gui.howtos.block-shooting-lv2.name"
            />
        ),
        tags: [],
        category: CATEGORIES.blockGames,
        img: libraryBlockShootingLv2,
        nameMessageId: 'gui.howtos.block-shooting-lv2.name',
        allowedBlocks: {
            motion: ['motion_changeyby', 'motion_changexby', 'motion_goto'],
            looks: ['looks_show', 'looks_hide'],
            sound: [],
            event: ['event_whenflagclicked', 'event_whenkeypressed'],
            control: ['control_repeat_until'],
            sensing: ['sensing_touchingobject'],
            operators: [],
        },
        steps: [
            bookOpeningStep(CHAPTER, 'blockShootingOpening'),
            {
                title: (
                    <FormattedMessage
                        defaultMessage="今度はブロックを自分で組み立ててみよう！"
                        description="blockShooting Lv2 Step: intro"
                        id="gui.howtos.block-shooting-lv2.step.intro"
                    />
                ),
                image: 'blockShootingLv2Intro',
                startTutorial: true,
                animationTarget: 'startTutorialButton',
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="ネコ：「上向き矢印キーが押されたとき」に「y座標を10ずつ変える」、下向きには「-10ずつ変える」を組み立てよう。y座標は上下の位置だよ"
                        description="blockShooting Lv2 Step: cat up/down blocks"
                        id="gui.howtos.block-shooting-lv2.step.catBlocks"
                    />
                ),
                image: 'blockShootingLv2CatBlocks',
                animationTarget: 'nextButton',
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="タマになるスプライト「Arrow1」を追加しよう（スプライト一覧の＋ボタンから選べるよ）"
                        description="blockShooting Lv2 Step: add Arrow1 sprite"
                        id="gui.howtos.block-shooting-lv2.step.addArrow"
                    />
                ),
                image: 'blockShootingAddArrow',
                animationTarget: 'nextButton',
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="タマ：スペースキーで「スプライト1へ行く」「表示する」、そして「端に触れるまでx座標を10ずつ変える」を繰り返し、最後に「隠す」。『〜まで繰り返す』は条件が成り立つまで続けるブロックだよ"
                        description="blockShooting Lv2 Step: bullet blocks with until loop"
                        id="gui.howtos.block-shooting-lv2.step.bulletBlocks"
                    />
                ),
                image: 'blockShootingLv2BulletBlocks',
                animationTarget: 'nextButton',
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="{greenFlag}を押して、矢印キーで動かしスペースキーでタマをうってみよう！"
                        description="blockShooting Lv2 Step: run"
                        id="gui.howtos.block-shooting-lv2.step.run"
                        values={{greenFlag: <GreenFlagIcon />}}
                    />
                ),
                image: 'blockShootingRun',
                animationTarget: 'nextButton',
            },
            bookClosingStep(CHAPTER, 'blockShootingClosing'),
        ],
        urlId: 'blockShootingLv2',
    },

    // ─── blockGames 第4章 Lv3：Ruby で書く ───
    'block-shooting-lv3': {
        name: (
            <FormattedMessage
                defaultMessage="シューティングゲームを作ろう Lv3"
                description="Name for blockGames chapter 4 Lv3: write it in Ruby"
                id="gui.howtos.block-shooting-lv3.name"
            />
        ),
        tags: ['ruby'],
        category: CATEGORIES.blockGames,
        img: libraryBlockShootingLv3,
        nameMessageId: 'gui.howtos.block-shooting-lv3.name',
        // Lv3 は Ruby タブ・Ruby モードで開く（improvement-plan.md 参照）。
        setup: {
            tab: 'ruby',
            rubyMode: 'ruby',
        },
        allowedBlocks: {
            motion: ['motion_changeyby', 'motion_changexby', 'motion_goto'],
            looks: ['looks_show', 'looks_hide'],
            sound: [],
            event: ['event_whenflagclicked', 'event_whenkeypressed'],
            control: ['control_repeat_until'],
            sensing: ['sensing_touchingobject'],
            operators: [],
        },
        steps: [
            bookOpeningStep(CHAPTER, 'blockShootingOpening'),
            {
                title: (
                    <FormattedMessage
                        defaultMessage="同じゲームを Ruby で書いてみよう。ルビータブが開いているのを確認してね"
                        description="blockShooting Lv3 Step: intro / ruby tab"
                        id="gui.howtos.block-shooting-lv3.step.intro"
                    />
                ),
                image: 'blockShootingLv3RubyTab',
                startTutorial: true,
                animationTarget: 'startTutorialButton',
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="ネコ：「コードを挿入」で上下移動のプログラムを入れよう。self.y は上下の位置だよ"
                        description="blockShooting Lv3 Step: insert cat Ruby code"
                        id="gui.howtos.block-shooting-lv3.step.catCode"
                    />
                ),
                image: 'blockShootingLv3CatCode',
                code: CAT_MOVE_CODE,
                animationTarget: 'insertCodeButton',
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="タマになるスプライト「Arrow1」を追加して、そのスプライトを選ぼう"
                        description="blockShooting Lv3 Step: add Arrow1 sprite"
                        id="gui.howtos.block-shooting-lv3.step.addArrow"
                    />
                ),
                image: 'blockShootingAddArrow',
                animationTarget: 'nextButton',
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="タマ：スペースキーで発射して右へ飛ばすプログラムを入れよう。until は条件が成り立つまで繰り返すよ"
                        description="blockShooting Lv3 Step: insert bullet Ruby code"
                        id="gui.howtos.block-shooting-lv3.step.bulletCode"
                    />
                ),
                image: 'blockShootingLv3BulletCode',
                code: BULLET_CODE,
                animationTarget: 'insertCodeButton',
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="{greenFlag}を押して、矢印キーとスペースキーで遊んでみよう！"
                        description="blockShooting Lv3 Step: run"
                        id="gui.howtos.block-shooting-lv3.step.run"
                        values={{greenFlag: <GreenFlagIcon />}}
                    />
                ),
                image: 'blockShootingRun',
                animationTarget: 'nextButton',
            },
            bookClosingStep(CHAPTER, 'blockShootingClosing'),
        ],
        urlId: 'blockShootingLv3',
    },

    // ─── blockGames 第4章【発展】：クローンでタマを増やす（見せるだけ・Lv0） ───
    'block-shooting-advanced': {
        name: (
            <FormattedMessage
                defaultMessage="シューティングゲーム【発展】クローンでタマを増やそう"
                description="Name for blockGames chapter 4 advanced: multiply bullets with clones (demo)"
                id="gui.howtos.block-shooting-advanced.name"
            />
        ),
        tags: [],
        category: CATEGORIES.blockGames,
        img: libraryBlockShootingAdvanced,
        nameMessageId: 'gui.howtos.block-shooting-advanced.name',
        allowedBlocks: {
            motion: ['motion_changexby', 'motion_goto'],
            looks: ['looks_show', 'looks_hide'],
            sound: [],
            event: ['event_whenflagclicked', 'event_whenkeypressed'],
            control: [
                'control_create_clone_of',
                'control_start_as_clone',
                'control_delete_this_clone',
                'control_repeat_until',
            ],
            sensing: ['sensing_touchingobject'],
            operators: [],
        },
        steps: [
            bookOpeningStep(CHAPTER, 'blockShootingOpening'),
            {
                title: (
                    <FormattedMessage
                        defaultMessage="タマを一度にたくさん出すには「クローン」を使うよ。まずは動くところを見てみよう！"
                        description="blockShooting Advanced Step: intro"
                        id="gui.howtos.block-shooting-advanced.step.intro"
                    />
                ),
                image: 'blockShootingAdvIntro',
                startTutorial: true,
                animationTarget: 'startTutorialButton',
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="タマ（Arrow1）を選んで「コードを挿入」しよう。スペースキーを押すたびに自分のクローンを作ってタマを増やすよ"
                        description="blockShooting Advanced Step: insert clone code"
                        id="gui.howtos.block-shooting-advanced.step.clone"
                    />
                ),
                image: 'blockShootingAdvClone',
                code: CLONE_CODE,
                codeType: 'blocks',
                animationTarget: 'insertCodeButton',
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="{greenFlag}を押して、スペースキーを連打してみよう。タマがどんどん増えるよ！"
                        description="blockShooting Advanced Step: run"
                        id="gui.howtos.block-shooting-advanced.step.run"
                        values={{greenFlag: <GreenFlagIcon />}}
                    />
                ),
                image: 'blockShootingRun',
                animationTarget: 'nextButton',
            },
            bookAdvancedClosingStep(CHAPTER, 'blockShootingAdvClosing'),
        ],
        urlId: 'blockShootingAdvanced',
    },
};

export default decks;
