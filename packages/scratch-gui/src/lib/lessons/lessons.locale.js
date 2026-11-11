// Locale strings for the lessons (コース › レッスン › チャレンジ).
// Kept next to the course data (like the tutorial category modules, #932) and
// spread into src/locales/{en,ja,ja-Hira}.js. Keys: `gui.lessons.<course|lesson|challenge>.<field>`.

export const ja = {
    'gui.lessons.course.kyou-kara-programmer.name': 'きょうからプログラマー',
    'gui.lessons.course.kyou-kara-programmer.badge': 'プログラマー デビュー！',
    'gui.lessons.lesson.blocks-l1.name': 'ブロックのなかま',
    'gui.lessons.challenge.blocks-l1-key-sound.name': 'キーで音を鳴らそう',
    'gui.lessons.challenge.blocks-l1-arrow-move.name': '矢印キーで動かそう',
    'gui.lessons.challenge.blocks-l1-click-say.name': '押したら話そう',
    'gui.lessons.challenge.blocks-l1-click-say.task': 'ネコを押したら「こんにちは！」と言うようにしよう',
    'gui.lessons.challenge.blocks-l1-click-say.step1':
        '上の「コスチューム」タブを開いて、左下のボタンから好きなコスチュームを足そう。えらんでも、筆で描いてもいいよ。',
    'gui.lessons.challenge.blocks-l1-click-say.step2':
        '「コード」タブにもどって、「押されたとき」のブロックをコードエリアへドラッグしよう。',
    'gui.lessons.challenge.blocks-l1-click-say.step3':
        '紫の「見た目」のブロックをくっつけて、白いところをクリックして「こんにちは！」と書こう。',
    'gui.lessons.challenge.blocks-l1-click-say.step4': 'その下に、これもくっつけよう。',
    'gui.lessons.challenge.blocks-l1-click-say.step5': 'ステージのネコをクリックしてみよう。',
    'gui.lessons.challenge.blocks-l1-click-say.step6': 'いらないブロックは、パレットへドラッグしてもどすと消えるよ。',
    'gui.lessons.challenge.blocks-l1-click-say.debug1': '何も起きないときは、ステージのネコそのものを押しているか見よう。',
    'gui.lessons.challenge.blocks-l1-click-say.debug2':
        'プログラムを入れたスプライトと、押したスプライトが同じか、右下のスプライトリストで確かめよう。',
    'gui.lessons.challenge.blocks-l1-repeat.name': 'くり返そう',
    'gui.lessons.challenge.blocks-l1-if.name': 'もし〜なら',
    'gui.lessons.skill.if': 'もし〜なら',
    'gui.lessons.skill.forever': 'ずっと',
    'gui.lessons.skill.touching': 'さわったか調べる',
    'gui.lessons.challenge.blocks-l1-if.task': 'マウスでネコにさわったら「くすぐったい！」、さわっていないときは「さわってみて」と言うようにしよう',
    'gui.lessons.challenge.blocks-l1-if.step1': '旗のブロックの下に「ずっと」をつなげよう。',
    'gui.lessons.challenge.blocks-l1-if.step2': '「ずっと」の中に「もし〜なら でなければ」を入れよう。',
    'gui.lessons.challenge.blocks-l1-if.step3': '水色の「調べる」から、六角形のブロックを「もし」の六角形の穴に入れよう。',
    'gui.lessons.challenge.blocks-l1-if.step4': '上と下に「言う」を入れて、それぞれのセリフを書こう。',
    'gui.lessons.challenge.blocks-l1-if.step5': '旗を押して、マウスをネコに重ねたり、はなしたりしよう。止めるときは赤い●。',
    'gui.lessons.challenge.blocks-l1-if.debug1': 'セリフがかわらないときは、「言う」が「もし」の中と「でなければ」の中に 1 つずつ入っているか見よう。',
    'gui.lessons.challenge.blocks-l1-if.debug2': '1 回しか調べないときは、「ずっと」の中に入っているか見よう。',
    'gui.lessons.challenge.blocks-l1-ask-answer.name': '聞いて答えよう',
    'gui.lessons.skill.ask-answer': '聞いて答える',
    'gui.lessons.skill.timer': 'タイマー',
    'gui.lessons.skill.join': 'ことばをつなぐ',
    'gui.lessons.challenge.blocks-l1-ask-answer.task': 'ネコを押したら名前を聞いて、答えた名前と、答えるまでにかかった秒数を言うようにしよう',
    'gui.lessons.challenge.blocks-l1-ask-answer.step1': '水色の「調べる」の「聞いて待つ」をつなげて、「なまえは？」と書こう。',
    'gui.lessons.challenge.blocks-l1-ask-answer.step2': '「言う」をつなげて、白いところに、丸い「答え」のブロックを入れよう。',
    'gui.lessons.challenge.blocks-l1-ask-answer.step3': '聞く前に「タイマーをリセット」を入れよう。タイマーは 0 から数えはじめるよ。',
    'gui.lessons.challenge.blocks-l1-ask-answer.step4': '緑の「演算」の「と」で、丸い「タイマー」と「秒でした」をつないで、もう 1 つの「言う」に入れよう。',
    'gui.lessons.challenge.blocks-l1-ask-answer.step5': 'ネコを押して、下に出る入力らんに名前を書いて ✓ を押そう。',
    'gui.lessons.challenge.blocks-l1-ask-answer.debug1': '「答え」という文字を言ってしまうときは、文字を書いたのではなく、丸い「答え」のブロックを入れたか見よう。',
    'gui.lessons.challenge.blocks-l1-ask-answer.debug2': '秒数がとても大きいときは、「タイマーをリセット」が「聞いて待つ」の前にあるか見よう。',
    'gui.lessons.challenge.blocks-l1-quiz.name': 'クイズを作ろう',
    'gui.lessons.skill.compare': 'くらべる',
    'gui.lessons.challenge.blocks-l1-quiz.task': 'ネコを押したら「4＋3＝？」と聞いて、7 なら「正解です」、ちがえば「ちがいます」と言うようにしよう',
    'gui.lessons.challenge.blocks-l1-quiz.step1': '「聞いて待つ」で問題を出そう。',
    'gui.lessons.challenge.blocks-l1-quiz.step2': '緑の「演算」の「=」を、「もし」の穴に入れよう。',
    'gui.lessons.challenge.blocks-l1-quiz.step3': '「=」の左に「答え」、右に 7 を入れよう。',
    'gui.lessons.challenge.blocks-l1-quiz.step4': '7 と、7 じゃない数の両方をためそう。',
    'gui.lessons.challenge.blocks-l1-quiz.debug1': 'いつも「ちがいます」になるときは、「=」の左に「答え」、右に 7 が入っているか見よう。数は半角の 7 で入れよう。',
    'gui.lessons.challenge.blocks-l1-count.name': '数えよう',
    'gui.lessons.skill.make-variable': '変数を作る',
    'gui.lessons.skill.variable': '変数',
    'gui.lessons.challenge.blocks-l1-count.task': 'ネコを押した回数を数えて、その数を言うようにしよう。3 回押してみよう',
    'gui.lessons.challenge.blocks-l1-count.step1': 'オレンジの「変数」で「変数を作る」を押して、「回数」という変数を作ろう。',
    'gui.lessons.challenge.blocks-l1-count.step2': '旗を押したら 0 にもどすプログラムを作ろう。',
    'gui.lessons.challenge.blocks-l1-count.step3': '押されたら 1 ふやして、その数を言うプログラムを作ろう。',
    'gui.lessons.challenge.blocks-l1-count.step4': '旗を押してから、ネコを 3 回押そう。ステージの左上にも数が出るよ。',
    'gui.lessons.challenge.blocks-l1-count.debug1': '押すたびに 1 にもどるときは、「0 にする」が「押されたとき」のほうに入っていないか見よう。',
    'gui.lessons.challenge.blocks-l1-broadcast.name': 'なかまに合図しよう',
    'gui.lessons.challenge.blocks-l1-speak.name': 'しゃべらせよう',
    'gui.lessons.challenge.blocks-l1-message-list.name': 'メッセージをためよう',
    // チャレンジ 9〜11
    'gui.lessons.challenge.blocks-l1-broadcast.task':
        'ペンギンを足して、ネコを押したらペンギンが「やあ！」と言うようにしよう',
    'gui.lessons.skill.add-sprite': 'スプライトを足す',
    'gui.lessons.skill.broadcast': '合図（メッセージ）',
    'gui.lessons.skill.sprite-program': 'スプライトごとのプログラム',
    'gui.lessons.challenge.blocks-l1-broadcast.step1': '右下の「スプライトを選ぶ」から、ペンギンを足そう。',
    'gui.lessons.challenge.blocks-l1-broadcast.step2':
        'ネコをえらんで、「押されたとき」と「送る」をつなげよう。▼の「新しいメッセージ」で「あいさつ」を作ろう。',
    'gui.lessons.challenge.blocks-l1-broadcast.step3':
        'ペンギンをえらぶと、コードエリアが空になるよ。プログラムはスプライトごとにあるんだ。',
    'gui.lessons.challenge.blocks-l1-broadcast.step4': 'ペンギンに「受け取ったとき」と「言う」をつなげよう。',
    'gui.lessons.challenge.blocks-l1-broadcast.step5': 'ネコを押してみよう。',
    'gui.lessons.challenge.blocks-l1-broadcast.debug1':
        'ペンギンが言わないときは、「送る」と「受け取ったとき」のメッセージの名前が同じか見よう。',
    'gui.lessons.challenge.blocks-l1-broadcast.debug2': 'ペンギンのプログラムを、ネコに書いていないかも見よう。',
    'gui.lessons.challenge.blocks-l1-speak.task':
        '拡張機能「音声合成」を足して、ネコを押したら「ボタンが押されました」としゃべるようにしよう',
    'gui.lessons.skill.add-extension': '拡張機能を足す',
    'gui.lessons.skill.text2speech': '音声合成',
    'gui.lessons.challenge.blocks-l1-speak.step1':
        '左下のボタンから「音声合成」をえらぼう。パレットに新しいなかまがふえるよ。',
    'gui.lessons.challenge.blocks-l1-speak.step2': '「押されたとき」に「しゃべる」をつなげて、ことばを書こう。',
    'gui.lessons.challenge.blocks-l1-speak.step3': 'ネコを押してみよう。',
    'gui.lessons.challenge.blocks-l1-speak.debug1':
        '声が出ないときは、パソコンの音量を見よう。音声合成はインターネットにつながっていないと使えないよ。',
    'gui.lessons.challenge.blocks-l1-message-list.task':
        'ネコを押したら「メッセージは？」と聞いて、答えをリスト「トーク」にためよう。3 つためてみよう',
    'gui.lessons.skill.make-list': 'リストを作る',
    'gui.lessons.skill.add-to-list': 'リストに追加する',
    'gui.lessons.challenge.blocks-l1-message-list.step1':
        '「変数」の下の「リストを作る」を押して、「トーク」というリストを作ろう。ステージに空の箱が出るよ。',
    'gui.lessons.challenge.blocks-l1-message-list.step2': '旗を押したら、トークを空にするプログラムを作ろう。',
    'gui.lessons.challenge.blocks-l1-message-list.step3':
        '押されたら聞いて、答えをトークに追加するプログラムを作ろう。',
    'gui.lessons.challenge.blocks-l1-message-list.step4':
        '旗を押してから、ネコを 3 回押して、メッセージを書こう。ステージの箱に、書いた順にたまっていくよ。',
    'gui.lessons.challenge.blocks-l1-message-list.debug1':
        '1 つしかたまらないときは、「すべてを削除する」が「押されたとき」のほうに入っていないか見よう。',
    'gui.lessons.challenge.blocks-l1-message-list.debug2':
        '「答え」という文字がたまるときは、丸い「答え」のブロックを入れたか見よう。',
    'gui.lessons.completed.title': 'できた！',
    'gui.lessons.completed.skills': 'できること: {skills}',
    'gui.lessons.completed.close': '閉じる',
};

