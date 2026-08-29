// Deck definitions for the dnclBasics/dnclAlgorithms tutorial categories
// (Phase 4, issue #681). Split per category so concurrent tutorial work
// doesn't collide on index.jsx or the central locale files (issue #932).
//
// These decks run in DNCL mode (`setup.rubyMode: 'dncl'`), so the editor shows
// the inserted snippet as Japanese pseudo-code. The `code` field itself is
// still Ruby — the card dispatches it as Ruby source and ruby-tab renders it
// through `rubyToDncl` — which is why every call is written in the
// parenthesized form (`puts("...")`, not `puts "..."`): only that form is
// recognized by the Ruby → DNCL converter and shown as `表示する(...)`.
import React from 'react';
import {FormattedMessage} from 'react-intl';

import libraryDnclBasics1Display from '../thumbnails/dncl-basics-1-display.jpg';
import libraryDnclBasics2Variables from '../thumbnails/dncl-basics-2-variables.jpg';
import libraryDnclBasics3Conditionals from '../thumbnails/dncl-basics-3-conditionals.jpg';
import {CATEGORIES} from '../../tutorial-tags';
import GreenFlagIcon from '../green-flag-icon.jsx';

// Every DNCL deck opens the Ruby tab already switched to DNCL mode, so the
// learner never has to find the 日本語(DNCL) toggle first — see
// docs/tutorial/improvement-plan.md "チュートリアル起動時の環境セットアップ".
const DNCL_SETUP = {
    tab: 'ruby',
    rubyMode: 'dncl'
};

// DNCL programs only need "say" (表示する) and the green-flag hat; keeping the
// palette this small matches the DNCL block filter the editor applies in DNCL
// mode.
const DNCL_ALLOWED_BLOCKS = {
    motion: [],
    looks: ['looks_sayforsecs', 'looks_say'],
    sound: [],
    event: ['event_whenflagclicked'],
    control: ['control_if', 'control_if_else'],
    sensing: [],
    operators: []
};

