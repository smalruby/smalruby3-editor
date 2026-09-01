// Locale strings for the blockBasics/blockGames tutorial categories
// (Phase 3, issue #680), split out so this category can
// be developed without touching index.jsx or the central locale files
// (issue #932).
//
// The common book-promotion strings (opening / closing / advanced-closing /
// purchase) shared by every Block-axis deck live here as the foundation
// (issue #956); the per-deck howto strings are added by #680. The book title
// / author placeholders are interpolated at render time from book-promo.jsx.

const bookPromo = {
    'gui.howtos.book-promo.opening.title':
        '📖 「{bookTitle}」（{author} 著）第{chapter}章より。このチュートリアルでは本書 第{chapter}章の冒頭部分を体験できます。',
    'gui.howtos.book-promo.closing.title':
        'ここまでで体験したのは本書 第{chapter}章の最初の数ページの内容です。続きは書籍をご覧ください。' +
        '先生・保護者の方へ：本書を購入してお子さんに配布し、チュートリアルと並行して進めると、より深く理解できます。',
    'gui.howtos.book-promo.advancedClosing.title':
        'ここで動かしたプログラムは本書 第{chapter}章【発展】セクションのものです。' +
        'このプログラムをゼロから自分で作る手順は、本書をご覧ください。',
    'gui.howtos.book-promo.purchase': '📖 書籍を購入する',
};

const bookPromoHira = {
    'gui.howtos.book-promo.opening.title':
        '📖 「{bookTitle}」（{author} 著）第{chapter}しょうより。このチュートリアルでははんしょ 第{chapter}しょうのぼうとうぶぶんをたいけんできます。',
    'gui.howtos.book-promo.closing.title':
        'ここまででたいけんしたのははんしょ 第{chapter}しょうのさいしょのすうページのないようです。つづきはしょせきをごらんください。' +
        'せんせい・ほごしゃのかたへ：ほんしょをこうにゅうしておこさんにはいふし、チュートリアルとへいこうしてすすめると、よりふかくりかいできます。',
    'gui.howtos.book-promo.advancedClosing.title':
        'ここでうごかしたプログラムははんしょ 第{chapter}しょう【はってん】セクションのものです。' +
        'このプログラムをゼロからじぶんでつくるてじゅんは、ほんしょをごらんください。',
    'gui.howtos.book-promo.purchase': '📖 しょせきをこうにゅうする',
};

const bookPromoEn = {
    'gui.howtos.book-promo.opening.title':
        '📖 From "{bookTitle}" (by {author}), Chapter {chapter}. This tutorial lets you try the opening part of Chapter {chapter}.',
    'gui.howtos.book-promo.closing.title':
        'What you tried here is only the first few pages of Chapter {chapter}. See the book for the rest. ' +
        'For teachers & guardians: buying the book and working through it alongside this tutorial helps kids understand it more deeply.',
    'gui.howtos.book-promo.advancedClosing.title':
        'The program you ran here is from the "Advanced" section of Chapter {chapter}. ' +
        'See the book for how to build it from scratch.',
    'gui.howtos.book-promo.purchase': '📖 Buy the book',
};

