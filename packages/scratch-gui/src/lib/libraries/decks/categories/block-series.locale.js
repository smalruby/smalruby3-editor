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

// blockGames 第4章（シューティング）の deck 名・ステップ文言（issue #958）。
const blockGames = {
    'gui.howtos.block-shooting-lv0.name': 'シューティングゲームを作ろう Lv0',
    'gui.howtos.block-shooting-lv0.step.intro':
        'この章ではネコが上下に動いてタマをうつシューティングゲームを作るよ。まずは動かしてみよう！',
    'gui.howtos.block-shooting-lv0.step.move':
        '「コードを挿入」ボタンを押して、ネコを上下に動かすプログラムを入れてみよう',
    'gui.howtos.block-shooting-lv0.step.run': 'キーボードの上・下の矢印キーを押すと、ネコが上下に動くよ',
    'gui.howtos.block-shooting-lv0.step.customize':
        '「10」の数を変えると、動く速さが変わるよ。好きな数に変えて試してみよう',
    'gui.howtos.block-shooting-lv2.name': 'シューティングゲームを作ろう Lv2',
    'gui.howtos.block-shooting-lv2.step.intro': '今度はブロックを自分で組み立ててみよう！',
    'gui.howtos.block-shooting-lv2.step.catBlocks':
        'ネコ：「上向き矢印キーが押されたとき」に「y座標を10ずつ変える」、下向きには「-10ずつ変える」を組み立てよう。y座標は上下の位置だよ',
    'gui.howtos.block-shooting-lv2.step.addArrow':
        'タマになるスプライト「Arrow1」を追加しよう（スプライト一覧の＋ボタンから選べるよ）',
    'gui.howtos.block-shooting-lv2.step.bulletBlocks':
        'タマ：スペースキーで「スプライト1へ行く」「表示する」、そして「端に触れるまでx座標を10ずつ変える」を繰り返し、最後に「隠す」。' +
        '『〜まで繰り返す』は条件が成り立つまで続けるブロックだよ',
    'gui.howtos.block-shooting-lv2.step.run':
        '{greenFlag}を押して、矢印キーで動かしスペースキーでタマをうってみよう！',
    'gui.howtos.block-shooting-lv3.name': 'シューティングゲームを作ろう Lv3',
    'gui.howtos.block-shooting-lv3.step.intro':
        '同じゲームを Ruby で書いてみよう。ルビータブが開いているのを確認してね',
    'gui.howtos.block-shooting-lv3.step.catCode':
        'ネコ：「コードを挿入」で上下移動のプログラムを入れよう。self.y は上下の位置だよ',
    'gui.howtos.block-shooting-lv3.step.addArrow':
        'タマになるスプライト「Arrow1」を追加して、そのスプライトを選ぼう',
    'gui.howtos.block-shooting-lv3.step.bulletCode':
        'タマ：スペースキーで発射して右へ飛ばすプログラムを入れよう。until は条件が成り立つまで繰り返すよ',
    'gui.howtos.block-shooting-lv3.step.run':
        '{greenFlag}を押して、矢印キーとスペースキーで遊んでみよう！',
    'gui.howtos.block-shooting-advanced.name': 'シューティングゲーム【発展】クローンでタマを増やそう',
    'gui.howtos.block-shooting-advanced.step.intro':
        'タマを一度にたくさん出すには「クローン」を使うよ。まずは動くところを見てみよう！',
    'gui.howtos.block-shooting-advanced.step.clone':
        'タマ（Arrow1）を選んで「コードを挿入」しよう。スペースキーを押すたびに自分のクローンを作ってタマを増やすよ',
    'gui.howtos.block-shooting-advanced.step.run':
        '{greenFlag}を押して、スペースキーを連打してみよう。タマがどんどん増えるよ！',
};

