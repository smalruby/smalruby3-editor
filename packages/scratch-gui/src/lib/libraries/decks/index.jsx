import React from 'react';
import {FormattedMessage} from 'react-intl';

// Tutorial thumbnails: Avoid using any text that would need to be
// translated in thumbnails.
// Intro
import libraryIntro from './thumbnails/getting-started.jpg';
// Chat App tutorials
import libraryChat1Basic1 from './thumbnails/chat-1-basic-1.jpg';
import libraryChat2Sprites1 from './thumbnails/chat-2-sprites-1.jpg';
// Mesh tutorials (to be migrated)
import libraryMesh3 from './thumbnails/mesh-tutorial-3.jpg';
import {CATEGORIES} from '../tutorial-tags';

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
                animationTarget: 'nextButton'
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
        tags: ['ruby', 'mesh'],
        category: CATEGORIES.chatApp,
        img: libraryChat1Basic1,
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
                animationTarget: 'nextButton'
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
                    'chat-2-sprites-1'
                ]
            }
        ],
        urlId: 'chat1Basic1'
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
        tags: ['ruby', 'mesh'],
        category: CATEGORIES.chatApp,
        img: libraryChat2Sprites1,
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
                animationTarget: 'nextButton'
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
                    'mesh-tutorial-3'
                ]
            }
        ],
        urlId: 'chat2Sprites1'
    },

    // ─── Mesh Tutorial 3: 2台のパソコンでつながろう ──────────────────────────
    'mesh-tutorial-3': {
        name: (
            <FormattedMessage
                defaultMessage="2台のパソコンでつながろう"
                description="Name for the Mesh Tutorial 3"
                id="gui.howtos.mesh-tutorial-3.name"
            />
        ),
        tags: ['ruby', 'mesh'],
        category: CATEGORIES.chatApp,
        img: libraryMesh3,
        steps: [
            {
                title: (
                    <FormattedMessage
                        defaultMessage="ネットワークで別々のパソコンとつながろう"
                        description="Mesh3 Step 1: Network intro"
                        id="gui.howtos.mesh-tutorial-3.step1.title"
                    />
                ),
                image: 'mesh3Step1',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="Mesh拡張機能を追加しよう"
                        description="Mesh3 Step 2: Add Mesh extension"
                        id="gui.howtos.mesh-tutorial-3.step2.title"
                    />
                ),
                image: 'mesh3Step2',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="PC1はホストになろう"
                        description="Mesh3 Step 3: PC1 becomes host"
                        id="gui.howtos.mesh-tutorial-3.step3.title"
                    />
                ),
                image: 'mesh3Step3',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="PC2はメッシュに参加しよう"
                        description="Mesh3 Step 4: PC2 joins mesh"
                        id="gui.howtos.mesh-tutorial-3.step4.title"
                    />
                ),
                image: 'mesh3Step4',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="変数とメッセージがネットワークで共有される"
                        description="Mesh3 Step 5: Variables and messages are shared"
                        id="gui.howtos.mesh-tutorial-3.step5.title"
                    />
                ),
                image: 'mesh3Step5',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="PC1（送る側）のプログラムを確認しよう"
                        description="Mesh3 Step 6: PC1 sender program"
                        id="gui.howtos.mesh-tutorial-3.step6.title"
                    />
                ),
                image: 'mesh3Step6',
                code: `when_flag_clicked do
  show_variable("$送信メッセージ")
  $送信メッセージ = "こんにちは！元気ですか？"
  say("送信中...", 1)
  broadcast("メッセージが来た")
end`,
                codeType: 'blocks',
                animationTarget: 'insertCodeButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="PC2（受け取る側）のプログラムを書こう"
                        description="Mesh3 Step 7: PC2 receiver program"
                        id="gui.howtos.mesh-tutorial-3.step7.title"
                    />
                ),
                image: 'mesh3Step7',
                code: `when_receive("メッセージが来た") do
  show_variable("@受信メッセージ")
  @受信メッセージ = mesh.sensor_value("送信メッセージ")
  say(@受信メッセージ)
end`,
                codeType: 'blocks',
                animationTarget: 'insertCodeButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="2台で実行してみよう"
                        description="Mesh3 Step 8: Run on 2 PCs"
                        id="gui.howtos.mesh-tutorial-3.step8.title"
                    />
                ),
                image: 'mesh3Step8',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="まとめ＆次のステップ"
                        description="Mesh3 Step 9: Summary and next steps"
                        id="gui.howtos.mesh-tutorial-3.step9.title"
                    />
                ),
                image: 'mesh3Step9',
                animationTarget: 'nextButton'
            },
            {
                deckIds: [
                    'chat-1-basic-1',
                    'chat-2-sprites-1'
                ]
            }
        ],
        urlId: 'meshTutorial3'
    }
};

export default decks;