export const jaHira = {
    'gui.lessons.course.kyou-kara-programmer.name': 'きょうからプログラマー',
    'gui.lessons.course.kyou-kara-programmer.badge': 'プログラマー デビュー！',
    'gui.lessons.lesson.blocks-l1.name': 'ブロックのなかま',
    'gui.lessons.challenge.blocks-l1-key-sound.name': 'キーでおとをならそう',
    'gui.lessons.challenge.blocks-l1-arrow-move.name': 'やじるしキーでうごかそう',
    'gui.lessons.challenge.blocks-l1-click-say.name': 'おしたらはなそう',
    'gui.lessons.challenge.blocks-l1-click-say.task': 'ネコをおしたら「こんにちは！」というようにしよう',
    'gui.lessons.challenge.blocks-l1-click-say.step1':
        'うえの「コスチューム」タブをひらいて、ひだりしたのボタンからすきなコスチュームをたそう。えらんでも、ふででかいてもいいよ。',
    'gui.lessons.challenge.blocks-l1-click-say.step2':
        '「コード」タブにもどって、「おされたとき」のブロックをコードエリアへドラッグしよう。',
    'gui.lessons.challenge.blocks-l1-click-say.step3':
        'むらさきの「みため」のブロックをくっつけて、しろいところをクリックして「こんにちは！」とかこう。',
    'gui.lessons.challenge.blocks-l1-click-say.step4': 'そのしたに、これもくっつけよう。',
    'gui.lessons.challenge.blocks-l1-click-say.step5': 'ステージのネコをクリックしてみよう。',
    'gui.lessons.challenge.blocks-l1-click-say.step6': 'いらないブロックは、パレットへドラッグしてもどすときえるよ。',
    'gui.lessons.challenge.blocks-l1-click-say.debug1': 'なにもおきないときは、ステージのネコそのものをおしているかみよう。',
    'gui.lessons.challenge.blocks-l1-click-say.debug2':
        'プログラムをいれたスプライトと、おしたスプライトがおなじか、みぎしたのスプライトリストでたしかめよう。',
    'gui.lessons.challenge.blocks-l1-repeat.name': 'くりかえそう',
    'gui.lessons.challenge.blocks-l1-if.name': 'もし〜なら',
    'gui.lessons.skill.if': 'もし〜なら',
    'gui.lessons.skill.forever': 'ずっと',
    'gui.lessons.skill.touching': 'さわったかしらべる',
    'gui.lessons.challenge.blocks-l1-if.task': 'マウスでネコにさわったら「くすぐったい！」、さわっていないときは「さわってみて」というようにしよう',
    'gui.lessons.challenge.blocks-l1-if.step1': 'はたのブロックのしたに「ずっと」をつなげよう。',
    'gui.lessons.challenge.blocks-l1-if.step2': '「ずっと」のなかに「もし〜なら でなければ」をいれよう。',
    'gui.lessons.challenge.blocks-l1-if.step3': 'みずいろの「しらべる」から、ろっかっけいのブロックを「もし」のろっかっけいのあなにいれよう。',
    'gui.lessons.challenge.blocks-l1-if.step4': 'うえとしたに「いう」をいれて、それぞれのセリフをかこう。',
    'gui.lessons.challenge.blocks-l1-if.step5': 'はたをおして、マウスをネコにかさねたり、はなしたりしよう。とめるときはあかい●。',
    'gui.lessons.challenge.blocks-l1-if.debug1': 'セリフがかわらないときは、「いう」が「もし」のなかと「でなければ」のなかに 1 つずつはいっているかみよう。',
    'gui.lessons.challenge.blocks-l1-if.debug2': '1 かいしかしらべないときは、「ずっと」のなかにはいっているかみよう。',
    'gui.lessons.challenge.blocks-l1-ask-answer.name': 'きいてこたえよう',
    'gui.lessons.skill.ask-answer': 'きいてこたえる',
    'gui.lessons.skill.timer': 'タイマー',
    'gui.lessons.skill.join': 'ことばをつなぐ',
    'gui.lessons.challenge.blocks-l1-ask-answer.task': 'ネコをおしたらなまえをきいて、こたえたなまえと、こたえるまでにかかったびょうすうをいうようにしよう',
    'gui.lessons.challenge.blocks-l1-ask-answer.step1': 'みずいろの「しらべる」の「きいてまつ」をつなげて、「なまえは？」とかこう。',
    'gui.lessons.challenge.blocks-l1-ask-answer.step2': '「いう」をつなげて、しろいところに、まるい「こたえ」のブロックをいれよう。',
    'gui.lessons.challenge.blocks-l1-ask-answer.step3': 'きくまえに「タイマーをリセット」をいれよう。タイマーは 0 からかぞえはじめるよ。',
    'gui.lessons.challenge.blocks-l1-ask-answer.step4': 'みどりの「えんざん」の「と」で、まるい「タイマー」と「びょうでした」をつないで、もう 1 つの「いう」にいれよう。',
    'gui.lessons.challenge.blocks-l1-ask-answer.step5': 'ネコをおして、したにでるにゅうりょくらんになまえをかいて ✓ をおそう。',
    'gui.lessons.challenge.blocks-l1-ask-answer.debug1': '「こたえ」というもじをいってしまうときは、もじをかいたのではなく、まるい「こたえ」のブロックをいれたかみよう。',
    'gui.lessons.challenge.blocks-l1-ask-answer.debug2': 'びょうすうがとてもおおきいときは、「タイマーをリセット」が「きいてまつ」のまえにあるかみよう。',
    'gui.lessons.challenge.blocks-l1-quiz.name': 'クイズをつくろう',
    'gui.lessons.skill.compare': 'くらべる',
    'gui.lessons.challenge.blocks-l1-quiz.task': 'ネコをおしたら「4＋3＝？」ときいて、7 なら「せいかいです」、ちがえば「ちがいます」というようにしよう',
    'gui.lessons.challenge.blocks-l1-quiz.step1': '「きいてまつ」でもんだいをだそう。',
    'gui.lessons.challenge.blocks-l1-quiz.step2': 'みどりの「えんざん」の「=」を、「もし」のあなにいれよう。',
    'gui.lessons.challenge.blocks-l1-quiz.step3': '「=」のひだりに「こたえ」、みぎに 7 をいれよう。',
    'gui.lessons.challenge.blocks-l1-quiz.step4': '7 と、7 じゃないかずのりょうほうをためそう。',
    'gui.lessons.challenge.blocks-l1-quiz.debug1': 'いつも「ちがいます」になるときは、「=」のひだりに「こたえ」、みぎに 7 がはいっているかみよう。かずははんかくの 7 でいれよう。',
    'gui.lessons.challenge.blocks-l1-count.name': 'かぞえよう',
    'gui.lessons.skill.make-variable': 'へんすうをつくる',
    'gui.lessons.skill.variable': 'へんすう',
    'gui.lessons.challenge.blocks-l1-count.task': 'ネコをおしたかいすうをかぞえて、そのかずをいうようにしよう。3 かいおしてみよう',
    'gui.lessons.challenge.blocks-l1-count.step1': 'オレンジの「へんすう」で「へんすうをつくる」をおして、「かいすう」というへんすうをつくろう。',
    'gui.lessons.challenge.blocks-l1-count.step2': 'はたをおしたら 0 にもどすプログラムをつくろう。',
    'gui.lessons.challenge.blocks-l1-count.step3': 'おされたら 1 ふやして、そのかずをいうプログラムをつくろう。',
    'gui.lessons.challenge.blocks-l1-count.step4': 'はたをおしてから、ネコを 3 かいおそう。ステージのひだりうえにもかずがでるよ。',
    'gui.lessons.challenge.blocks-l1-count.debug1': 'おすたびに 1 にもどるときは、「0 にする」が「おされたとき」のほうにはいっていないかみよう。',
    'gui.lessons.challenge.blocks-l1-broadcast.name': 'なかまにあいずしよう',
    'gui.lessons.challenge.blocks-l1-speak.name': 'しゃべらせよう',
    'gui.lessons.challenge.blocks-l1-message-list.name': 'メッセージをためよう',
    // チャレンジ 9〜11
    'gui.lessons.challenge.blocks-l1-broadcast.task':
        'ペンギンをたして、ネコをおしたらペンギンが「やあ！」というようにしよう',
    'gui.lessons.skill.add-sprite': 'スプライトをたす',
    'gui.lessons.skill.broadcast': 'あいず（メッセージ）',
    'gui.lessons.skill.sprite-program': 'スプライトごとのプログラム',
    'gui.lessons.challenge.blocks-l1-broadcast.step1': 'みぎしたの「スプライトをえらぶ」から、ペンギンをたそう。',
    'gui.lessons.challenge.blocks-l1-broadcast.step2':
        'ネコをえらんで、「おされたとき」と「おくる」をつなげよう。▼の「あたらしいメッセージ」で「あいさつ」をつくろう。',
    'gui.lessons.challenge.blocks-l1-broadcast.step3':
        'ペンギンをえらぶと、コードエリアがからになるよ。プログラムはスプライトごとにあるんだ。',
    'gui.lessons.challenge.blocks-l1-broadcast.step4': 'ペンギンに「うけとったとき」と「いう」をつなげよう。',
    'gui.lessons.challenge.blocks-l1-broadcast.step5': 'ネコをおしてみよう。',
    'gui.lessons.challenge.blocks-l1-broadcast.debug1':
        'ペンギンがいわないときは、「おくる」と「うけとったとき」のメッセージのなまえがおなじかみよう。',
    'gui.lessons.challenge.blocks-l1-broadcast.debug2': 'ペンギンのプログラムを、ネコにかいていないかもみよう。',
    'gui.lessons.challenge.blocks-l1-speak.task':
        'かくちょうきのう「おんせいごうせい」をたして、ネコをおしたら「ボタンがおされました」としゃべるようにしよう',
    'gui.lessons.skill.add-extension': 'かくちょうきのうをたす',
    'gui.lessons.skill.text2speech': 'おんせいごうせい',
    'gui.lessons.challenge.blocks-l1-speak.step1':
        'ひだりしたのボタンから「おんせいごうせい」をえらぼう。パレットにあたらしいなかまがふえるよ。',
    'gui.lessons.challenge.blocks-l1-speak.step2': '「おされたとき」に「しゃべる」をつなげて、ことばをかこう。',
    'gui.lessons.challenge.blocks-l1-speak.step3': 'ネコをおしてみよう。',
    'gui.lessons.challenge.blocks-l1-speak.debug1':
        'こえがでないときは、パソコンのおんりょうをみよう。おんせいごうせいはインターネットにつながっていないとつかえないよ。',
    'gui.lessons.challenge.blocks-l1-message-list.task':
        'ネコをおしたら「メッセージは？」ときいて、こたえをリスト「トーク」にためよう。3 つためてみよう',
    'gui.lessons.skill.make-list': 'リストをつくる',
    'gui.lessons.skill.add-to-list': 'リストについかする',
    'gui.lessons.challenge.blocks-l1-message-list.step1':
        '「へんすう」のしたの「リストをつくる」をおして、「トーク」というリストをつくろう。ステージにからのはこがでるよ。',
    'gui.lessons.challenge.blocks-l1-message-list.step2': 'はたをおしたら、トークをからにするプログラムをつくろう。',
    'gui.lessons.challenge.blocks-l1-message-list.step3':
        'おされたらきいて、こたえをトークについかするプログラムをつくろう。',
    'gui.lessons.challenge.blocks-l1-message-list.step4':
        'はたをおしてから、ネコを 3 かいおして、メッセージをかこう。ステージのはこに、かいたじゅんにたまっていくよ。',
    'gui.lessons.challenge.blocks-l1-message-list.debug1':
        '1 つしかたまらないときは、「すべてをさくじょする」が「おされたとき」のほうにはいっていないかみよう。',
    'gui.lessons.challenge.blocks-l1-message-list.debug2':
        '「こたえ」というもじがたまるときは、まるい「こたえ」のブロックをいれたかみよう。',
    'gui.lessons.completed.title': 'できた！',
    'gui.lessons.completed.skills': 'できること: {skills}',
    'gui.lessons.completed.close': 'とじる',
};

