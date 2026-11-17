// === Smalruby: This file is Smalruby-specific (textbook of the course 「ことばを予想する AI をつくろう」) ===
// 「ことばを予想する AI をつくろう」の教科書（学習する文）と、5-1 で測るときの決まった書き出し。
// 文はすべて自作のあいさつ・会話（市販の教科書・試験問題の文・人の名前は使わない）。決まりは
// docs/lessons/design.md の「教科書の文」:
//   - 1 行に 1 文。文の終わりの文字（ja / ja-Hira は「。」、en は「.」）は文の最後にだけ置く（文をつくるのが
//     その文字で止まるため）
//   - 「こんにちは、今日はよろしく。」を入れる（4-3 の例: 「こんにちは」→「こんにちは、今日はよろしく。」）
//   - ja-Hira は漢字を使わない。3 つの locale で文の数と並びをそろえる（同じ行は同じ意味）
// セットアップ（setup.lists）でリスト「教科書」に入れる。生徒はここに自分の文を足す。

/** 文の終わりの文字（文をつくるのはこの文字で止まる）。 */
export const LM_END_CHAR = Object.freeze({ ja: '。', 'ja-Hira': '。', en: '.' });

/** 教科書の文（locale ごと）。 */
export const LM_TEXTBOOK = Object.freeze({
    ja: Object.freeze([
        'こんにちは、今日はよろしく。',
        'こんにちは、元気ですか。',
        'おはよう、今日もいい天気だね。',
        'おはようございます、よろしくお願いします。',
        'こんばんは、今日はおつかれさま。',
        'ありがとう、とてもうれしいです。',
        'どういたしまして、またね。',
        '今日は何をしようか。',
        '今日は公園に行きたいな。',
        '元気だよ、ありがとう。',
        'また明日ね、さようなら。',
        'よろしくね、いっしょにがんばろう。',
        'いい天気だから散歩しよう。',
        'おなかがすいたね。',
        'お昼ごはんは何にする。',
        'カレーが食べたいな。',
        'すごいね、よくできたね。',
        'だいじょうぶ、ゆっくりでいいよ。',
        'いっしょに帰ろう。',
        '今日は楽しかったね。',
        '明日もよろしくね。',
        'はじめまして、よろしくお願いします。',
        'わたしの好きな動物はねこです。',
        '好きな色は青です。',
        '今日は雨がふっているね。',
        'かさを持ってきたよ。',
        '何時に会おうか。',
        '三時に駅で会おう。',
        'わかった、待っているね。',
        'ごめんね、少しおくれます。',
    ]),
    'ja-Hira': Object.freeze([
        'こんにちは、きょうはよろしく。',
        'こんにちは、げんきですか。',
        'おはよう、きょうもいいてんきだね。',
        'おはようございます、よろしくおねがいします。',
        'こんばんは、きょうはおつかれさま。',
        'ありがとう、とてもうれしいです。',
        'どういたしまして、またね。',
        'きょうはなにをしようか。',
        'きょうはこうえんにいきたいな。',
        'げんきだよ、ありがとう。',
        'またあしたね、さようなら。',
        'よろしくね、いっしょにがんばろう。',
        'いいてんきだからさんぽしよう。',
        'おなかがすいたね。',
        'おひるごはんはなににする。',
        'カレーがたべたいな。',
        'すごいね、よくできたね。',
        'だいじょうぶ、ゆっくりでいいよ。',
        'いっしょにかえろう。',
        'きょうはたのしかったね。',
        'あしたもよろしくね。',
        'はじめまして、よろしくおねがいします。',
        'わたしのすきなどうぶつはねこです。',
        'すきないろはあおです。',
        'きょうはあめがふっているね。',
        'かさをもってきたよ。',
        'なんじにあおうか。',
        'さんじにえきであおう。',
        'わかった、まっているね。',
        'ごめんね、すこしおくれます。',
    ]),
    en: Object.freeze([
        'Hello, nice to meet you.',
        'Hello, I am fine today.',
        'Good morning, it is a nice day.',
        'Good morning, let us work hard.',
        'Good evening, you did well today.',
        'Thank you, I am so happy.',
        'You are welcome, see you.',
        'Let us play today.',
        'I want to go to the park today.',
        'I am fine, thank you.',
        'See you tomorrow, good bye.',
        'Nice to see you, let us try.',
        'It is sunny, let us take a walk.',
        'I am hungry now.',
        'Let us have lunch together.',
        'I want to eat curry.',
        'Great, you did it.',
        'It is okay, take your time.',
        'Let us go home together.',
        'Today was fun.',
        'See you again tomorrow.',
        'Nice to meet you too.',
        'My favorite animal is a cat.',
        'My favorite color is blue.',
        'It is raining today.',
        'I brought my umbrella.',
        'Let us meet at three.',
        'Let us meet at the station.',
        'Okay, I will wait for you.',
        'Sorry, I will be a little late.',
    ]),
});

/**
 * 5-1 で測る、決まった 10 の書き出し（locale ごと）。最初の教科書では、見る長さ 2 で文を続けられる（書き出しの
 * 最後の文脈を学習している）ものと、続けられないものが混ざるようにしてある。続けられないものは、生徒が文を足すと
 * 続けられるようになる（データを増やすとかしこくなる、を数で確かめる）。
 */
export const LM_PROMPTS = Object.freeze({
    ja: Object.freeze(['こんに', 'おは', '今日は', 'ありが', 'また', '好きな', 'ぼくは', '明日は', 'ねこが', '雨の']),
    'ja-Hira': Object.freeze([
        'こんに',
        'おは',
        'きょうは',
        'ありが',
        'また',
        'すきな',
        'ぼくは',
        'あしたは',
        'ねこが',
        'あめの',
    ]),
    en: Object.freeze(['Hel', 'Good m', 'Today', 'Thank', 'See', 'My fav', 'Pizza', 'Tomor', 'The fox', 'Jazz']),
});
