import React from 'react';
import {FormattedMessage} from 'react-intl';

// Tutorial thumbnails: Avoid using any text that would need to be
// translated in thumbnails.
// Intro
import libraryIntro from './thumbnails/getting-started.jpg';
// Mesh tutorials
import libraryMesh1 from './thumbnails/mesh-tutorial-1.jpg';
import libraryMesh2 from './thumbnails/mesh-tutorial-2.jpg';
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

    // ─── Mesh Tutorial 1: メッセージを送ってみよう ───────────────────────────
    'mesh-tutorial-1': {
        name: (
            <FormattedMessage
                defaultMessage="メッセージを送ってみよう"
                description="Name for the Mesh Tutorial 1"
                id="gui.howtos.mesh-tutorial-1.name"
            />
        ),
        tags: ['ruby', 'mesh'],
        category: CATEGORIES.gettingStarted,
        img: libraryMesh1,
        steps: [
            {
                title: (
                    <FormattedMessage
                        defaultMessage="何を作るの？"
                        description="Mesh1 Step 1: What are we making?"
                        id="gui.howtos.mesh-tutorial-1.step1.title"
                    />
                ),
                image: 'mesh1Step1',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="「変数」って何だろう？"
                        description="Mesh1 Step 2: What is a variable?"
                        id="gui.howtos.mesh-tutorial-1.step2.title"
                    />
                ),
                image: 'mesh1Step2',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="メッセージを送るプログラムを書こう"
                        description="Mesh1 Step 3: Write the send program"
                        id="gui.howtos.mesh-tutorial-1.step3.title"
                    />
                ),
                image: 'mesh1Step3',
                code: `when_flag_clicked do
  $送信メッセージ = "こんにちは！元気ですか？"
  say("送信中...", 1)
  broadcast("メッセージが来た")
end`,
                animationTarget: 'insertCodeButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="メッセージを受け取るプログラムを書こう"
                        description="Mesh1 Step 4: Write the receive program"
                        id="gui.howtos.mesh-tutorial-1.step4.title"
                    />
                ),
                image: 'mesh1Step4',
                code: `when_flag_clicked do
  $送信メッセージ = "こんにちは！元気ですか？"
  say("送信中...", 1)
  broadcast("メッセージが来た")
end

when_receive("メッセージが来た") do
  @受信メッセージ = $送信メッセージ
  say(@受信メッセージ)
end`,
                animationTarget: 'insertCodeButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="実行して確認しよう"
                        description="Mesh1 Step 5: Run and check"
                        id="gui.howtos.mesh-tutorial-1.step5.title"
                    />
                ),
                image: 'mesh1Step5',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="メッセージを変えてみよう"
                        description="Mesh1 Step 6: Customize the message"
                        id="gui.howtos.mesh-tutorial-1.step6.title"
                    />
                ),
                image: 'mesh1Step6',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="まとめ"
                        description="Mesh1 Step 7: Summary"
                        id="gui.howtos.mesh-tutorial-1.step7.title"
                    />
                ),
                image: 'mesh1Step7'
            }
        ],
        urlId: 'meshTutorial1'
    },

    // ─── Mesh Tutorial 2: 2つのキャラクターで会話しよう ──────────────────────
    'mesh-tutorial-2': {
        name: (
            <FormattedMessage
                defaultMessage="2つのキャラクターで会話しよう"
                description="Name for the Mesh Tutorial 2"
                id="gui.howtos.mesh-tutorial-2.name"
            />
        ),
        tags: ['ruby', 'mesh'],
        category: CATEGORIES.gettingStarted,
        img: libraryMesh2,
        steps: [
            {
                title: (
                    <FormattedMessage
                        defaultMessage="2人で会話してみよう"
                        description="Mesh2 Step 1: Intro to 2-sprite chat"
                        id="gui.howtos.mesh-tutorial-2.step1.title"
                    />
                ),
                image: 'mesh2Step1',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="スプライトを追加しよう"
                        description="Mesh2 Step 2: Add a sprite"
                        id="gui.howtos.mesh-tutorial-2.step2.title"
                    />
                ),
                image: 'mesh2Step2',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="スプライトごとに別のプログラムがある"
                        description="Mesh2 Step 3: Each sprite has its own program"
                        id="gui.howtos.mesh-tutorial-2.step3.title"
                    />
                ),
                image: 'mesh2Step3',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="スプライトA（送る側）のプログラムを書こう"
                        description="Mesh2 Step 4: Write sprite A program"
                        id="gui.howtos.mesh-tutorial-2.step4.title"
                    />
                ),
                image: 'mesh2Step4',
                code: `when_flag_clicked do
  $送信メッセージ = "こんにちは！元気ですか？"
  say("送信中...", 1)
  broadcast("メッセージが来た")
end`,
                animationTarget: 'insertCodeButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="スプライトB（受け取る側）のプログラムを書こう"
                        description="Mesh2 Step 5: Write sprite B program"
                        id="gui.howtos.mesh-tutorial-2.step5.title"
                    />
                ),
                image: 'mesh2Step5',
                code: `when_receive("メッセージが来た") do
  @受信メッセージ = $送信メッセージ
  say(@受信メッセージ)
end`,
                animationTarget: 'insertCodeButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="実行して確認しよう"
                        description="Mesh2 Step 6: Run and check"
                        id="gui.howtos.mesh-tutorial-2.step6.title"
                    />
                ),
                image: 'mesh2Step6',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="次はネットワークでつなごう"
                        description="Mesh2 Step 7: Preview of Mesh tutorial"
                        id="gui.howtos.mesh-tutorial-2.step7.title"
                    />
                ),
                image: 'mesh2Step7'
            }
        ],
        urlId: 'meshTutorial2'
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
        category: CATEGORIES.gettingStarted,
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
  $送信メッセージ = "こんにちは！元気ですか？"
  say("送信中...", 1)
  broadcast("メッセージが来た")
end`,
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
  @受信メッセージ = mesh.sensor_value("送信メッセージ")
  say(@受信メッセージ)
end`,
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
                image: 'mesh3Step9'
            }
        ],
        urlId: 'meshTutorial3'
    }
};

export default decks;