export const en = {
    'gui.lessons.course.kyou-kara-programmer.name': 'Programmer from Today',
    'gui.lessons.course.kyou-kara-programmer.badge': 'Programmer Debut!',
    'gui.lessons.lesson.blocks-l1.name': 'Block Families',
    'gui.lessons.challenge.blocks-l1-key-sound.name': 'Play a sound with a key',
    'gui.lessons.challenge.blocks-l1-arrow-move.name': 'Move with the arrow keys',
    'gui.lessons.challenge.blocks-l1-click-say.name': 'Talk when clicked',
    'gui.lessons.challenge.blocks-l1-click-say.task': 'Make the cat say "Hello!" when it is clicked',
    'gui.lessons.challenge.blocks-l1-click-say.step1':
        'Open the "Costumes" tab at the top and add a costume you like with the button at the bottom left. Choose one, or paint one.',
    'gui.lessons.challenge.blocks-l1-click-say.step2':
        'Go back to the "Code" tab and drag the "when this sprite clicked" block into the code area.',
    'gui.lessons.challenge.blocks-l1-click-say.step3':
        'Snap on the purple "Looks" block, click the white part, and type "Hello!".',
    'gui.lessons.challenge.blocks-l1-click-say.step4': 'Snap this one on underneath.',
    'gui.lessons.challenge.blocks-l1-click-say.step5': 'Click the cat on the stage.',
    'gui.lessons.challenge.blocks-l1-click-say.step6': 'To remove a block you do not need, drag it back to the palette.',
    'gui.lessons.challenge.blocks-l1-click-say.debug1': 'If nothing happens, check that you are clicking the cat itself on the stage.',
    'gui.lessons.challenge.blocks-l1-click-say.debug2':
        'Check in the sprite list at the bottom right that the sprite with the program is the one you clicked.',
    'gui.lessons.challenge.blocks-l1-repeat.name': 'Repeat',
    'gui.lessons.challenge.blocks-l1-if.name': 'If ...',
    'gui.lessons.skill.if': 'If ... else',
    'gui.lessons.skill.forever': 'Forever',
    'gui.lessons.skill.touching': 'Check what it touches',
    'gui.lessons.challenge.blocks-l1-if.task': 'Make the cat say "That tickles!" when the mouse touches it, and "Touch me" when it does not',
    'gui.lessons.challenge.blocks-l1-if.step1': 'Snap "forever" under the green flag block.',
    'gui.lessons.challenge.blocks-l1-if.step2': 'Put "if ... then ... else" inside "forever".',
    'gui.lessons.challenge.blocks-l1-if.step3': 'From the light blue "Sensing", put the hexagon block into the hexagon hole of "if".',
    'gui.lessons.challenge.blocks-l1-if.step4': 'Put a "say" block in the top and the bottom, and type each line.',
    'gui.lessons.challenge.blocks-l1-if.step5': 'Click the green flag, then move the mouse onto the cat and away again. Click the red ● to stop.',
    'gui.lessons.challenge.blocks-l1-if.debug1': 'If the line does not change, check that there is one "say" inside "if" and one inside "else".',
    'gui.lessons.challenge.blocks-l1-if.debug2': 'If it checks only once, check that the blocks are inside "forever".',
    'gui.lessons.challenge.blocks-l1-ask-answer.name': 'Ask and answer',
    'gui.lessons.skill.ask-answer': 'Ask and answer',
    'gui.lessons.skill.timer': 'Timer',
    'gui.lessons.skill.join': 'Join words',
    'gui.lessons.challenge.blocks-l1-ask-answer.task': 'Make the cat ask your name when it is clicked, then say the name and how many seconds you took to answer',
    'gui.lessons.challenge.blocks-l1-ask-answer.step1': 'Snap on "ask and wait" from the light blue "Sensing", and type "What\'s your name?".',
    'gui.lessons.challenge.blocks-l1-ask-answer.step2': 'Snap on a "say" block, and put the round "answer" block into its white part.',
    'gui.lessons.challenge.blocks-l1-ask-answer.step3': 'Put "reset timer" before asking. The timer starts counting from 0.',
    'gui.lessons.challenge.blocks-l1-ask-answer.step4': 'Use "join" from the green "Operators" to join the round "timer" and " seconds", and put it into another "say".',
    'gui.lessons.challenge.blocks-l1-ask-answer.step5': 'Click the cat, type your name in the box that appears at the bottom, and click ✓.',
    'gui.lessons.challenge.blocks-l1-ask-answer.debug1': 'If the cat says the word "answer", check that you put in the round "answer" block instead of typing the word.',
    'gui.lessons.challenge.blocks-l1-ask-answer.debug2': 'If the seconds are very large, check that "reset timer" comes before "ask and wait".',
    'gui.lessons.challenge.blocks-l1-quiz.name': 'Make a quiz',
    'gui.lessons.skill.compare': 'Compare',
    'gui.lessons.challenge.blocks-l1-quiz.task': 'Make the cat ask "4+3=?" when it is clicked, and say "Correct" for 7 and "Wrong" for anything else',
    'gui.lessons.challenge.blocks-l1-quiz.step1': 'Ask the question with "ask and wait".',
    'gui.lessons.challenge.blocks-l1-quiz.step2': 'Put the "=" from the green "Operators" into the hole of "if".',
    'gui.lessons.challenge.blocks-l1-quiz.step3': 'Put "answer" on the left of "=", and 7 on the right.',
    'gui.lessons.challenge.blocks-l1-quiz.step4': 'Try both 7 and a number that is not 7.',
    'gui.lessons.challenge.blocks-l1-quiz.debug1': 'If it always says "Wrong", check that "answer" is on the left of "=" and 7 is on the right. Type 7 as a half-width number.',
    'gui.lessons.challenge.blocks-l1-count.name': 'Count',
    'gui.lessons.skill.make-variable': 'Make a variable',
    'gui.lessons.skill.variable': 'Variables',
    'gui.lessons.challenge.blocks-l1-count.task': 'Count how many times the cat is clicked, and make it say the number. Try clicking it 3 times',
    'gui.lessons.challenge.blocks-l1-count.step1': 'In the orange "Variables", click "Make a Variable" and make a variable named "回数" (count).',
    'gui.lessons.challenge.blocks-l1-count.step2': 'Make a program that sets it back to 0 when the green flag is clicked.',
    'gui.lessons.challenge.blocks-l1-count.step3': 'Make a program that adds 1 when the cat is clicked, and says the number.',
    'gui.lessons.challenge.blocks-l1-count.step4': 'Click the green flag, then click the cat 3 times. The number also shows at the top left of the stage.',
    'gui.lessons.challenge.blocks-l1-count.debug1': 'If it goes back to 1 every time, check that "set to 0" is not under "when this sprite clicked".',
    'gui.lessons.challenge.blocks-l1-broadcast.name': 'Signal a friend',
    'gui.lessons.challenge.blocks-l1-speak.name': 'Make it speak',
    'gui.lessons.challenge.blocks-l1-message-list.name': 'Collect messages',
    // チャレンジ 9〜11
    'gui.lessons.challenge.blocks-l1-broadcast.task':
        'Add a penguin, and make the penguin say "やあ！" (Hi!) when the cat is clicked',
    'gui.lessons.skill.add-sprite': 'Add a sprite',
    'gui.lessons.skill.broadcast': 'Broadcast messages',
    'gui.lessons.skill.sprite-program': 'A program for each sprite',
    'gui.lessons.challenge.blocks-l1-broadcast.step1': 'Add a penguin with "Choose a Sprite" at the bottom right.',
    'gui.lessons.challenge.blocks-l1-broadcast.step2':
        'Select the cat and snap "when this sprite clicked" and "broadcast" together. Choose "New message" from ▼ and make "あいさつ" (hello).',
    'gui.lessons.challenge.blocks-l1-broadcast.step3':
        'When you select the penguin, the code area becomes empty. Each sprite has its own program.',
    'gui.lessons.challenge.blocks-l1-broadcast.step4': 'Snap "when I receive" and "say" together for the penguin.',
    'gui.lessons.challenge.blocks-l1-broadcast.step5': 'Click the cat.',
    'gui.lessons.challenge.blocks-l1-broadcast.debug1':
        'If the penguin does not speak, check that the message in "broadcast" and in "when I receive" has the same name.',
    'gui.lessons.challenge.blocks-l1-broadcast.debug2':
        "Also check that you did not put the penguin's program on the cat.",
    'gui.lessons.challenge.blocks-l1-speak.task':
        'Add the "Text to Speech" extension, and make the cat speak "ボタンが押されました" (the button was clicked) when it is clicked',
    'gui.lessons.skill.add-extension': 'Add an extension',
    'gui.lessons.skill.text2speech': 'Text to Speech',
    'gui.lessons.challenge.blocks-l1-speak.step1':
        'Choose "Text to Speech" with the button at the bottom left. New blocks join the palette.',
    'gui.lessons.challenge.blocks-l1-speak.step2':
        'Snap "speak" under "when this sprite clicked" and type the words.',
    'gui.lessons.challenge.blocks-l1-speak.step3': 'Click the cat.',
    'gui.lessons.challenge.blocks-l1-speak.debug1':
        'If you hear nothing, check the volume of the computer. Text to Speech works only when it is connected to the Internet.',
    'gui.lessons.challenge.blocks-l1-message-list.task':
        'When the cat is clicked, ask "メッセージは？" (message?) and keep the answers in the list "トーク" (talk). Try keeping 3',
    'gui.lessons.skill.make-list': 'Make a list',
    'gui.lessons.skill.add-to-list': 'Add to a list',
    'gui.lessons.challenge.blocks-l1-message-list.step1':
        'Under "Variables", click "Make a List" and make a list named "トーク" (talk). An empty box appears on the stage.',
    'gui.lessons.challenge.blocks-l1-message-list.step2':
        'Make a program that empties トーク when the green flag is clicked.',
    'gui.lessons.challenge.blocks-l1-message-list.step3':
        'Make a program that asks when the cat is clicked and adds the answer to トーク.',
    'gui.lessons.challenge.blocks-l1-message-list.step4':
        'Click the green flag, then click the cat 3 times and type messages. They pile up in the box on the stage in the order you typed them.',
    'gui.lessons.challenge.blocks-l1-message-list.debug1':
        'If only one is kept, check that "delete all of" is not under "when this sprite clicked".',
    'gui.lessons.challenge.blocks-l1-message-list.debug2':
        'If the word "answer" is kept, check that you put in the round "answer" block.',
    'gui.lessons.completed.title': 'You did it!',
    'gui.lessons.completed.skills': 'Now you can: {skills}',
    'gui.lessons.completed.close': 'Close',
};