// Per-deck howto strings for blockBasics 第1章「ネコからにげるゲーム」(issue #957).
const blockBasics = {
    'gui.howtos.block-basics-lv0.name': '【Lv0】ネコからにげるゲームを動かそう',
    'gui.howtos.block-basics-lv0.intro':
        '【Lv0】ネコからにげるゲームを作るよ。ネコがマウスのポインターを追いかけてくるよ！',
    'gui.howtos.block-basics-lv0.insert': '「コードを挿入」ボタンを押して、完成プログラムを入れてみよう',
    'gui.howtos.block-basics-lv0.run':
        '{greenFlag}を押すと、ネコがマウスポインターを追いかけるよ。マウスを動かしてにげよう！',
    'gui.howtos.block-basics-lv0.modify':
        '「こんにちは!」の言葉や、「10歩動かす」の歩数を変えて、動きを変えてみよう',

    'gui.howtos.block-basics-lv2.name': '【Lv2】ブロックを組み立てよう',
    'gui.howtos.block-basics-lv2.intro': '【Lv2】同じゲームを、ブロックを自分で組み立てて作ってみよう',
    'gui.howtos.block-basics-lv2.block1':
        '「🏁が押されたとき」の中に「ずっと」を入れて、「マウスのポインターへ向ける」を置こう',
    'gui.howtos.block-basics-lv2.block2': '「10歩動かす」を追加しよう。これでネコがマウスに向かって進むよ',
    'gui.howtos.block-basics-lv2.block3':
        '「もし〈マウスのポインターに触れた〉なら」の中に「こんにちは!と2秒言う」を入れよう',
    'gui.howtos.block-basics-lv2.run': '{greenFlag}を押して、自分で組み立てたゲームを動かそう',

    'gui.howtos.block-basics-lv3.name': '【Lv3】Rubyで書こう',
    'gui.howtos.block-basics-lv3.intro': '【Lv3】同じゲームを、Rubyのプログラムで書いてみよう',
    'gui.howtos.block-basics-lv3.rubyTab': 'ルビー(Ruby)タブが開いていることを確認しよう',
    'gui.howtos.block-basics-lv3.insert': '「コードを挿入」ボタンを押して、Rubyのプログラムを入れてみよう',
    'gui.howtos.block-basics-lv3.modify': 'say("こんにちは!", 2) の言葉や秒数を変えて、自分だけのゲームにしよう',
    'gui.howtos.block-basics-lv3.run': '{greenFlag}を押すと、Rubyで書いたゲームが動くよ',

    'gui.howtos.block-basics-advanced.name': '【発展】完成デモを動かそう',
    'gui.howtos.block-basics-advanced.intro':
        '【発展】本書 第1章では、このあとゲームをもっと楽しくしていきます。ここでは完成デモを動かして見てみよう',
    'gui.howtos.block-basics-advanced.insert': '「コードを挿入」ボタンで、完成した「ネコからにげるゲーム」を入れよう',
    'gui.howtos.block-basics-advanced.run':
        '{greenFlag}を押して、完成デモを動かそう。マウスを動かしてネコからにげよう！',
};

const blockBasicsHira = {
    'gui.howtos.block-basics-lv0.name': '【Lv0】ネコからにげるゲームをうごかそう',
    'gui.howtos.block-basics-lv0.intro':
        '【Lv0】ネコからにげるゲームをつくるよ。ネコがマウスのポインターをおいかけてくるよ！',
    'gui.howtos.block-basics-lv0.insert': '「コードをそうにゅう」ボタンをおして、かんせいプログラムをいれてみよう',
    'gui.howtos.block-basics-lv0.run':
        '{greenFlag}をおすと、ネコがマウスポインターをおいかけるよ。マウスをうごかしてにげよう！',
    'gui.howtos.block-basics-lv0.modify':
        '「こんにちは!」のことばや、「10ぽうごかす」のほすうをかえて、うごきをかえてみよう',

    'gui.howtos.block-basics-lv2.name': '【Lv2】ブロックをくみたてよう',
    'gui.howtos.block-basics-lv2.intro': '【Lv2】おなじゲームを、ブロックをじぶんでくみたててつくってみよう',
    'gui.howtos.block-basics-lv2.block1':
        '「🏁がおされたとき」のなかに「ずっと」をいれて、「マウスのポインターへむける」をおこう',
    'gui.howtos.block-basics-lv2.block2': '「10ぽうごかす」をついかしよう。これでネコがマウスにむかってすすむよ',
    'gui.howtos.block-basics-lv2.block3':
        '「もし〈マウスのポインターにふれた〉なら」のなかに「こんにちは!と2びょういう」をいれよう',
    'gui.howtos.block-basics-lv2.run': '{greenFlag}をおして、じぶんでくみたてたゲームをうごかそう',

    'gui.howtos.block-basics-lv3.name': '【Lv3】Rubyでかこう',
    'gui.howtos.block-basics-lv3.intro': '【Lv3】おなじゲームを、Rubyのプログラムでかいてみよう',
    'gui.howtos.block-basics-lv3.rubyTab': 'ルビー(Ruby)タブがひらいていることをかくにんしよう',
    'gui.howtos.block-basics-lv3.insert': '「コードをそうにゅう」ボタンをおして、Rubyのプログラムをいれてみよう',
    'gui.howtos.block-basics-lv3.modify':
        'say("こんにちは!", 2) のことばやびょうすうをかえて、じぶんだけのゲームにしよう',
    'gui.howtos.block-basics-lv3.run': '{greenFlag}をおすと、Rubyでかいたゲームがうごくよ',

    'gui.howtos.block-basics-advanced.name': '【はってん】かんせいデモをうごかそう',
    'gui.howtos.block-basics-advanced.intro':
        '【はってん】ほんしょ 第1しょうでは、このあとゲームをもっとたのしくしていきます。ここではかんせいデモをうごかしてみてみよう',
    'gui.howtos.block-basics-advanced.insert':
        '「コードをそうにゅう」ボタンで、かんせいした「ネコからにげるゲーム」をいれよう',
    'gui.howtos.block-basics-advanced.run':
        '{greenFlag}をおして、かんせいデモをうごかそう。マウスをうごかしてネコからにげよう！',
};