const decks = {
    // ─── DNCL Basics 1: 文字や数字を表示しよう ──────────────────────────────
    'dncl-basics-1-display': {
        name: (
            <FormattedMessage
                defaultMessage="文字や数字を表示しよう"
                description="Name for DNCL Basics 1: display text and numbers with 表示する"
                id="gui.howtos.dncl-basics-1-display.name"
            />
        ),
        tags: ['dncl'],
        category: CATEGORIES.dnclBasics,
        img: libraryDnclBasics1Display,
        nameMessageId: 'gui.howtos.dncl-basics-1-display.name',
        setup: DNCL_SETUP,
        allowedBlocks: DNCL_ALLOWED_BLOCKS,
        steps: [
            {
                title: (
                    <FormattedMessage
                        defaultMessage="日本語のプログラム（DNCL）を書いてみよう！"
                        description="DNCL Basics 1 Step 1: intro to DNCL mode"
                        id="gui.howtos.dncl-basics-1-display.step1.title"
                    />
                ),
                image: 'dnclBasics1Step1',
                startTutorial: true,
                animationTarget: 'startTutorialButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="まずは「表示する(&quot;こんにちは&quot;)」を実行してみよう"
                        description="DNCL Basics 1 Step 2: insert the first 表示する call"
                        id="gui.howtos.dncl-basics-1-display.step2.title"
                    />
                ),
                image: 'dnclBasics1Step2',
                code: `when_flag_clicked do
  puts("こんにちは")
end`,
                animationTarget: 'insertCodeButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="{greenFlag}を押すと、ネコが「こんにちは」としゃべるよ"
                        description="DNCL Basics 1 Step 3: run the program"
                        id="gui.howtos.dncl-basics-1-display.step3.title"
                        values={{greenFlag: <GreenFlagIcon />}}
                    />
                ),
                image: 'dnclBasics1Step3',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="計算の答えや、文字と数字を並べて表示してみよう"
                        description="DNCL Basics 1 Step 4: display a calculation and multiple values"
                        id="gui.howtos.dncl-basics-1-display.step4.title"
                    />
                ),
                image: 'dnclBasics1Step4',
                code: `when_flag_clicked do
  puts("こんにちは")
  puts(2 + 6)
  puts("こたえは" + (2 + 6).to_s + "です")
end`,
                animationTarget: 'insertCodeButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="ことばや数字を好きなものに変えて、自分だけの表示をつくろう"
                        description="DNCL Basics 1 Step 5: modify the displayed values"
                        id="gui.howtos.dncl-basics-1-display.step5.title"
                    />
                ),
                image: 'dnclBasics1Step5',
                code: `when_flag_clicked do
  puts("すきなことば")
  puts(12 * 8)
end`,
                animationTarget: 'insertCodeButton'
            }
        ],
        urlId: 'dnclBasics1Display'
    },

    // ─── DNCL Basics 2: 変数を使おう ────────────────────────────────────────
    'dncl-basics-2-variables': {
        name: (
            <FormattedMessage
                defaultMessage="変数を使おう"
                description="Name for DNCL Basics 2: use variables in DNCL"
                id="gui.howtos.dncl-basics-2-variables.name"
            />
        ),
        tags: ['dncl'],
        category: CATEGORIES.dnclBasics,
        img: libraryDnclBasics2Variables,
        nameMessageId: 'gui.howtos.dncl-basics-2-variables.name',
        setup: DNCL_SETUP,
        allowedBlocks: DNCL_ALLOWED_BLOCKS,
        steps: [
            {
                title: (
                    <FormattedMessage
                        defaultMessage="変数に値を入れて使ってみよう！"
                        description="DNCL Basics 2 Step 1: intro to variables"
                        id="gui.howtos.dncl-basics-2-variables.step1.title"
                    />
                ),
                image: 'dnclBasics2Step1',
                startTutorial: true,
                animationTarget: 'startTutorialButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="「tensuu = 80」で変数に値を入れて、表示してみよう"
                        description="DNCL Basics 2 Step 2: assign a value and display it"
                        id="gui.howtos.dncl-basics-2-variables.step2.title"
                    />
                ),
                image: 'dnclBasics2Step2',
                code: `when_flag_clicked do
  @tensuu = 80
  puts(@tensuu)
end`,
                animationTarget: 'insertCodeButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="{greenFlag}を押すと、ネコが「80」としゃべるよ（「tensuu ← 80」と書いてもいいよ）"
                        description="DNCL Basics 2 Step 3: run the program, arrow assignment also works"
                        id="gui.howtos.dncl-basics-2-variables.step3.title"
                        values={{greenFlag: <GreenFlagIcon />}}
                    />
                ),
                image: 'dnclBasics2Step3',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="変数の値を計算で増やして、文にまぜて表示してみよう"
                        description="DNCL Basics 2 Step 4: update a variable and interpolate it"
                        id="gui.howtos.dncl-basics-2-variables.step4.title"
                    />
                ),
                image: 'dnclBasics2Step4',
                code: `when_flag_clicked do
  @tensuu = 80
  @tensuu = @tensuu + 15
  puts("てんすうは" + @tensuu.to_s + "てんです")
end`,
                animationTarget: 'insertCodeButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="変数の名前や値を変えて、自分だけの計算をしてみよう"
                        description="DNCL Basics 2 Step 5: modify the variable name and value"
                        id="gui.howtos.dncl-basics-2-variables.step5.title"
                    />
                ),
                image: 'dnclBasics2Step5',
                code: `when_flag_clicked do
  @nedan = 120
  @kosuu = 3
  puts("ごうけいは" + (@nedan * @kosuu).to_s + "えんです")
end`,
                animationTarget: 'insertCodeButton'
            }
        ],
        urlId: 'dnclBasics2Variables'
    },

    // ─── DNCL Basics 3: もし〜ならば ────────────────────────────────────────
    'dncl-basics-3-conditionals': {
        name: (
            <FormattedMessage
                defaultMessage="もし〜ならば で分けよう"
                description="Name for DNCL Basics 3: conditionals in DNCL"
                id="gui.howtos.dncl-basics-3-conditionals.name"
            />
        ),
        tags: ['dncl'],
        category: CATEGORIES.dnclBasics,
        img: libraryDnclBasics3Conditionals,
        nameMessageId: 'gui.howtos.dncl-basics-3-conditionals.name',
        setup: DNCL_SETUP,
        allowedBlocks: DNCL_ALLOWED_BLOCKS,
        steps: [
            {
                title: (
                    <FormattedMessage
                        defaultMessage="「もし〜ならば」で処理を分けてみよう！"
                        description="DNCL Basics 3 Step 1: intro to conditionals"
                        id="gui.howtos.dncl-basics-3-conditionals.step1.title"
                    />
                ),
                image: 'dnclBasics3Step1',
                startTutorial: true,
                animationTarget: 'startTutorialButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="「もし tensuu >= 60 ならば」で合格だけ表示してみよう"
                        description="DNCL Basics 3 Step 2: a single if branch"
                        id="gui.howtos.dncl-basics-3-conditionals.step2.title"
                    />
                ),
                image: 'dnclBasics3Step2',
                code: `when_flag_clicked do
  @tensuu = 80
  if @tensuu >= 60
    puts("ごうかく")
  end
end`,
                animationTarget: 'insertCodeButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="{greenFlag}を押すと、80点は60点以上なので「ごうかく」としゃべるよ"
                        description="DNCL Basics 3 Step 3: run the program"
                        id="gui.howtos.dncl-basics-3-conditionals.step3.title"
                        values={{greenFlag: <GreenFlagIcon />}}
                    />
                ),
                image: 'dnclBasics3Step3',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="「そうでなければ」を足して、合格と不合格を出し分けよう"
                        description="DNCL Basics 3 Step 4: add the else branch"
                        id="gui.howtos.dncl-basics-3-conditionals.step4.title"
                    />
                ),
                image: 'dnclBasics3Step4',
                code: `when_flag_clicked do
  @tensuu = 45
  if @tensuu >= 60
    puts("ごうかく")
  else
    puts("ふごうかく")
  end
end`,
                animationTarget: 'insertCodeButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="「そうでなくもし〜ならば」を足すと、3つ以上に分けられるよ"
                        description="DNCL Basics 3 Step 5: add an elsif branch"
                        id="gui.howtos.dncl-basics-3-conditionals.step5.title"
                    />
                ),
                image: 'dnclBasics3Step5',
                code: `when_flag_clicked do
  @tensuu = 95
  if @tensuu >= 90
    puts("たいへんよくできました")
  elsif @tensuu >= 60
    puts("ごうかく")
  else
    puts("ふごうかく")
  end
end`,
                animationTarget: 'insertCodeButton'
            }
        ],
        urlId: 'dnclBasics3Conditionals'
    }
};

export default decks;
