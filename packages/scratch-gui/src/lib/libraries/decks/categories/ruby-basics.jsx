import React from 'react';
import {FormattedMessage} from 'react-intl';

import libraryRubyBasics1Numbers from '../thumbnails/ruby-basics-1-numbers.jpg';
import libraryRubyBasics1TryRuby from '../thumbnails/ruby-basics-1-tryruby.png';
import libraryRubyBasics2Strings from '../thumbnails/ruby-basics-2-strings.jpg';
import libraryRubyBasics3Variables from '../thumbnails/ruby-basics-3-variables.jpg';
import libraryRubyBasics4Arrays from '../thumbnails/ruby-basics-4-arrays.jpg';
import libraryRubyBasics5Blocks from '../thumbnails/ruby-basics-5-blocks.jpg';
import libraryRubyBasics6Methods from '../thumbnails/ruby-basics-6-methods.jpg';
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
    },

    // ─── Ruby Basics 4: 配列で遊ぼう ─────────────────────────────────────────
    'ruby-basics-4-arrays': {
        name: (
            <FormattedMessage
                defaultMessage="配列（はいれつ）で遊ぼう"
                description="Name for Ruby Basics 4: use arrays with puts"
                id="gui.howtos.ruby-basics-4-arrays.name"
            />
        ),
        tags: ['ruby'],
        category: CATEGORIES.rubyBasics,
        img: libraryRubyBasics4Arrays,
        nameMessageId: 'gui.howtos.ruby-basics-4-arrays.name',
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
                        defaultMessage="配列（はいれつ）で遊ぼう！"
                        description="Ruby Basics 4 Step 1: Intro to arrays with puts"
                        id="gui.howtos.ruby-basics-4-arrays.step1.title"
                    />
                ),
                image: 'rubyBasics4Step1',
                startTutorial: true,
                animationTarget: 'startTutorialButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="複数のことばを1つの配列にまとめてみよう"
                        description="Ruby Basics 4 Step 2: Insert first array code"
                        id="gui.howtos.ruby-basics-4-arrays.step2.title"
                    />
                ),
                image: 'rubyBasics4Step2',
                code: `when_flag_clicked do
  ticket = ["赤", "青", "黄"]
  puts ticket
end`,
                animationTarget: 'insertCodeButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="{greenFlag}を押すと、ネコが配列の中身をしゃべるよ"
                        description="Ruby Basics 4 Step 3: Run the program"
                        id="gui.howtos.ruby-basics-4-arrays.step3.title"
                        values={{greenFlag: <GreenFlagIcon />}}
                    />
                ),
                image: 'rubyBasics4Step3',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="配列の順番を逆にしたり、番号で1つだけ取り出してみよう"
                        description="Ruby Basics 4 Step 4: reverse / index access array methods"
                        id="gui.howtos.ruby-basics-4-arrays.step4.title"
                    />
                ),
                image: 'rubyBasics4Step4',
                code: `when_flag_clicked do
  ticket = ["赤", "青", "黄"]
  puts ticket.reverse
  puts ticket[0]
end`,
                animationTarget: 'insertCodeButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="好きなことばに変えて、自分だけの配列で遊ぼう"
                        description="Ruby Basics 4 Step 5: Modify the array"
                        id="gui.howtos.ruby-basics-4-arrays.step5.title"
                    />
                ),
                image: 'rubyBasics4Step5',
                code: `when_flag_clicked do
  ticket = ["いぬ", "ねこ", "とり"]
  puts ticket.reverse
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
                                id="gui.howtos.ruby-basics-4-arrays.external.tryruby.name"
                            />
                        )
                    }
                }
            }
        ],
        urlId: 'rubyBasics4Arrays'
    },

    // ─── Ruby Basics 5: ブロックを使ってみよう ─────────────────────────────────
    'ruby-basics-5-blocks': {
        name: (
            <FormattedMessage
                defaultMessage="ブロック（times）を使ってみよう"
                description="Name for Ruby Basics 5: repeat with N.times { |i| ... }"
                id="gui.howtos.ruby-basics-5-blocks.name"
            />
        ),
        tags: ['ruby'],
        category: CATEGORIES.rubyBasics,
        img: libraryRubyBasics5Blocks,
        nameMessageId: 'gui.howtos.ruby-basics-5-blocks.name',
        // Same "open the Ruby tab in Ruby mode" setup as deck 1 — see
        // docs/tutorial/improvement-plan.md "チュートリアル起動時の環境セットアップ".
        setup: {
            tab: 'ruby',
            rubyMode: 'ruby'
        },
        allowedBlocks: {
            motion: ['motion_movesteps'],
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
                        defaultMessage="ブロック（times）を使ってみよう！"
                        description="Ruby Basics 5 Step 1: Intro to N.times blocks"
                        id="gui.howtos.ruby-basics-5-blocks.step1.title"
                    />
                ),
                image: 'rubyBasics5Step1',
                startTutorial: true,
                animationTarget: 'startTutorialButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="「5.times do |i| ... end」で同じ処理を5回くり返してみよう"
                        description="Ruby Basics 5 Step 2: Insert first N.times code"
                        id="gui.howtos.ruby-basics-5-blocks.step2.title"
                    />
                ),
                image: 'rubyBasics5Step2',
                code: `when_flag_clicked do
  5.times do |i|
    puts i
  end