const blockBasicsEn = {
    'gui.howtos.block-basics-lv0.name': '[Lv0] Run the cat-chase game',
    'gui.howtos.block-basics-lv0.intro':
        "[Lv0] Let's make a cat-chase game. The cat chases the mouse pointer!",
    'gui.howtos.block-basics-lv0.insert': 'Press the "Insert code" button to add the finished program',
    'gui.howtos.block-basics-lv0.run':
        '{greenFlag} Press it and the cat chases the mouse pointer. Move the mouse to run away!',
    'gui.howtos.block-basics-lv0.modify':
        'Change the "Hello!" words or the "move 10 steps" number to change how it moves',

    'gui.howtos.block-basics-lv2.name': '[Lv2] Build it with blocks',
    'gui.howtos.block-basics-lv2.intro': '[Lv2] Build the same game yourself with blocks',
    'gui.howtos.block-basics-lv2.block1':
        'Inside "when 🏁 clicked", add "forever" and place "point towards mouse pointer"',
    'gui.howtos.block-basics-lv2.block2': 'Add "move 10 steps" so the cat moves towards the mouse',
    'gui.howtos.block-basics-lv2.block3':
        'Inside "if touching mouse pointer", add "say Hello! for 2 seconds"',
    'gui.howtos.block-basics-lv2.run': '{greenFlag} Press it to run the game you built',

    'gui.howtos.block-basics-lv3.name': '[Lv3] Write it in Ruby',
    'gui.howtos.block-basics-lv3.intro': '[Lv3] Write the same game as a Ruby program',
    'gui.howtos.block-basics-lv3.rubyTab': 'Make sure the Ruby tab is open',
    'gui.howtos.block-basics-lv3.insert': 'Press the "Insert code" button to add the Ruby program',
    'gui.howtos.block-basics-lv3.modify':
        'Change the words or seconds in say("Hello!", 2) to make it your own game',
    'gui.howtos.block-basics-lv3.run': '{greenFlag} Press it and the game you wrote in Ruby runs',

    'gui.howtos.block-basics-advanced.name': '[Advanced] Run the finished demo',
    'gui.howtos.block-basics-advanced.intro':
        '[Advanced] Chapter 1 of the book keeps making the game more fun. Here, just run the finished demo',
    'gui.howtos.block-basics-advanced.insert':
        'Use the "Insert code" button to add the finished cat-chase game',
    'gui.howtos.block-basics-advanced.run':
        '{greenFlag} Press it to run the finished demo. Move the mouse to run away from the cat!',
};

export const ja = {
    ...bookPromo,
    ...blockBasics,
};

export const jaHira = {
    ...bookPromoHira,
    ...blockBasicsHira,
};

export const en = {
    ...bookPromoEn,
    ...blockBasicsEn,
};
