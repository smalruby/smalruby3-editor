import React from 'react';
import {FormattedMessage} from 'react-intl';

// Tutorial thumbnails: Avoid using any text that would need to be
// translated in thumbnails.
// Intro
import libraryIntro from './thumbnails/getting-started.jpg';
// Chat App tutorials
import libraryChat1Basic1 from './thumbnails/chat-1-basic-1.jpg';
import libraryChat2Sprites1 from './thumbnails/chat-2-sprites-1.jpg';
// Chat Tutorial 3 Mesh 1: メッシュ拡張機能でつながろう
import libraryChat3Mesh1 from './thumbnails/mesh-tutorial-3.jpg';
import libraryChat3Mesh1ExternalKairyudo from './thumbnails/chat3-mesh1-external-kairyudo.png';
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
                    'chat-3-mesh-1'
                ]
            }
        ],
        urlId: 'chat2Sprites1'
    },

    // ─── Chat Tutorial 3 Mesh 1: メッシュ拡張機能でつながろう ───────────────
    'chat-3-mesh-1': {
        name: (
            <FormattedMessage
                defaultMessage="メッシュ拡張機能でつながろう"
                description="Name for Chat Tutorial 3 Mesh 1"
                id="gui.howtos.chat-3-mesh-1.name"
            />
        ),
        tags: ['ruby', 'mesh'],
        category: CATEGORIES.chatApp,
        img: libraryChat3Mesh1,
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
                animationTarget: 'nextButton'
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
                externalResources: {
                    kairyudo: {
                        url: 'https://app3.pasoken.or.jp/practical_example/example_1/',
                        img: libraryChat3Mesh1ExternalKairyudo,
                        name: (
                            <FormattedMessage
                                defaultMessage="開隆堂 やってみよう！プログラミング「チャットアプリを制作しよう」"
                                description="External resource: Kairyudo chat app programming"
                                id="gui.howtos.chat-3-mesh-1.external.kairyudo.name"
                            />
                        )
                    }
                }
            }
        ],
        urlId: 'chat3Mesh1'
    }
};

export default decks;