const blockGamesHira = {
    'gui.howtos.block-shooting-lv0.name': 'シューティングゲームをつくろう Lv0',
    'gui.howtos.block-shooting-lv0.step.intro':
        'このしょうではネコがじょうげにうごいてタマをうつシューティングゲームをつくるよ。まずはうごかしてみよう！',
    'gui.howtos.block-shooting-lv0.step.move':
        '「コードをそうにゅう」ボタンをおして、ネコをじょうげにうごかすプログラムをいれてみよう',
    'gui.howtos.block-shooting-lv0.step.run':
        'キーボードのうえ・したのやじるしキーをおすと、ネコがじょうげにうごくよ',
    'gui.howtos.block-shooting-lv0.step.customize':
        '「10」のかずをかえると、うごくはやさがかわるよ。すきなかずにかえてためしてみよう',
    'gui.howtos.block-shooting-lv2.name': 'シューティングゲームをつくろう Lv2',
    'gui.howtos.block-shooting-lv2.step.intro': 'こんどはブロックをじぶんでくみたててみよう！',
    'gui.howtos.block-shooting-lv2.step.catBlocks':
        'ネコ：「うわむきやじるしキーがおされたとき」に「yざひょうを10ずつかえる」、したむきには「-10ずつかえる」をくみたてよう。yざひょうはじょうげのいちだよ',
    'gui.howtos.block-shooting-lv2.step.addArrow':
        'タマになるスプライト「Arrow1」をついかしよう（スプライトいちらんの＋ボタンからえらべるよ）',
    'gui.howtos.block-shooting-lv2.step.bulletBlocks':
        'タマ：スペースキーで「スプライト1へいく」「ひょうじする」、そして「はしにふれるまでxざひょうを10ずつかえる」をくりかえし、さいごに「かくす」。' +
        '『〜までくりかえす』はじょうけんがなりたつまでつづけるブロックだよ',
    'gui.howtos.block-shooting-lv2.step.run':
        '{greenFlag}をおして、やじるしキーでうごかしスペースキーでタマをうってみよう！',
    'gui.howtos.block-shooting-lv3.name': 'シューティングゲームをつくろう Lv3',
    'gui.howtos.block-shooting-lv3.step.intro':
        'おなじゲームを Ruby でかいてみよう。ルビータブがひらいているのをかくにんしてね',
    'gui.howtos.block-shooting-lv3.step.catCode':
        'ネコ：「コードをそうにゅう」でじょうげいどうのプログラムをいれよう。self.y はじょうげのいちだよ',
    'gui.howtos.block-shooting-lv3.step.addArrow':
        'タマになるスプライト「Arrow1」をついかして、そのスプライトをえらぼう',
    'gui.howtos.block-shooting-lv3.step.bulletCode':
        'タマ：スペースキーではっしゃしてみぎへとばすプログラムをいれよう。until はじょうけんがなりたつまでくりかえすよ',
    'gui.howtos.block-shooting-lv3.step.run':
        '{greenFlag}をおして、やじるしキーとスペースキーであそんでみよう！',
    'gui.howtos.block-shooting-advanced.name': 'シューティングゲーム【はってん】クローンでタマをふやそう',
    'gui.howtos.block-shooting-advanced.step.intro':
        'タマをいちどにたくさんだすには「クローン」をつかうよ。まずはうごくところをみてみよう！',
    'gui.howtos.block-shooting-advanced.step.clone':
        'タマ（Arrow1）をえらんで「コードをそうにゅう」しよう。スペースキーをおすたびにじぶんのクローンをつくってタマをふやすよ',
    'gui.howtos.block-shooting-advanced.step.run':
        '{greenFlag}をおして、スペースキーをれんだしてみよう。タマがどんどんふえるよ！',
};

const blockGamesEn = {
    'gui.howtos.block-shooting-lv0.name': 'Make a Shooting Game Lv0',
    'gui.howtos.block-shooting-lv0.step.intro':
        'In this chapter we make a shooting game where the cat moves up and down and shoots. First, try running it!',
    'gui.howtos.block-shooting-lv0.step.move':
        'Press "Insert code" to add the program that moves the cat up and down',
    'gui.howtos.block-shooting-lv0.step.run': 'Press the up/down arrow keys and the cat moves up and down',
    'gui.howtos.block-shooting-lv0.step.customize':
        'Changing the "10" changes how fast it moves. Try your own number!',
    'gui.howtos.block-shooting-lv2.name': 'Make a Shooting Game Lv2',
    'gui.howtos.block-shooting-lv2.step.intro': 'Now build the blocks yourself!',
    'gui.howtos.block-shooting-lv2.step.catBlocks':
        'Cat: on "when up arrow key pressed", "change y by 10"; for down, "change y by -10". y is the up/down position.',
    'gui.howtos.block-shooting-lv2.step.addArrow':
        'Add the sprite "Arrow1" for the bullet (pick it with the + button in the sprite list)',
    'gui.howtos.block-shooting-lv2.step.bulletBlocks':
        'Bullet: on space, "go to スプライト1", "show", then "repeat until touching edge: change x by 10", finally "hide". ' +
        '"Repeat until" keeps going until the condition becomes true.',
    'gui.howtos.block-shooting-lv2.step.run':
        'Press {greenFlag}, move with the arrow keys and shoot with the space key!',
    'gui.howtos.block-shooting-lv3.name': 'Make a Shooting Game Lv3',
    'gui.howtos.block-shooting-lv3.step.intro':
        "Let's write the same game in Ruby. Make sure the Ruby tab is open.",
    'gui.howtos.block-shooting-lv3.step.catCode':
        'Cat: use "Insert code" to add the up/down movement. self.y is the up/down position.',
    'gui.howtos.block-shooting-lv3.step.addArrow': 'Add the sprite "Arrow1" for the bullet and select it',
    'gui.howtos.block-shooting-lv3.step.bulletCode':
        'Bullet: add the program that fires on space and flies right. "until" repeats until the condition is true.',
    'gui.howtos.block-shooting-lv3.step.run':
        'Press {greenFlag} and play with the arrow keys and the space key!',
    'gui.howtos.block-shooting-advanced.name': 'Shooting Game (Advanced): Multiply bullets with clones',
    'gui.howtos.block-shooting-advanced.step.intro':
        'To fire many bullets at once, use "clones". First, watch it run!',
    'gui.howtos.block-shooting-advanced.step.clone':
        'Select the bullet (Arrow1) and "Insert code". Each space press makes a clone of itself to add bullets.',
    'gui.howtos.block-shooting-advanced.step.run':
        'Press {greenFlag} and mash the space key. The bullets keep multiplying!',
};

export const ja = {
    ...bookPromo,
    ...blockGames,
};

export const jaHira = {
    ...bookPromoHira,
    ...blockGamesHira,
};

export const en = {
    ...bookPromoEn,
    ...blockGamesEn,
};
