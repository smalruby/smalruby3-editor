import React from 'react';
import {FormattedMessage} from 'react-intl';

import libraryRubyBasics1Numbers from '../thumbnails/ruby-basics-1-numbers.jpg';
import libraryRubyBasics1TryRuby from '../thumbnails/ruby-basics-1-tryruby.png';
import libraryRubyBasics2Strings from '../thumbnails/ruby-basics-2-strings.jpg';
import libraryRubyBasics3Variables from '../thumbnails/ruby-basics-3-variables.jpg';
import {CATEGORIES} from '../../tutorial-tags';
import GreenFlagIcon from '../green-flag-icon.jsx';

const decks = {
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