end`,
                animationTarget: 'insertCodeButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="{greenFlag}を押すと、ネコが「0」から「4」まで順番にしゃべるよ"
                        description="Ruby Basics 5 Step 3: Run the program"
                        id="gui.howtos.ruby-basics-5-blocks.step3.title"
                        values={{greenFlag: <GreenFlagIcon />}}
                    />
                ),
                image: 'rubyBasics5Step3',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="くり返しの中で「move(20)」も動かして、進みながらしゃべらせよう"
                        description="Ruby Basics 5 Step 4: Combine N.times with move"
                        id="gui.howtos.ruby-basics-5-blocks.step4.title"
                    />
                ),
                image: 'rubyBasics5Step4',
                code: `when_flag_clicked do
  5.times do |i|
    puts i
    move(20)
  end
end`,
                animationTarget: 'insertCodeButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="くり返す回数や動く歩数を変えて、自分だけの動きをつくろう"
                        description="Ruby Basics 5 Step 5: Modify the repeat count and move distance"
                        id="gui.howtos.ruby-basics-5-blocks.step5.title"
                    />
                ),
                image: 'rubyBasics5Step5',
                code: `when_flag_clicked do
  10.times do |i|
    puts i
    move(10)
  end
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
                                id="gui.howtos.ruby-basics-5-blocks.external.tryruby.name"
                            />
                        )
                    }
                }
            }
        ],
        urlId: 'rubyBasics5Blocks'
    },

    // ─── Ruby Basics 6: メソッドをつくってみよう ───────────────────────────────
    'ruby-basics-6-methods': {
        name: (
            <FormattedMessage
                defaultMessage="メソッドをつくってみよう"
                description="Name for Ruby Basics 6: define methods with def"
                id="gui.howtos.ruby-basics-6-methods.name"
            />
        ),
        tags: ['ruby'],
        category: CATEGORIES.rubyBasics,
        img: libraryRubyBasics6Methods,
        nameMessageId: 'gui.howtos.ruby-basics-6-methods.name',
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
                        defaultMessage="メソッドをつくってみよう！"
                        description="Ruby Basics 6 Step 1: Intro to defining methods"
                        id="gui.howtos.ruby-basics-6-methods.step1.title"
                    />
                ),
                image: 'rubyBasics6Step1',
                startTutorial: true,
                animationTarget: 'startTutorialButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="「def hello(name) ... end」で、名前を呼んであいさつするメソッドをつくろう"
                        description="Ruby Basics 6 Step 2: Insert first method definition"
                        id="gui.howtos.ruby-basics-6-methods.step2.title"
                    />
                ),
                image: 'rubyBasics6Step2',
                code: `def hello(name)
  puts "こんにちは、" + name
end

when_flag_clicked do
  hello("ネコ")
end`,
                animationTarget: 'insertCodeButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="{greenFlag}を押すと、ネコが「こんにちは、ネコ」としゃべるよ"
                        description="Ruby Basics 6 Step 3: Run the program"
                        id="gui.howtos.ruby-basics-6-methods.step3.title"
                        values={{greenFlag: <GreenFlagIcon />}}
                    />
                ),
                image: 'rubyBasics6Step3',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="同じメソッドを、ちがう名前で何度も呼び出してみよう"
                        description="Ruby Basics 6 Step 4: Call the same method multiple times"
                        id="gui.howtos.ruby-basics-6-methods.step4.title"
                    />
                ),
                image: 'rubyBasics6Step4',
                code: `def hello(name)
  puts "こんにちは、" + name
end

when_flag_clicked do
  hello("ネコ")
  hello("イヌ")
end`,
                animationTarget: 'insertCodeButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="メソッドの中身を変えて、自分だけのあいさつをつくろう"
                        description="Ruby Basics 6 Step 5: Modify the method body"
                        id="gui.howtos.ruby-basics-6-methods.step5.title"
                    />
                ),
                image: 'rubyBasics6Step5',
                code: `def hello(name)
  puts "やあ、" + name + "！"
end

when_flag_clicked do
  hello("あなたのなまえ")
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
                                id="gui.howtos.ruby-basics-6-methods.external.tryruby.name"
                            />
                        )
                    }
                }
            }
        ],
        urlId: 'rubyBasics6Methods'
    },

    'ruby-basics-7-next': {
        name: (
            <FormattedMessage
                defaultMessage="次に進もう（TryRuby）"
                description="Name for Ruby Basics 7: bridge to TryRuby / real Ruby"
                id="gui.howtos.ruby-basics-7-next.name"
            />
        ),
        tags: ['ruby'],
        category: CATEGORIES.rubyBasics,
        // Reuse the TryRuby screenshot as the deck thumbnail — this deck is all
        // about the bridge to try.ruby-lang.org.
        img: libraryRubyBasics1TryRuby,
        nameMessageId: 'gui.howtos.ruby-basics-7-next.name',
        // Same "open the Ruby tab in Ruby mode" setup as decks 1-6 — see
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
                        defaultMessage="Rubyの基礎、ぜんぶ学んだね！"
                        description="Ruby Basics 7 Step 1: Congratulations intro"
                        id="gui.howtos.ruby-basics-7-next.step1.title"
                    />
                ),
                // Reuse deck 1 intro image.
                image: 'rubyBasics1Step1',
                startTutorial: true,
                animationTarget: 'startTutorialButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="おさらい：putsで計算の答えをしゃべらせよう"
                        description="Ruby Basics 7 Step 2: Review arithmetic with puts"
                        id="gui.howtos.ruby-basics-7-next.step2.title"
                    />
                ),
                // Reuse deck 1 "first puts" image.
                image: 'rubyBasics1Step2',
                code: `when_flag_clicked do
  puts 3 + 4
  puts 10 * 5
