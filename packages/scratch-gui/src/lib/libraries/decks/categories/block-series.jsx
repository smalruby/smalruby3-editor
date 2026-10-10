// Deck definitions for the blockBasics/blockGames tutorial categories
// (Phase 3, issue #680). This module owns the Block-axis book-excerpt decks
// so they can be developed without touching index.jsx or the other tutorial
// categories (issue #932).
//
// blockBasics 第1章「ネコからにげるゲーム」 (issue #957). The chapter has a
// basic 3-deck ladder (Lv0 code-insert / Lv2 build-blocks / Lv3 Ruby) plus a
// single "発展" demo deck (Lv0 only). Every deck opens with the book's
// bibliographic info and closes with a purchase link; those shared steps come
// from book-promo.jsx (issue #956). Source snippets:
// docs/tutorial/book-kirakira-ruby-source.md 第1章.
import React from 'react';
import {FormattedMessage} from 'react-intl';

import libraryBlockBasicsLv0 from '../thumbnails/block-basics-lv0.png';
import libraryBlockBasicsLv2 from '../thumbnails/block-basics-lv2.png';
import libraryBlockBasicsLv3 from '../thumbnails/block-basics-lv3.png';
import libraryBlockBasicsAdvanced from '../thumbnails/block-basics-advanced.png';
import {CATEGORIES} from '../../tutorial-tags';
import GreenFlagIcon from '../green-flag-icon.jsx';
import {bookOpeningStep, bookClosingStep, bookAdvancedClosingStep} from './book-promo.jsx';

// The book chapter this series excerpts from (used by the book-promo steps).
const CHAPTER = 1;

// The completed "ネコからにげるゲーム" program. Lv0 / Lv3 / advanced all insert
// this same program; Lv2 has the user assemble the equivalent blocks by hand.
// (docs/tutorial/book-kirakira-ruby-source.md 第1章 の完成プログラム)
const FULL_PROGRAM = `when_flag_clicked do
  loop do
    point_towards("_mouse_")
    move(10)
    if touching?("_mouse_")
      say("こんにちは!", 2)
    end
  end
end`;

// Blocks surfaced in the palette while these decks are active. Kept to the
// blocks the ネコからにげるゲーム program uses so the palette stays focused.
const allowedBlocks = {
    motion: ['motion_movesteps', 'motion_pointtowards'],
    looks: ['looks_sayforsecs', 'looks_say'],
    sound: [],
    event: ['event_whenflagclicked'],
    control: ['control_forever', 'control_if'],
    sensing: ['sensing_touchingobject'],
    operators: [],
};

