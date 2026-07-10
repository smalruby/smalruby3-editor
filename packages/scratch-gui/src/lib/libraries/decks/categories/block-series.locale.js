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

export const ja = {
    ...bookPromo,
};

export const jaHira = {
    ...bookPromoHira,
};

export const en = {
    ...bookPromoEn,
};
