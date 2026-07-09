import React from 'react';
import {FormattedMessage} from 'react-intl';

// Tutorial thumbnails: Avoid using any text that would need to be
// translated in thumbnails.
// Intro
import libraryIntro from './thumbnails/getting-started.jpg';
// Chat App tutorials
import libraryChat1Basic1 from './thumbnails/chat-1-basic-1.jpg';
import libraryChat1Basic2 from './thumbnails/chat-1-basic-2.jpg';
import libraryChat1Basic3 from './thumbnails/chat-1-basic-3.jpg';
import libraryChat2Sprites1 from './thumbnails/chat-2-sprites-1.jpg';
import libraryChat2Sprites2 from './thumbnails/chat-2-sprites-2.jpg';
import libraryChat2Sprites3 from './thumbnails/chat-2-sprites-3.jpg';
// Chat Tutorial 3 Mesh 1: メッシュでつながろう
import libraryChat3Mesh1 from './thumbnails/chat-3-mesh-1.jpg';
import libraryChat3Mesh2 from './thumbnails/chat-3-mesh-2.jpg';
import libraryChat3Mesh3 from './thumbnails/chat-3-mesh-3.jpg';
import libraryChat3Mesh1ExternalKairyudo from './thumbnails/chat3-mesh1-external-kairyudo.png';
// Ruby Basics 1: 計算してみよう
import libraryRubyBasics1Numbers from './thumbnails/ruby-basics-1-numbers.jpg';
import libraryRubyBasics1TryRuby from './thumbnails/ruby-basics-1-tryruby.png';
// Ruby Basics 2: 文字列で遊ぼう
import libraryRubyBasics2Strings from './thumbnails/ruby-basics-2-strings.jpg';
// Ruby Basics 3: 変数を使ってみよう
import libraryRubyBasics3Variables from './thumbnails/ruby-basics-3-variables.jpg';
import {CATEGORIES} from '../tutorial-tags';

// Green flag icon for inline use in tutorial step titles
import greenFlagIcon from '../../../components/green-flag/icon--green-flag.svg';