end`,
                animationTarget: 'insertCodeButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="{greenFlag}を押すと、ネコが答えをしゃべるよ"
                        description="Ruby Basics 7 Step 3: Run the review program"
                        id="gui.howtos.ruby-basics-7-next.step3.title"
                        values={{greenFlag: <GreenFlagIcon />}}
                    />
                ),
                // Reuse deck 1 result image.
                image: 'rubyBasics1Step3',
                animationTarget: 'nextButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="文字だってputsで表示できたね"
                        description="Ruby Basics 7 Step 4: Review strings with puts"
                        id="gui.howtos.ruby-basics-7-next.step4.title"
                    />
                ),
                // Reuse deck 2 "first puts" (string reverse) image.
                image: 'rubyBasics2Step2',
                code: `when_flag_clicked do
  puts "スモウルビー".reverse
end`,
                animationTarget: 'insertCodeButton'
            },
            {
                title: (
                    <FormattedMessage
                        defaultMessage="Smalrubyで書いたputsのコードは、TryRubyや本物のRubyでもそのまま動くよ。TryRubyを開いてためしてみよう！"
                        description="Ruby Basics 7 Step 5: Bridge message to TryRuby with external link"
                        id="gui.howtos.ruby-basics-7-next.step5.title"
                    />
                ),
                image: 'rubyBasics7TryRuby',
                // TryRuby does not accept a language path segment, so always use the root URL.
                externalUrl: 'https://try.ruby-lang.org/',
                externalUrlLabel: (
                    <FormattedMessage
                        defaultMessage="TryRubyを開く"
                        description="Button label to open the TryRuby website in a new tab"
                        id="gui.howtos.ruby-basics-7-next.step5.openTryRuby"
                    />
                )
            }
        ],
        urlId: 'rubyBasics7Next'
    }
};

export default decks;