const decks = {
    // ─── Lv0: 完成プログラムを挿入して動かす（コード挿入体験） ───────────────
    'block-basics-lv0': {
        name: (
            <FormattedMessage
                defaultMessage="【Lv0】ネコからにげるゲームを動かそう"
                description="Name for blockBasics Lv0: run the finished cat-chase game by inserting code"
                id="gui.howtos.block-basics-lv0.name"
            />
        ),
        tags: [],
        category: CATEGORIES.blockBasics,
        img: libraryBlockBasicsLv0,
        nameMessageId: 'gui.howtos.block-basics-lv0.name',
        allowedBlocks,
        steps: [
            bookOpeningStep(CHAPTER, 'blockBasicsBookOpening'),
            {
                title: (
                    <FormattedMessage
                        defaultMessage="【Lv0】ネコからにげるゲームを作るよ。ネコがマウスのポインターを追いかけてくるよ！"
                        description="blockBasics Lv0 intro step"
                        id="gui.howtos.block-basics-lv0.intro"
                    />
                ),
                image: 'blockBasicsLv0Intro',
                startTutorial: true,
                animationTarget: 'startTutorialButton',
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="「コードを挿入」ボタンを押して、完成プログラムを入れてみよう"
                        description="blockBasics Lv0 insert-code step"
                        id="gui.howtos.block-basics-lv0.insert"
                    />
                ),
                image: 'blockBasicsLv0Insert',
                code: FULL_PROGRAM,
                codeType: 'blocks',
                animationTarget: 'insertCodeButton',
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="{greenFlag}を押すと、ネコがマウスポインターを追いかけるよ。マウスを動かしてにげよう！"
                        description="blockBasics Lv0 run step"
                        id="gui.howtos.block-basics-lv0.run"
                        values={{greenFlag: <GreenFlagIcon />}}
                    />
                ),
                image: 'blockBasicsLv0Run',
                animationTarget: 'nextButton',
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="「こんにちは!」の言葉や、「10歩動かす」の歩数を変えて、動きを変えてみよう"
                        description="blockBasics Lv0 modify step"
                        id="gui.howtos.block-basics-lv0.modify"
                    />
                ),
                image: 'blockBasicsLv0Modify',
                animationTarget: 'nextButton',
            },
            bookClosingStep(CHAPTER, 'blockBasicsBookClosing'),
        ],
        urlId: 'blockBasicsLv0',
    },

    // ─── Lv2: ブロックを自分で組み立てる ────────────────────────────────────
    'block-basics-lv2': {
        name: (
            <FormattedMessage
                defaultMessage="【Lv2】ブロックを組み立てよう"
                description="Name for blockBasics Lv2: assemble the cat-chase game with blocks"
                id="gui.howtos.block-basics-lv2.name"
            />
        ),
        tags: [],
        category: CATEGORIES.blockBasics,
        img: libraryBlockBasicsLv2,
        nameMessageId: 'gui.howtos.block-basics-lv2.name',
        allowedBlocks,
        steps: [
            bookOpeningStep(CHAPTER, 'blockBasicsBookOpening'),
            {
                title: (
                    <FormattedMessage
                        defaultMessage="【Lv2】同じゲームを、ブロックを自分で組み立てて作ってみよう"
                        description="blockBasics Lv2 intro step"
                        id="gui.howtos.block-basics-lv2.intro"
                    />
                ),
                image: 'blockBasicsLv2Intro',
                startTutorial: true,
                animationTarget: 'startTutorialButton',
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="「🏁が押されたとき」の中に「ずっと」を入れて、「マウスのポインターへ向ける」を置こう"
                        description="blockBasics Lv2 first blocks step"
                        id="gui.howtos.block-basics-lv2.block1"
                    />
                ),
                image: 'blockBasicsLv2Block1',
                animationTarget: 'nextButton',
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="「10歩動かす」を追加しよう。これでネコがマウスに向かって進むよ"
                        description="blockBasics Lv2 move block step"
                        id="gui.howtos.block-basics-lv2.block2"
                    />
                ),
                image: 'blockBasicsLv2Block2',
                animationTarget: 'nextButton',
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="「もし〈マウスのポインターに触れた〉なら」の中に「こんにちは!と2秒言う」を入れよう"
                        description="blockBasics Lv2 if-touching block step"
                        id="gui.howtos.block-basics-lv2.block3"
                    />
                ),
                image: 'blockBasicsLv2Block3',
                animationTarget: 'nextButton',
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="{greenFlag}を押して、自分で組み立てたゲームを動かそう"
                        description="blockBasics Lv2 run step"
                        id="gui.howtos.block-basics-lv2.run"
                        values={{greenFlag: <GreenFlagIcon />}}
                    />
                ),
                image: 'blockBasicsLv2Run',
                animationTarget: 'nextButton',
            },
            bookClosingStep(CHAPTER, 'blockBasicsBookClosing'),
        ],
        urlId: 'blockBasicsLv2',
    },

    // ─── Lv3: 同じゲームを Ruby で書く ──────────────────────────────────────
    'block-basics-lv3': {
        name: (
            <FormattedMessage
                defaultMessage="【Lv3】Rubyで書こう"
                description="Name for blockBasics Lv3: write the cat-chase game in Ruby"
                id="gui.howtos.block-basics-lv3.name"
            />
        ),
        tags: ['ruby'],
        category: CATEGORIES.blockBasics,
        img: libraryBlockBasicsLv3,
        nameMessageId: 'gui.howtos.block-basics-lv3.name',
        // Open the Ruby tab in Ruby (not DNCL/furigana) mode.
        setup: {
            tab: 'ruby',
            rubyMode: 'ruby',
        },
        allowedBlocks,
        steps: [
            bookOpeningStep(CHAPTER, 'blockBasicsBookOpening'),
            {
                title: (
                    <FormattedMessage
                        defaultMessage="【Lv3】同じゲームを、Rubyのプログラムで書いてみよう"
                        description="blockBasics Lv3 intro step"
                        id="gui.howtos.block-basics-lv3.intro"
                    />
                ),
                image: 'blockBasicsLv3Intro',
                startTutorial: true,
                animationTarget: 'startTutorialButton',
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="ルビー(Ruby)タブが開いていることを確認しよう"
                        description="blockBasics Lv3 ruby-tab step"
                        id="gui.howtos.block-basics-lv3.rubyTab"
                    />
                ),
                image: 'blockBasicsLv3RubyTab',
                animationTarget: 'nextButton',
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="「コードを挿入」ボタンを押して、Rubyのプログラムを入れてみよう"
                        description="blockBasics Lv3 insert-code step"
                        id="gui.howtos.block-basics-lv3.insert"
                    />
                ),
                image: 'blockBasicsLv3Insert',
                code: FULL_PROGRAM,
                animationTarget: 'insertCodeButton',
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage={'say("こんにちは!", 2) の言葉や秒数を変えて、自分だけのゲームにしよう'}
                        description="blockBasics Lv3 modify step"
                        id="gui.howtos.block-basics-lv3.modify"
                    />
                ),
                image: 'blockBasicsLv3Modify',
                animationTarget: 'nextButton',
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="{greenFlag}を押すと、Rubyで書いたゲームが動くよ"
                        description="blockBasics Lv3 run step"
                        id="gui.howtos.block-basics-lv3.run"
                        values={{greenFlag: <GreenFlagIcon />}}
                    />
                ),
                image: 'blockBasicsLv3Run',
                animationTarget: 'nextButton',
            },
            bookClosingStep(CHAPTER, 'blockBasicsBookClosing'),
        ],
        urlId: 'blockBasicsLv3',
    },

    // ─── 発展: 完成デモを動かして見せるだけ（Lv0 相当） ─────────────────────
    'block-basics-advanced': {
        name: (
            <FormattedMessage
                defaultMessage="【発展】完成デモを動かそう"
                description="Name for blockBasics advanced: run the finished demo only"
                id="gui.howtos.block-basics-advanced.name"
            />
        ),
        tags: [],
        category: CATEGORIES.blockBasics,
        img: libraryBlockBasicsAdvanced,
        nameMessageId: 'gui.howtos.block-basics-advanced.name',
        allowedBlocks,
        steps: [
            bookOpeningStep(CHAPTER, 'blockBasicsBookOpening'),
            {
                title: (
                    <FormattedMessage
                        defaultMessage="【発展】本書 第1章では、このあとゲームをもっと楽しくしていきます。ここでは完成デモを動かして見てみよう"
                        description="blockBasics advanced intro step"
                        id="gui.howtos.block-basics-advanced.intro"
                    />
                ),
                image: 'blockBasicsAdvIntro',
                startTutorial: true,
                animationTarget: 'startTutorialButton',
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="「コードを挿入」ボタンで、完成した「ネコからにげるゲーム」を入れよう"
                        description="blockBasics advanced insert-code step"
                        id="gui.howtos.block-basics-advanced.insert"
                    />
                ),
                image: 'blockBasicsAdvInsert',
                code: FULL_PROGRAM,
                codeType: 'blocks',
                animationTarget: 'insertCodeButton',
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="{greenFlag}を押して、完成デモを動かそう。マウスを動かしてネコからにげよう！"
                        description="blockBasics advanced run step"
                        id="gui.howtos.block-basics-advanced.run"
                        values={{greenFlag: <GreenFlagIcon />}}
                    />
                ),
                image: 'blockBasicsAdvRun',
                animationTarget: 'nextButton',
            },
            bookAdvancedClosingStep(CHAPTER, 'blockBasicsBookAdvancedClosing'),
        ],
        urlId: 'blockBasicsAdvanced',
    },
};

export default decks;