const GreenFlagIcon = () => (
    <img
        src={greenFlagIcon}
        style={{
            display: 'inline-block',
            height: '1.2em',
            verticalAlign: 'middle',
            margin: '0 0.1em'
        }}
    />
);

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

    // ─── Chat App Tutorial 1-Basic-1: メッセージを送ってみよう（コード入力版） ──
    'chat-1-basic-1': {
        name: (
            <FormattedMessage
                defaultMessage="メッセージを送ってみよう！"
                description="Name for Chat Tutorial 1 Basic 1: send a message by inserting code"
                id="gui.howtos.chat-1-basic-1.name"
            />
        ),
        tags: ['mesh'],
        category: CATEGORIES.meshStep1,
        img: libraryChat1Basic1,
        nameMessageId: 'gui.howtos.chat-1-basic-1.name',
        allowedBlocks: {
            motion: [],
            looks: ['looks_sayforsecs', 'looks_say'],
            sound: [],
            event: ['event_whenflagclicked', 'event_whenbroadcastreceived', 'event_broadcast'],
            control: [],
            sensing: [],
            operators: []
        },
        steps: [
            {
                title: (
                    <FormattedMessage
                        defaultMessage="離れたブロックにメッセージを送ってみよう！"
                        description="Chat1 Basic1 Step 1: Intro - send message to remote block"
                        id="gui.howtos.chat-1-basic-1.step1.title"
                    />
                ),
                image: 'chat1Basic1Step1',
                startTutorial: true,
                animationTarget: 'startTutorialButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="まずはコードを入力してプログラムを実行してみよう"
                        description="Chat1 Basic1 Step 2: Insert code and run"
                        id="gui.howtos.chat-1-basic-1.step2.title"
                    />
                ),
                image: 'chat1Basic1Step2',
                code: `when_flag_clicked do
  say("送信中...", 1)
  broadcast("メッセージが来た")
end

when_receive("メッセージが来た") do
  say("こんにちは！元気ですか？")
end`,
                codeType: 'blocks',
                animationTarget: 'insertCodeButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="「◯◯を送る」は離れたところにある命令を実行できる"
                        description="Chat1 Basic1 Step 3: broadcast block explanation"
                        id="gui.howtos.chat-1-basic-1.step3.title"
                    />
                ),
                image: 'chat1Basic1Step3',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="「送信中...」って本当かな？きちんと送るようにするよ"
                        description="Chat1 Basic1 Step 4: Use variable for message content"
                        id="gui.howtos.chat-1-basic-1.step4.title"
                    />
                ),
                image: 'chat1Basic1Step4',
                code: `when_flag_clicked do
  $送信メッセージ = "こんにちは！元気ですか？"
  say("送信中...", 1)
  broadcast("メッセージが来た")
end

when_receive("メッセージが来た") do
  say($送信メッセージ)
end`,
                codeType: 'blocks',
                animationTarget: 'insertCodeButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="変数「送信メッセージ」の作り方"
                        description="Chat1 Basic1 Step 5: How to create a variable"
                        id="gui.howtos.chat-1-basic-1.step5.title"
                    />
                ),
                image: 'chat1Basic1Step5',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="大事なこと『変数を◯◯にする、◯◯を送る、〇〇を受け取ったとき』"
                        description="Chat1 Basic1 Step 6: Key concepts recap"
                        id="gui.howtos.chat-1-basic-1.step6.title"
                    />
                ),
                image: 'chat1Basic1Step6',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="しゃべる内容を変えてみよう"
                        description="Chat1 Basic1 Step 7: Customize the message"
                        id="gui.howtos.chat-1-basic-1.step7.title"
                    />
                ),
                image: 'chat1Basic1Step7',
                animationTarget: 'nextButton'
            },
            {
                deckIds: [
                    'chat-1-basic-2',
                    'chat-2-sprites-1'
                ]
            }
        ],
        urlId: 'chat1Basic1'
    },

    // ─── Chat App Tutorial 1-Basic-2: ブロックを自分で組み立ててみよう ──
    'chat-1-basic-2': {
        name: (
            <FormattedMessage
                defaultMessage="メッセージを送ってみよう！Lv2"
                description="Name for Chat Tutorial 1 Basic 2: build blocks manually"
                id="gui.howtos.chat-1-basic-2.name"
            />
        ),
        tags: ['mesh'],
        category: CATEGORIES.meshStep1,
        img: libraryChat1Basic2,
        nameMessageId: 'gui.howtos.chat-1-basic-2.name',
        allowedBlocks: {
            motion: [],
            looks: ['looks_sayforsecs', 'looks_say'],
            sound: [],
            event: ['event_whenflagclicked', 'event_whenbroadcastreceived', 'event_broadcast'],
            control: [],
            sensing: [],
            operators: []
        },
        steps: [
            {
                title: (
                    <FormattedMessage
                        defaultMessage="今度はブロックを自分で組み立ててみよう！"
                        description="Chat1 Basic2 Step 1: Intro - build blocks manually"
                        id="gui.howtos.chat-1-basic-2.step1.title"
                    />
                ),
                image: 'chat1Basic2Step1',
                startTutorial: true,
                animationTarget: 'startTutorialButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="変数「送信メッセージ」を作り、「{greenFlag}が押されたとき」と「送信メッセージを◯◯にする」を配置しよう"
                        description="Chat1 Basic2 Step 2: Create variable and place flag + set blocks"
                        id="gui.howtos.chat-1-basic-2.step2.title"
                        values={{greenFlag: <GreenFlagIcon />}}
                    />
                ),
                image: 'chat1Basic2Step2',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="「◯◯と◯秒言う」を追加して「送信中...」と入力しよう"
                        description="Chat1 Basic2 Step 3: Add say-for-secs block"
                        id="gui.howtos.chat-1-basic-2.step3.title"
                    />
                ),
                image: 'chat1Basic2Step3',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="★「◯◯を送る」を追加しよう — 離れたブロックを実行できるよ"
                        description="Chat1 Basic2 Step 4: Add broadcast block - key concept"
                        id="gui.howtos.chat-1-basic-2.step4.title"
                    />
                ),
                image: 'chat1Basic2Step4',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="★「◯◯を受け取ったとき」を新しく配置しよう — 送ったメッセージを受け取るよ"
                        description="Chat1 Basic2 Step 5: Place when-receive block - key concept"
                        id="gui.howtos.chat-1-basic-2.step5.title"
                    />
                ),
                image: 'chat1Basic2Step5',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="★「◯◯と言う」に「送信メッセージ」変数をはめよう — 変数で値を渡すよ"
                        description="Chat1 Basic2 Step 6: Insert variable into say block - key concept"
                        id="gui.howtos.chat-1-basic-2.step6.title"
                    />
                ),
                image: 'chat1Basic2Step6',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="{greenFlag}を押して実行！しゃべる内容も変えてみよう"
                        description="Chat1 Basic2 Step 7: Run and customize"
                        id="gui.howtos.chat-1-basic-2.step7.title"
                        values={{greenFlag: <GreenFlagIcon />}}
                    />
                ),
                image: 'chat1Basic2Step7',
                animationTarget: 'nextButton'
            },
            {
                deckIds: [
                    'chat-1-basic-3',
                    'chat-2-sprites-1'
                ]
            }
        ],
        urlId: 'chat1Basic2'
    },

    // ─── Chat App Tutorial 1-Basic-3: Rubyで同じプログラムを作ろう ──
    'chat-1-basic-3': {
        name: (
            <FormattedMessage
                defaultMessage="メッセージを送ってみよう！Lv3"
                description="Name for Chat Tutorial 1 Basic 3: build with Ruby"
                id="gui.howtos.chat-1-basic-3.name"
            />
        ),
        tags: ['mesh'],
        category: CATEGORIES.meshStep1,
        img: libraryChat1Basic3,
        nameMessageId: 'gui.howtos.chat-1-basic-3.name',
        allowedBlocks: {
            motion: [],
            looks: ['looks_sayforsecs', 'looks_say'],
            sound: [],
            event: ['event_whenflagclicked', 'event_whenbroadcastreceived', 'event_broadcast'],
            control: [],
            sensing: [],
            operators: []
        },
        steps: [
            {
                title: (
                    <FormattedMessage
                        defaultMessage="今度はRubyで同じプログラムを作ろう！"
                        description="Chat1 Basic3 Step 1: Intro - build with Ruby"
                        id="gui.howtos.chat-1-basic-3.step1.title"
                    />
                ),
                image: 'chat1Basic3Step1',
                startTutorial: true,
                animationTarget: 'startTutorialButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="ルビータブに切り替えよう"
                        description="Chat1 Basic3 Step 2: Switch to Ruby tab"
                        id="gui.howtos.chat-1-basic-3.step2.title"
                    />
                ),
                image: 'chat1Basic3Step2',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="「ルビーを入力する」を押して、お手本を入力しよう"
                        description="Chat1 Basic3 Step 3: Insert base code"
                        id="gui.howtos.chat-1-basic-3.step3.title"
                    />
                ),
                image: 'chat1Basic3Step3',
                code: `when_flag_clicked do
  say("送信中...", 1)
  broadcast("メッセージが来た")
end

when_receive("メッセージが来た") do
  say("ここを変えるよ")
end`,
                animationTarget: 'insertCodeButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="★ 2行目に $送信メッセージ = &quot;こんにちは！元気ですか？&quot; を入力しよう — $で始まる変数は全体で使えるよ"
                        description="Chat1 Basic3 Step 4: Type variable assignment - key concept"
                        id="gui.howtos.chat-1-basic-3.step4.title"
                    />
                ),
                image: 'chat1Basic3Step4',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="★ say(&quot;ここを変えるよ&quot;) を say($送信メッセージ) に変えよう — 変数で値を渡すよ"
                        description="Chat1 Basic3 Step 5: Change say to use variable - key concept"
                        id="gui.howtos.chat-1-basic-3.step5.title"
                    />
                ),
                image: 'chat1Basic3Step5',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="{greenFlag}を押して実行しよう！"
                        description="Chat1 Basic3 Step 6: Run the program"
                        id="gui.howtos.chat-1-basic-3.step6.title"
                        values={{greenFlag: <GreenFlagIcon />}}
                    />
                ),
                image: 'chat1Basic3Step6',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="大事なこと：Rubyでも「送る」「受け取ったとき」「変数」は同じ考え方"
                        description="Chat1 Basic3 Step 7: Key concepts - same in Ruby"
                        id="gui.howtos.chat-1-basic-3.step7.title"
                    />
                ),
                image: 'chat1Basic3Step7',
                animationTarget: 'nextButton'
            },
            {
                deckIds: [
                    'chat-2-sprites-1'
                ]
            }
        ],
        urlId: 'chat1Basic3'
    },

    // ─── Chat Tutorial 2 Sprites 1: ネコとペンギンで会話しよう ──────────────
    'chat-2-sprites-1': {
        name: (
            <FormattedMessage
                defaultMessage="ネコとペンギンで会話しよう"
                description="Name for Chat Tutorial 2 Sprites 1"
                id="gui.howtos.chat-2-sprites-1.name"
            />
        ),
        tags: ['mesh'],
        category: CATEGORIES.meshStep2,
        img: libraryChat2Sprites1,
        nameMessageId: 'gui.howtos.chat-2-sprites-1.name',
        allowedBlocks: {
            motion: [],
            looks: ['looks_sayforsecs'],
            sound: [],
            event: ['event_whenthisspriteclicked', 'event_whenbroadcastreceived', 'event_broadcast'],
            control: [],
            sensing: [],
            operators: []
        },
        steps: [
            {
                title: (
                    <FormattedMessage
                        defaultMessage="ネコとペンギンの会話"
                        description="Chat2 Sprites1 Step 1: Intro - cat and penguin conversation"
                        id="gui.howtos.chat-2-sprites-1.step1.title"
                    />
                ),
                image: 'chat2Sprites1Step1',
                startTutorial: true,
                animationTarget: 'startTutorialButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="ネコのコードを入力する"
                        description="Chat2 Sprites1 Step 2: Insert cat code"
                        id="gui.howtos.chat-2-sprites-1.step2.title"
                    />
                ),
                image: 'chat2Sprites1Step2',
                code: `when_clicked do
  $送信メッセージ = "ネコ：こんにちは"
  say("送信中...", 1)
  broadcast("ネコからのメッセージ")
end

when_receive("ペンギンからのメッセージ") do
  @受信メッセージ = $送信メッセージ
  say(@受信メッセージ, 3)
end`,
                codeType: 'blocks',
                animationTarget: 'insertCodeButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="大事なこと：変数「受信メッセージ」は「このスプライトのみ」になっています"
                        description="Chat2 Sprites1 Step 3: Instance variable is sprite-local"
                        id="gui.howtos.chat-2-sprites-1.step3.title"
                    />
                ),
                image: 'chat2Sprites1Step3',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="大事なこと：「ネコからのメッセージ」を送り、「ペンギンからのメッセージ」を受け取る"
                        description="Chat2 Sprites1 Step 4: Cat sends, receives from Penguin"
                        id="gui.howtos.chat-2-sprites-1.step4.title"
                    />
                ),
                image: 'chat2Sprites1Step4',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="ペンギンのスプライトを追加します"
                        description="Chat2 Sprites1 Step 5: Add penguin sprite"
                        id="gui.howtos.chat-2-sprites-1.step5.title"
                    />
                ),
                image: 'chat2Sprites1Step5',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="ペンギンの位置と向きを調整します"
                        description="Chat2 Sprites1 Step 6: Adjust penguin position and direction"
                        id="gui.howtos.chat-2-sprites-1.step6.title"
                    />
                ),
                image: 'chat2Sprites1Step6',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="ペンギンのコードを入力すると完成。ネコやペンギンを押してみよう！"
                        description="Chat2 Sprites1 Step 7: Insert penguin code and run"
                        id="gui.howtos.chat-2-sprites-1.step7.title"
                    />
                ),
                image: 'chat2Sprites1Step7',
                code: `when_clicked do
  $送信メッセージ = "ペンギン：こんにちは"
  say("送信中...", 1)
  broadcast("ペンギンからのメッセージ")
end

when_receive("ネコからのメッセージ") do
  @受信メッセージ = $送信メッセージ
  say(@受信メッセージ, 3)
end`,
                codeType: 'blocks',
                animationTarget: 'insertCodeButton'
            },
            {
                deckIds: [
                    'chat-2-sprites-2',
                    'chat-3-mesh-1'
                ]
            }
        ],
        urlId: 'chat2Sprites1'
    },

    // ─── Chat App Tutorial 2-Sprites-2: ブロックを自分で組み立ててみよう（2スプライト版） ──
    'chat-2-sprites-2': {
        name: (
            <FormattedMessage
                defaultMessage="ネコとペンギンで会話しよう！Lv2"
                description="Name for Chat Tutorial 2 Sprites 2: build blocks manually with two sprites"
                id="gui.howtos.chat-2-sprites-2.name"
            />
        ),
        tags: ['mesh'],
        category: CATEGORIES.meshStep2,
        img: libraryChat2Sprites2,
        nameMessageId: 'gui.howtos.chat-2-sprites-2.name',
        allowedBlocks: {
            motion: [],
            looks: ['looks_sayforsecs'],
            sound: [],
            event: ['event_whenthisspriteclicked', 'event_whenbroadcastreceived', 'event_broadcast'],
            control: [],
            sensing: [],
            operators: []
        },
        steps: [
            {
                title: (
                    <FormattedMessage
                        defaultMessage="今度はブロックを自分で組み立ててみよう！"
                        description="Chat2 Sprites2 Step 1: Intro - build blocks manually"
                        id="gui.howtos.chat-2-sprites-2.step1.title"
                    />
                ),
                image: 'chat2Sprites1Step1',
                startTutorial: true,
                animationTarget: 'startTutorialButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="ネコ：変数「送信メッセージ」を作り、「このスプライトが押されたとき」と「送信メッセージを◯◯にする」を配置しよう"
                        description="Chat2 Sprites2 Step 2: Create variable and place when-clicked + set blocks"
                        id="gui.howtos.chat-2-sprites-2.step2.title"
                    />
                ),
                image: 'chat2Sprites2Step2',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="ネコ：「◯◯と◯秒言う」と★「◯◯を送る」を追加しよう — 離れたブロックを実行できるよ"
                        description="Chat2 Sprites2 Step 3: Add say-for-secs and broadcast blocks"
                        id="gui.howtos.chat-2-sprites-2.step3.title"
                    />
                ),
                image: 'chat2Sprites2Step3',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="★ ネコ：「ペンギンからのメッセージを受け取ったとき」を配置し、変数「受信メッセージ」(このスプライトのみ)を使おう — @変数はスプライト専用だよ"
                        description="Chat2 Sprites2 Step 4: Place when-receive and use instance variable"
                        id="gui.howtos.chat-2-sprites-2.step4.title"
                    />
                ),
                image: 'chat2Sprites2Step4',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="ペンギンのスプライトを追加します"
                        description="Chat2 Sprites2 Step 5: Add penguin sprite"
                        id="gui.howtos.chat-2-sprites-2.step5.title"
                    />
                ),
                image: 'chat2Sprites1Step5',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="ペンギンの位置と向きを調整します"
                        description="Chat2 Sprites2 Step 6: Adjust penguin position and direction"
                        id="gui.howtos.chat-2-sprites-2.step6.title"
                    />
                ),
                image: 'chat2Sprites1Step6',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="★ ペンギンも同じ構造でブロックを組み立てよう — メッセージ名がネコと逆になるよ"
                        description="Chat2 Sprites2 Step 7: Build penguin blocks with reversed message names"
                        id="gui.howtos.chat-2-sprites-2.step7.title"
                    />
                ),
                image: 'chat2Sprites2Step7',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="ネコやペンギンを押して実行！しゃべる内容も変えてみよう"
                        description="Chat2 Sprites2 Step 8: Run and customize"
                        id="gui.howtos.chat-2-sprites-2.step8.title"
                    />
                ),
                image: 'chat2Sprites1Step1',
                animationTarget: 'nextButton'
            },
            {
                deckIds: [
                    'chat-2-sprites-3',
                    'chat-3-mesh-1'
                ]
            }
        ],
        urlId: 'chat2Sprites2'
    },

    // ─── Chat App Tutorial 2-Sprites-3: Rubyで同じプログラムを作ろう（2スプライト版） ──
    'chat-2-sprites-3': {
        name: (
            <FormattedMessage
                defaultMessage="ネコとペンギンで会話しよう！Lv3"
                description="Name for Chat Tutorial 2 Sprites 3: build with Ruby with two sprites"
                id="gui.howtos.chat-2-sprites-3.name"
            />
        ),
        tags: ['mesh'],
        category: CATEGORIES.meshStep2,
        img: libraryChat2Sprites3,
        nameMessageId: 'gui.howtos.chat-2-sprites-3.name',
        allowedBlocks: {
            motion: [],
            looks: ['looks_sayforsecs'],
            sound: [],
            event: ['event_whenthisspriteclicked', 'event_whenbroadcastreceived', 'event_broadcast'],
            control: [],
            sensing: [],
            operators: []
        },
        steps: [
            {
                title: (
                    <FormattedMessage
                        defaultMessage="今度はRubyで同じプログラムを作ろう！"
                        description="Chat2 Sprites3 Step 1: Intro - build with Ruby"
                        id="gui.howtos.chat-2-sprites-3.step1.title"
                    />
                ),
                image: 'chat2Sprites1Step1',
                startTutorial: true,
                animationTarget: 'startTutorialButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="ルビータブに切り替えよう"
                        description="Chat2 Sprites3 Step 2: Switch to Ruby tab"
                        id="gui.howtos.chat-2-sprites-3.step2.title"
                    />
                ),
                image: 'chat2Sprites3Step2',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="「ルビーを入力する」を押して、ネコのお手本を入力しよう"
                        description="Chat2 Sprites3 Step 3: Insert cat base code"
                        id="gui.howtos.chat-2-sprites-3.step3.title"
                    />
                ),
                image: 'chat2Sprites3Step3',
                code: `when_clicked do
  $送信メッセージ = "ネコ：こんにちは"
  say("送信中...", 1)
  broadcast("ネコからのメッセージ")
end

when_receive("ペンギンからのメッセージ") do
  @受信メッセージ = $送信メッセージ
  say("ここを変えるよ", 3)
end`,
                animationTarget: 'insertCodeButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="★ say(&quot;ここを変えるよ&quot;, 3) を say(@受信メッセージ, 3) に変えよう — @で始まる変数はこのスプライトだけで使えるよ"
                        description="Chat2 Sprites3 Step 4: Change say to use instance variable"
                        id="gui.howtos.chat-2-sprites-3.step4.title"
                    />
                ),
                image: 'chat2Sprites3Step4',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="ペンギンのスプライトを追加します"
                        description="Chat2 Sprites3 Step 5: Add penguin sprite"
                        id="gui.howtos.chat-2-sprites-3.step5.title"
                    />
                ),
                image: 'chat2Sprites1Step5',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="ペンギンの位置と向きを調整します"
                        description="Chat2 Sprites3 Step 6: Adjust penguin position and direction"
                        id="gui.howtos.chat-2-sprites-3.step6.title"
                    />
                ),
                image: 'chat2Sprites1Step6',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="ペンギンのRubyコードを「ルビーを入力する」で入力しよう — メッセージ名がネコと逆になっているよ"
                        description="Chat2 Sprites3 Step 7: Insert penguin Ruby code"
                        id="gui.howtos.chat-2-sprites-3.step7.title"
                    />
                ),
                image: 'chat2Sprites3Step7',
                code: `when_clicked do
  $送信メッセージ = "ペンギン：こんにちは"
  say("送信中...", 1)
  broadcast("ペンギンからのメッセージ")
end

when_receive("ネコからのメッセージ") do
  @受信メッセージ = $送信メッセージ
  say(@受信メッセージ, 3)
end`,
                codeType: 'blocks',
                animationTarget: 'insertCodeButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="ネコやペンギンを押して実行しよう！"
                        description="Chat2 Sprites3 Step 8: Run the program"
                        id="gui.howtos.chat-2-sprites-3.step8.title"
                    />
                ),
                image: 'chat2Sprites1Step1',
                animationTarget: 'nextButton'
            },
            {
                deckIds: [
                    'chat-3-mesh-1'
                ]
            }
        ],
        urlId: 'chat2Sprites3'
    },

    // ─── Chat Tutorial 3 Mesh 1: メッシュでつながろう ───────────────
    'chat-3-mesh-1': {
        name: (
            <FormattedMessage
                defaultMessage="メッシュでつながろう"
                description="Name for Chat Tutorial 3 Mesh 1"
                id="gui.howtos.chat-3-mesh-1.name"
            />
        ),
        tags: ['mesh'],
        category: CATEGORIES.meshStep3,
        img: libraryChat3Mesh1,
        nameMessageId: 'gui.howtos.chat-3-mesh-1.name',
        allowedBlocks: {
            motion: [],
            looks: ['looks_sayforsecs'],
            sound: [],
            event: ['event_whenthisspriteclicked', 'event_whenbroadcastreceived', 'event_broadcast'],
            control: [],
            sensing: [],
            operators: []
        },
        steps: [
            {
                title: (
                    <FormattedMessage
                        defaultMessage="メッシュ拡張機能を使って他の人のスモウルビーとつながろう"
                        description="Chat3 Mesh1 Step 1: Intro - connect via Mesh extension"
                        id="gui.howtos.chat-3-mesh-1.step1.title"
                    />
                ),
                image: 'chat3Mesh1Step1',
                startTutorial: true,
                animationTarget: 'startTutorialButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="2人以上のグループをつくってメッシュ拡張機能を選ぶ（1人でも2つのスモウルビーを使えばできる）"
                        description="Chat3 Mesh1 Step 2: Select Mesh extension"
                        id="gui.howtos.chat-3-mesh-1.step2.title"
                    />
                ),
                image: 'chat3Mesh1Step2',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="1人目はホストになる。他の人はメッシュに参加する"
                        description="Chat3 Mesh1 Step 3: Host and join"
                        id="gui.howtos.chat-3-mesh-1.step3.title"
                    />
                ),
                image: 'chat3Mesh1Step3',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="スプライトのコスチュームを変えてみよう"
                        description="Chat3 Mesh1 Step 4: Change sprite costume"
                        id="gui.howtos.chat-3-mesh-1.step4.title"
                    />
                ),
                image: 'chat3Mesh1Step4',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="ホストとそれ以外でコードが違うよ。まずはホストのコードを入力する"
                        description="Chat3 Mesh1 Step 5: Host code"
                        id="gui.howtos.chat-3-mesh-1.step5.title"
                    />
                ),
                image: 'chat3Mesh1Step5',
                code: `when_clicked do
  $送信メッセージ = "ネコ：こんにちは"
  say("送信中...", 1)
  broadcast("ネコからのメッセージ")
end

when_receive("ペンギンからのメッセージ") do
  @受信メッセージ = mesh.sensor_value("送信メッセージ")
  say(@受信メッセージ, 3)
end`,
                codeType: 'blocks',
                animationTarget: 'insertCodeButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="次にメッシュに参加した人のコードを入力する"
                        description="Chat3 Mesh1 Step 6: Member code"
                        id="gui.howtos.chat-3-mesh-1.step6.title"
                    />
                ),
                image: 'chat3Mesh1Step6',
                code: `when_clicked do
  $送信メッセージ = "ペンギン：こんにちは"
  say("送信中...", 1)
  broadcast("ペンギンからのメッセージ")
end

when_receive("ネコからのメッセージ") do
  @受信メッセージ = mesh.sensor_value("送信メッセージ")
  say(@受信メッセージ, 3)
end`,
                codeType: 'blocks',
                animationTarget: 'insertCodeButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="自分のスプライトを押してメッセージを送ってみよう"
                        description="Chat3 Mesh1 Step 7: Send message by clicking sprite"
                        id="gui.howtos.chat-3-mesh-1.step7.title"
                    />
                ),
                image: 'chat3Mesh1Step1',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="大事なこと：他の人の「送信メッセージ」は「センサーの値」で取り出せるよ"
                        description="Chat3 Mesh1 Step 8: Key concept - sensor_value"
                        id="gui.howtos.chat-3-mesh-1.step8.title"
                    />
                ),
                image: 'chat3Mesh1Step8',
                animationTarget: 'nextButton'
            },
            {
                deckIds: [
                    'chat-3-mesh-2'
                ]
            }
        ],
        urlId: 'chat3Mesh1'
    },
    'chat-3-mesh-2': {
        name: (
            <FormattedMessage
                defaultMessage="メッシュでつながろう Lv2"
                description="Name for Chat Tutorial 3 Mesh 2"
                id="gui.howtos.chat-3-mesh-2.name"
            />
        ),
        tags: ['mesh'],
        category: CATEGORIES.meshStep3,
        img: libraryChat3Mesh2,
        nameMessageId: 'gui.howtos.chat-3-mesh-2.name',
        allowedBlocks: {
            motion: [],
            looks: ['looks_sayforsecs'],
            sound: [],
            event: ['event_whenthisspriteclicked', 'event_whenbroadcastreceived', 'event_broadcast'],
            control: [],
            sensing: [],
            operators: []
        },
        steps: [
            {
                title: (
                    <FormattedMessage
                        defaultMessage="メッシュ拡張機能を使った会話プログラムを、ブロックを自分で組み立てて作ってみよう"
                        description="Chat3 Mesh2 Step 1: Intro"
                        id="gui.howtos.chat-3-mesh-2.step1.title"
                    />
                ),
                image: 'chat3Mesh1Step1',
                startTutorial: true,
                animationTarget: 'startTutorialButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="2人以上のグループをつくってメッシュ拡張機能を選ぶ"
                        description="Chat3 Mesh2 Step 2: Select Mesh extension"
                        id="gui.howtos.chat-3-mesh-2.step2.title"
                    />
                ),
                image: 'chat3Mesh1Step2',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="1人目はホストになる。他の人はメッシュに参加する"
                        description="Chat3 Mesh2 Step 3: Host and join"
                        id="gui.howtos.chat-3-mesh-2.step3.title"
                    />
                ),
                image: 'chat3Mesh1Step3',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="スプライトのコスチュームを変えてみよう"
                        description="Chat3 Mesh2 Step 4: Change sprite costume"
                        id="gui.howtos.chat-3-mesh-2.step4.title"
                    />
                ),
                image: 'chat3Mesh1Step4',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="ホスト：「このスプライトが押されたとき」に変数をセットして「送信中...」と言い、メッセージを送るブロックを作ろう"
                        description="Chat3 Mesh2 Step 5: Host clicked blocks"
                        id="gui.howtos.chat-3-mesh-2.step5.title"
                    />
                ),
                image: 'chat3Mesh2Step5',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="★ ホスト：「受け取ったとき」に「送信メッセージのセンサーの値」を使おう — 他の人の変数はセンサーの値で取り出すよ！"
                        description="Chat3 Mesh2 Step 6: Host receive blocks with sensor_value"
                        id="gui.howtos.chat-3-mesh-2.step6.title"
                    />
                ),
                image: 'chat3Mesh1Step5',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="★ メンバーも同じ構造のブロックを作ろう — メッセージの名前が逆になるよ！"
                        description="Chat3 Mesh2 Step 7: Member blocks"
                        id="gui.howtos.chat-3-mesh-2.step7.title"
                    />
                ),
                image: 'chat3Mesh1Step6',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="自分のスプライトを押して実行！他の人の「送信メッセージ」は「センサーの値」で取り出せるよ"
                        description="Chat3 Mesh2 Step 8: Run and key concept"
                        id="gui.howtos.chat-3-mesh-2.step8.title"
                    />
                ),
                image: 'chat3Mesh1Step8',
                animationTarget: 'nextButton'
            },
            {
                deckIds: [
                    'chat-3-mesh-3'
                ]
            }
        ],
        urlId: 'chat3Mesh2'
    },
    'chat-3-mesh-3': {
        name: (
            <FormattedMessage
                defaultMessage="メッシュでつながろう Lv3"
                description="Name for Chat Tutorial 3 Mesh 3"
                id="gui.howtos.chat-3-mesh-3.name"
            />
        ),
        tags: ['mesh'],
        category: CATEGORIES.meshStep3,
        img: libraryChat3Mesh3,
        nameMessageId: 'gui.howtos.chat-3-mesh-3.name',
        allowedBlocks: {
            motion: [],
            looks: ['looks_sayforsecs'],
            sound: [],
            event: ['event_whenthisspriteclicked', 'event_whenbroadcastreceived', 'event_broadcast'],
            control: [],
            sensing: [],
            operators: []
        },
        steps: [
            {
                title: (
                    <FormattedMessage
                        defaultMessage="メッシュ拡張機能を使った会話プログラムを、Rubyで作ってみよう"
                        description="Chat3 Mesh3 Step 1: Intro"
                        id="gui.howtos.chat-3-mesh-3.step1.title"
                    />
                ),
                image: 'chat3Mesh1Step1',
                startTutorial: true,
                animationTarget: 'startTutorialButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="2人以上のグループをつくってメッシュ拡張機能を選ぶ"
                        description="Chat3 Mesh3 Step 2: Select Mesh extension"
                        id="gui.howtos.chat-3-mesh-3.step2.title"
                    />
                ),
                image: 'chat3Mesh1Step2',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="1人目はホストになる。他の人はメッシュに参加する"
                        description="Chat3 Mesh3 Step 3: Host and join"
                        id="gui.howtos.chat-3-mesh-3.step3.title"
                    />
                ),
                image: 'chat3Mesh1Step3',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="スプライトのコスチュームを変えてみよう"
                        description="Chat3 Mesh3 Step 4: Change sprite costume"
                        id="gui.howtos.chat-3-mesh-3.step4.title"
                    />
                ),
                image: 'chat3Mesh1Step4',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="ルビータブに切り替えて「Rubyコードを挿入」でホストのベースコードを入力する"
                        description="Chat3 Mesh3 Step 5: Insert host base code"
                        id="gui.howtos.chat-3-mesh-3.step5.title"
                    />
                ),
                image: 'chat3Mesh3Step5',
                code: `when_clicked do
  $送信メッセージ = "ネコ：こんにちは"
  say("送信中...", 1)
  broadcast("ネコからのメッセージ")
end

when_receive("ペンギンからのメッセージ") do
  @受信メッセージ = "ここを変えるよ"
  say(@受信メッセージ, 3)
end`,
                animationTarget: 'insertCodeButton'
            },
            {
                title: (
                    <FormattedMessage
                         
                        defaultMessage={'★ @受信メッセージ = "ここを変えるよ" を @受信メッセージ = mesh.sensor_value("送信メッセージ") に変えよう — 他の人の変数はmesh.sensor_valueで取り出すよ！'}
                        description="Chat3 Mesh3 Step 6: Change to sensor_value"
                        id="gui.howtos.chat-3-mesh-3.step6.title"
                    />
                ),
                image: 'chat3Mesh3Step6',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="メンバーのコードを入力する — メッセージの名前が逆になるよ！"
                        description="Chat3 Mesh3 Step 7: Insert member code"
                        id="gui.howtos.chat-3-mesh-3.step7.title"
                    />
                ),
                image: 'chat3Mesh3Step7',
                code: `when_clicked do
  $送信メッセージ = "ペンギン：こんにちは"
  say("送信中...", 1)
  broadcast("ペンギンからのメッセージ")
end

when_receive("ネコからのメッセージ") do
  @受信メッセージ = mesh.sensor_value("送信メッセージ")
  say(@受信メッセージ, 3)
end`,
                codeType: 'blocks',
                animationTarget: 'insertCodeButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="自分のスプライトを押して実行！他の人の「送信メッセージ」は「センサーの値」で取り出せるよ"
                        description="Chat3 Mesh3 Step 8: Run and key concept"
                        id="gui.howtos.chat-3-mesh-3.step8.title"
                    />
                ),
                image: 'chat3Mesh1Step8',
                animationTarget: 'nextButton'
            },
            {
                externalResources: {
                    kairyudo: {
                        url: 'https://app3.pasoken.or.jp/practical_example/example_1/',
                        img: libraryChat3Mesh1ExternalKairyudo,
                        name: (
                            <FormattedMessage
                                defaultMessage="開隆堂 やってみよう！プログラミング「チャットアプリを制作しよう」"
                                description="External resource: Kairyudo chat app programming"
                                id="gui.howtos.chat-3-mesh-3.external.kairyudo.name"
                            />
                        )
                    }
                }
            }
        ],
        urlId: 'chat3Mesh3'
    },

    // ─── Ruby Basics 1: Rubyで計算してみよう ──────────────────────────────────
    'ruby-basics-1-numbers': {
        name: (
            <FormattedMessage
                defaultMessage="Rubyで計算してみよう"
                description="Name for Ruby Basics 1: do arithmetic with puts"
                id="gui.howtos.ruby-basics-1-numbers.name"
            />
        ),
        tags: ['ruby'],
        category: CATEGORIES.rubyBasics,
        img: libraryRubyBasics1Numbers,
        nameMessageId: 'gui.howtos.ruby-basics-1-numbers.name',
        // Auto-switch to the Ruby tab in Ruby (not DNCL/furigana) mode when
        // the user opens this tutorial — see docs/tutorial/improvement-plan.md
        // "チュートリアル起動時の環境セットアップ".
        setup: {
            tab: 'ruby',
            rubyMode: 'ruby'
        },
        allowedBlocks: {
            motion: [],
            looks: ['looks_sayforsecs', 'looks_say'],
            sound: [],
            event: ['event_whenflagclicked'],
            control: [],
            sensing: [],
            operators: []
        },
        steps: [
            {
                title: (
                    <FormattedMessage
                        defaultMessage="Rubyで計算してみよう！"
                        description="Ruby Basics 1 Step 1: Intro to arithmetic with puts"
                        id="gui.howtos.ruby-basics-1-numbers.step1.title"
                    />
                ),
                image: 'rubyBasics1Step1',
                startTutorial: true,
                animationTarget: 'startTutorialButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="まずは「puts 2 + 6」を実行してみよう"
                        description="Ruby Basics 1 Step 2: Insert first puts code"
                        id="gui.howtos.ruby-basics-1-numbers.step2.title"
                    />
                ),
                image: 'rubyBasics1Step2',
                code: `when_flag_clicked do
  puts 2 + 6
end`,
                animationTarget: 'insertCodeButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="{greenFlag}を押すと、ネコが「8」としゃべるよ"
                        description="Ruby Basics 1 Step 3: Run the program"
                        id="gui.howtos.ruby-basics-1-numbers.step3.title"
                        values={{greenFlag: <GreenFlagIcon />}}
                    />
                ),
                image: 'rubyBasics1Step3',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="他の計算も試してみよう（かけ算・わり算・ひき算）"
                        description="Ruby Basics 1 Step 4: More arithmetic operations"
                        id="gui.howtos.ruby-basics-1-numbers.step4.title"
                    />
                ),
                image: 'rubyBasics1Step4',
                code: `when_flag_clicked do
  puts 4 * 10
  puts 30 / 4
  puts 5 - 12
end`,
                animationTarget: 'insertCodeButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="数字を好きなものに変えて、自分だけの計算をしてみよう"
                        description="Ruby Basics 1 Step 5: Modify the numbers"
                        id="gui.howtos.ruby-basics-1-numbers.step5.title"
                    />
                ),
                image: 'rubyBasics1Step5',
                animationTarget: 'nextButton'
            },
            {
                externalResources: {
                    tryruby: {
                        url: 'https://try.ruby-lang.org/',
                        img: libraryRubyBasics1TryRuby,
                        name: (
                            <FormattedMessage
                                defaultMessage="外部サイト「try ruby」で詳しくRubyを学ぶ"
                                description="External resource: TryRuby online playground"
                                id="gui.howtos.ruby-basics-1-numbers.external.tryruby.name"
                            />
                        )
                    }
                }
            }
        ],
        urlId: 'rubyBasics1Numbers'
    },

    // ─── Ruby Basics 2: 文字列で遊ぼう ───────────────────────────────────────
    'ruby-basics-2-strings': {
        name: (
            <FormattedMessage
                defaultMessage="文字列（もじれつ）で遊ぼう"
                description="Name for Ruby Basics 2: play with strings using puts"
                id="gui.howtos.ruby-basics-2-strings.name"
            />
        ),
        tags: ['ruby'],
        category: CATEGORIES.rubyBasics,
        img: libraryRubyBasics2Strings,
        nameMessageId: 'gui.howtos.ruby-basics-2-strings.name',
        // Same "open the Ruby tab in Ruby mode" setup as deck 1 — see
        // docs/tutorial/improvement-plan.md "チュートリアル起動時の環境セットアップ".
        setup: {
            tab: 'ruby',
            rubyMode: 'ruby'
        },
        allowedBlocks: {
            motion: [],
            looks: ['looks_sayforsecs', 'looks_say'],
            sound: [],
            event: ['event_whenflagclicked'],
            control: [],
            sensing: [],
            operators: []
        },
        steps: [
            {
                title: (
                    <FormattedMessage
                        defaultMessage="文字列（もじれつ）で遊ぼう！"
                        description="Ruby Basics 2 Step 1: Intro to strings with puts"
                        id="gui.howtos.ruby-basics-2-strings.step1.title"
                    />
                ),
                image: 'rubyBasics2Step1',
                startTutorial: true,
                animationTarget: 'startTutorialButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="まずは「puts &quot;こんにちは&quot;」を実行してみよう"
                        description="Ruby Basics 2 Step 2: Insert first string puts code"
                        id="gui.howtos.ruby-basics-2-strings.step2.title"
                    />
                ),
                image: 'rubyBasics2Step2',
                code: `when_flag_clicked do
  puts "こんにちは"
end`,
                animationTarget: 'insertCodeButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="{greenFlag}を押すと、ネコが「こんにちは」としゃべるよ"
                        description="Ruby Basics 2 Step 3: Run the program"
                        id="gui.howtos.ruby-basics-2-strings.step3.title"
                        values={{greenFlag: <GreenFlagIcon />}}
                    />
                ),
                image: 'rubyBasics2Step3',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="文字をさかさまにしたり、大文字にしてみよう"
                        description="Ruby Basics 2 Step 4: reverse / upcase string methods"
                        id="gui.howtos.ruby-basics-2-strings.step4.title"
                    />
                ),
                image: 'rubyBasics2Step4',
                code: `when_flag_clicked do
  puts "スモウルビー".reverse
  puts "ruby".upcase
end`,
                animationTarget: 'insertCodeButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="好きな言葉に変えて、自分だけの文字列で遊ぼう"
                        description="Ruby Basics 2 Step 5: Modify the string"
                        id="gui.howtos.ruby-basics-2-strings.step5.title"
                    />
                ),
                image: 'rubyBasics2Step5',
                code: `when_flag_clicked do
  puts "すきなことば".reverse
end`,
                animationTarget: 'insertCodeButton'
            },
            {
                externalResources: {
                    tryruby: {
                        url: 'https://try.ruby-lang.org/',
                        img: libraryRubyBasics1TryRuby,
                        name: (
                            <FormattedMessage
                                defaultMessage="外部サイト「try ruby」で詳しくRubyを学ぶ"
                                description="External resource: TryRuby online playground"
                                id="gui.howtos.ruby-basics-2-strings.external.tryruby.name"
                            />
                        )
                    }
                }
            }
        ],
        urlId: 'rubyBasics2Strings'
    },

    // ─── Ruby Basics 3: 変数を使ってみよう ───────────────────────────────────
    'ruby-basics-3-variables': {
        name: (
            <FormattedMessage
                defaultMessage="変数（へんすう）を使ってみよう"
                description="Name for Ruby Basics 3: use variables with puts"
                id="gui.howtos.ruby-basics-3-variables.name"
            />
        ),
        tags: ['ruby'],
        category: CATEGORIES.rubyBasics,
        img: libraryRubyBasics3Variables,
        nameMessageId: 'gui.howtos.ruby-basics-3-variables.name',
        // Same "open the Ruby tab in Ruby mode" setup as deck 1 — see
        // docs/tutorial/improvement-plan.md "チュートリアル起動時の環境セットアップ".
        setup: {
            tab: 'ruby',
            rubyMode: 'ruby'
        },
        allowedBlocks: {
            motion: [],
            looks: ['looks_sayforsecs', 'looks_say'],
            sound: [],
            event: ['event_whenflagclicked'],
            control: [],
            sensing: [],
            operators: []
        },
        steps: [
            {
                title: (
                    <FormattedMessage
                        defaultMessage="変数（へんすう）を使ってみよう！"
                        description="Ruby Basics 3 Step 1: Intro to variables"
                        id="gui.howtos.ruby-basics-3-variables.step1.title"
                    />
                ),
                image: 'rubyBasics3Step1',
                startTutorial: true,
                animationTarget: 'startTutorialButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="「name」に名前を入れて、しゃべらせてみよう"
                        description="Ruby Basics 3 Step 2: Insert first variable code"
                        id="gui.howtos.ruby-basics-3-variables.step2.title"
                    />
                ),
                image: 'rubyBasics3Step2',
                code: `when_flag_clicked do
  name = "ネコ"
  puts name
end`,
                animationTarget: 'insertCodeButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="{greenFlag}を押すと、ネコが「ネコ」としゃべるよ"
                        description="Ruby Basics 3 Step 3: Run the program"
                        id="gui.howtos.ruby-basics-3-variables.step3.title"
                        values={{greenFlag: <GreenFlagIcon />}}
                    />
                ),
                image: 'rubyBasics3Step3',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="変数を使って、文をつくってみよう"
                        description="Ruby Basics 3 Step 4: Combine a variable into a sentence"
                        id="gui.howtos.ruby-basics-3-variables.step4.title"
                    />
                ),
                image: 'rubyBasics3Step4',
                code: `when_flag_clicked do
  name = "スモウルビー"
  puts "わたしは" + name + "です"
end`,
                animationTarget: 'insertCodeButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="変数の中身を好きな名前に変えてみよう"
                        description="Ruby Basics 3 Step 5: Modify the variable"
                        id="gui.howtos.ruby-basics-3-variables.step5.title"
                    />
                ),
                image: 'rubyBasics3Step5',
                code: `when_flag_clicked do
  name = "あなたのなまえ"
  puts name + "、こんにちは！"
end`,
                animationTarget: 'insertCodeButton'
            },
            {
                externalResources: {
                    tryruby: {
                        url: 'https://try.ruby-lang.org/',
                        img: libraryRubyBasics1TryRuby,
                        name: (
                            <FormattedMessage
                                defaultMessage="外部サイト「try ruby」で詳しくRubyを学ぶ"
                                description="External resource: TryRuby online playground"
                                id="gui.howtos.ruby-basics-3-variables.external.tryruby.name"
                            />
                        )
                    }
                }
            }
        ],
        urlId: 'rubyBasics3Variables'
    }
};

export default decks;
