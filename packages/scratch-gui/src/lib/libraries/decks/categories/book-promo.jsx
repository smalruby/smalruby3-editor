// === Smalruby: This file is Smalruby-specific (Block-axis book promotion) ===
//
// Shared book-promotion elements for the Block-axis tutorial series
// (blockBasics/blockGames). Phase 3 of the tutorial
// improvement plan positions these decks as an excerpt/"試食" of Kengo
// Fujimura's Smalruby book, so every deck opens with the book's
// bibliographic info and closes with a "続きは書籍で" purchase link.
//
// Confirmed bibliographic details (co-author takaokouji provided; see
// docs/tutorial/book-kirakira-ruby-source.md and issue #962). Update the
// single `BOOK` constant here and every deck picks up the change (Phase 3,
// issue #956).
import React from 'react';
import {FormattedMessage} from 'react-intl';

/**
 * Bibliographic info for the Smalruby book (confirmed via issue #962). Change
 * these values in one place and every book-promo step picks it up.
 * @type {{title: string, author: string, publisher: string, isbn: string, url: string}}
 */
export const BOOK = {
    title: '小学生から楽しむ きらきらRubyプログラミング',
    author: '高尾宏治・藤村健吾',
    publisher: '日経BP',
    isbn: '978-4-8222-8639-2',
    url: 'https://bookplus.nikkei.com/atcl/catalog/20/P60510/',
};

/**
 * Convenience alias for the purchase link so decks can reference a single
 * canonical URL constant.
 * @type {string}
 */
export const BOOK_URL = BOOK.url;

/**
 * Opening step shown at the start of each Block-axis deck: displays the
 * book's title/author and the chapter this deck excerpts from.
 * @param {number} chapter - The book chapter this deck is based on.
 * @param {string} image - Step image key (registered in ja-steps.js / en-steps.js).
 * @returns {object} A tutorial step object.
 */
export const bookOpeningStep = (chapter, image) => ({
    title: (
        <FormattedMessage
            defaultMessage="📖 「{bookTitle}」（{author} 著）第{chapter}章より。このチュートリアルでは本書 第{chapter}章の冒頭部分を体験できます。"
            description="Opening step for a book-based Block tutorial: shows the book title/author and which chapter it excerpts"
            id="gui.howtos.book-promo.opening.title"
            values={{bookTitle: BOOK.title, author: BOOK.author, chapter}}
        />
    ),
    image,
    animationTarget: 'nextButton',
});

/**
 * Closing step shown at the end of each Block-axis basic deck: explains that
 * only the opening pages were covered and links to the book purchase page.
 * @param {number} chapter - The book chapter this deck is based on.
 * @param {string} image - Step image key (registered in ja-steps.js / en-steps.js).
 * @returns {object} A tutorial step object.
 */
export const bookClosingStep = (chapter, image) => ({
    title: (
        <FormattedMessage
            defaultMessage="ここまでで体験したのは本書 第{chapter}章の最初の数ページの内容です。続きは書籍をご覧ください。先生・保護者の方へ：本書を購入してお子さんに配布し、チュートリアルと並行して進めると、より深く理解できます。"
            description="Closing step for a book-based Block tutorial: only the opening pages were covered, buy the book for the rest"
            id="gui.howtos.book-promo.closing.title"
            values={{chapter}}
        />
    ),
    image,
    externalUrl: BOOK_URL,
    externalUrlLabel: (
        <FormattedMessage
            defaultMessage="📖 書籍を購入する"
            description="Button label to open the book purchase page"
            id="gui.howtos.book-promo.purchase"
        />
    ),
});

/**
 * Closing step for the "発展" (advanced) deck, which only demonstrates a
 * finished program at Lv0: explains the program is from the chapter's
 * advanced section and links to the book for how to build it.
 * @param {number} chapter - The book chapter this deck is based on.
 * @param {string} image - Step image key (registered in ja-steps.js / en-steps.js).
 * @returns {object} A tutorial step object.
 */
export const bookAdvancedClosingStep = (chapter, image) => ({
    title: (
        <FormattedMessage
            defaultMessage="ここで動かしたプログラムは本書 第{chapter}章【発展】セクションのものです。このプログラムをゼロから自分で作る手順は、本書をご覧ください。"
            description="Closing step for the advanced (発展) Block tutorial deck: the finished program is from the book's advanced section"
            id="gui.howtos.book-promo.advancedClosing.title"
            values={{chapter}}
        />
    ),
    image,
    externalUrl: BOOK_URL,
    externalUrlLabel: (
        <FormattedMessage
            defaultMessage="📖 書籍を購入する"
            description="Button label to open the book purchase page"
            id="gui.howtos.book-promo.purchase"
        />
    ),
});
