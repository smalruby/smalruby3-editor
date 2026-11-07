// Students' troubles for the "生成AI に相談" prompt lab (#1283). Each one is a
// project as the Ruby generator writes it, with the sprites' sounds and costumes,
// and what a good answer should touch. Not run in CI.

const scenarios = [
    {
        id: 'forever-move',
        kind: 'not-working',
        text: '旗を押したらネコがずっと歩いてほしいのに、少しだけ動いて止まってしまう',
        editingName: 'ネコ',
        sprites: [
            {
                name: 'ネコ',
                sounds: ['ニャー'],
                costumes: ['コスチューム1', 'コスチューム2'],
                code: 'when_flag_clicked do\n  move(10)\n  next_costume\nend\n',
            },
        ],
        expect: { sprites: ['ネコ'] },
    },
    {
        id: 'click-sound',
        kind: 'how',
        text: 'Abby をクリックしたら音を鳴らしたい。どのブロックを使えばいい？',
        editingName: 'Abby',
        sprites: [
            {
                name: 'Abby',
                sounds: ['Pop', 'Chord'],
                costumes: ['abby-a', 'abby-b', 'abby-c'],
                code: 'when_flag_clicked do\n  go_to([0, 0])\n  say("こんにちは")\nend\n',
            },
        ],
        expect: { sprites: ['Abby'] },
    },
    {
        id: 'dance-together',
        kind: 'more-fun',
        text: 'Abby がおどったら、Dee もいっしょにおどるようにしたい',
        editingName: 'Abby',
        sprites: [
            {
                name: 'Abby',
                sounds: ['Pop'],
                costumes: ['abby-a', 'abby-b'],
                code: 'when_flag_clicked do\n  10.times do\n    next_costume\n    sleep(0.3)\n  end\nend\n',
            },
            {
                name: 'Dee',
                sounds: ['Dance Around', 'Meow'],
                costumes: ['dee-a', 'dee-b', 'dee-c'],
                code: 'when_flag_clicked do\n  go_to([100, 0])\nend\n',
            },
            { name: 'ステージ', sounds: ['pop'], costumes: ['背景1', 'Stage'], code: '' },
        ],
        expect: { sprites: ['Abby', 'Dee'] },
    },
    {
        id: 'bounce-edge',
        kind: 'how',
        text: 'ボールが画面の端に当たったら跳ね返るようにするには、どのブロックを使えばいい？',
        editingName: 'Ball',
        sprites: [
            {
                name: 'Ball',
                sounds: ['Boing'],
                costumes: ['ball-a', 'ball-b'],
                code: 'when_flag_clicked do\n  go_to([0, 0])\n  self.direction = 45\n  loop do\n    move(10)\n  end\nend\n',
            },
        ],
        expect: { sprites: ['Ball'] },
    },
    {
        id: 'score-apple',
        kind: 'next',
        text: 'リンゴを取るゲームを作っていて、ネコがリンゴに触れたら点数を1ふやしたい',
        editingName: 'ネコ',
        sprites: [
            {
                name: 'ネコ',
                sounds: ['ニャー'],
                costumes: ['コスチューム1', 'コスチューム2'],
                code:
                    'when_key_pressed("right arrow") do\n  self.x += 10\nend\n\n' +
                    'when_key_pressed("left arrow") do\n  self.x -= 10\nend\n',
            },
            {
                name: 'Apple',
                sounds: ['Chomp'],
                costumes: ['apple'],
                code: 'when_flag_clicked do\n  self.y = 180\n  loop do\n    self.y -= 5\n  end\nend\n',
            },
            {
                name: 'ステージ',
                sounds: [],
                costumes: ['背景1'],
                code: '$score = 0\n\nwhen_flag_clicked do\n  $score = 0\nend\n',
            },
        ],
        expect: { sprites: ['ネコ'] },
    },
    {
        id: 'walk-animation',
        kind: 'more-fun',
        text: '矢印キーで動くときに、歩いているように見せたい',
        editingName: 'Dog',
        sprites: [
            {
                name: 'Dog',
                sounds: ['Bark', 'Dog2'],
                costumes: ['dog2-a', 'dog2-b', 'dog2-c'],
                code:
                    'when_key_pressed("right arrow") do\n  self.direction = 90\n  move(10)\nend\n\n' +
                    'when_key_pressed("left arrow") do\n  self.direction = -90\n  move(10)\nend\n',
            },
        ],
        expect: { sprites: ['Dog'] },
    },
    {
        id: 'error-message',
        kind: 'error',
        text: 'スペースキーを押すと、ネコが「ゲームオーバー」と言うはずが何も言わない',
        editingName: 'ネコ',
        sprites: [
            {
                name: 'ネコ',
                sounds: ['ニャー'],
                costumes: ['コスチューム1', 'コスチューム2'],
                code: 'when_receive("ゲームオーバー") do\n  say("ゲームオーバー", 2)\nend\n',
            },
            {
                name: 'ステージ',
                sounds: [],
                costumes: ['背景1', '背景2'],
                code: 'when_flag_clicked do\n  switch_backdrop("背景1")\nend\n',
            },
        ],
        expect: { sprites: ['ネコ', 'ステージ'] },
    },
    {
        id: 'backdrop-change',
        kind: 'not-working',
        text: 'ゴールに着いたら背景を変えたいのに、背景が変わらない',
        editingName: 'ステージ',
        sprites: [
            {
                name: 'Runner',
                sounds: ['Pop'],
                costumes: ['runner-a'],
                code: 'when_flag_clicked do\n  self.x = -200\n  loop do\n    self.x += 5\n    if touching?("Goal")\n      broadcast("ゴール")\n    end\n  end\nend\n',
            },
            { name: 'Goal', sounds: [], costumes: ['flag'], code: 'when_flag_clicked do\n  self.x = 200\nend\n' },
            {
                name: 'ステージ',
                sounds: ['Win'],
                costumes: ['スタート', 'ゴール画面'],
                code: 'when_flag_clicked do\n  switch_backdrop("スタート")\nend\n',
            },
        ],
        expect: { sprites: ['ステージ'] },
    },
    {
        id: 'clone-rain',
        kind: 'more-fun',
        text: '雨つぶを 1 つだけでなく、たくさん上から降らせたい',
        editingName: 'Drop',
        sprites: [
            {
                name: 'Drop',
                sounds: ['Water Drop'],
                costumes: ['drop'],
                code: 'when_flag_clicked do\n  go_to([0, 180])\n  loop do\n    self.y -= 5\n  end\nend\n',
            },
        ],
        expect: { sprites: ['Drop'] },
    },
    {
        id: 'quiz-answer',
        kind: 'how',
        text: 'クイズを出して、答えが「東京」なら「正解！」と言わせたい。どのブロックを使えばいい？',
        editingName: 'Teacher',
        sprites: [
            {
                name: 'Teacher',
                sounds: ['Chord', 'Buzz Whir'],
                costumes: ['teacher-a', 'teacher-b'],
                code: 'when_flag_clicked do\n  say("クイズを出すよ", 2)\nend\n',
            },
        ],
        expect: { sprites: ['Teacher'] },
    },
    {
        id: 'countdown-timer',
        kind: 'next',
        text: '30 秒たったらゲームを終わりにして「おしまい」と表示したい',
        editingName: 'ステージ',
        sprites: [
            {
                name: 'ネコ',
                sounds: ['ニャー'],
                costumes: ['コスチューム1', 'コスチューム2'],
                code: 'when_key_pressed("space") do\n  move(20)\nend\n',
            },
            {
                name: 'ステージ',
                sounds: [],
                costumes: ['背景1'],
                code: 'when_flag_clicked do\n  switch_backdrop("背景1")\nend\n',
            },
        ],
        expect: { sprites: ['ステージ'] },
    },
];

export default scenarios;
