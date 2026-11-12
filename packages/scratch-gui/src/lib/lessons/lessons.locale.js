// Locale strings for the lessons (コース › レッスン › チャレンジ).
// Kept next to the course data (like the tutorial category modules, #932) and
// spread into src/locales/{en,ja,ja-Hira}.js. Keys: `gui.lessons.<course|lesson|challenge>.<field>`.

export const ja = {
    'gui.lessons.course.kyou-kara-programmer.name': 'きょうからプログラマー',
    'gui.lessons.lesson.blocks-l1.name': 'うごかしてみよう',
    'gui.lessons.lesson.blocks-l2.name': 'えらんで たずねよう',
    'gui.lessons.lesson.blocks-l3.name': 'おぼえて つたえよう',
    'gui.lessons.challenge.blocks-l1-key-sound.name': 'キーで音を鳴らそう',
    'gui.lessons.challenge.blocks-l1-key-sound.task':
        'スペースキーを押したら、\nネコが「ニャー」と鳴いたあと、「Owl」の音が鳴るようにしよう',
    'gui.lessons.challenge.blocks-l1-key-sound.step1': '上の「音」タブを開いて、左下のボタンから「Owl」をえらんで足そう。',
    'gui.lessons.challenge.blocks-l1-key-sound.step2':
        '「コード」タブにもどって、黄色い「イベント」のブロックをコードエリアへドラッグしよう。',
    'gui.lessons.challenge.blocks-l1-key-sound.step3': 'このブロックを、下にくっつけよう。カチッとはまれば OK。',
    'gui.lessons.challenge.blocks-l1-key-sound.step4': 'もう 1 つ音のブロックをつなげて、▼で「Owl」をえらぼう。',
    'gui.lessons.challenge.blocks-l1-key-sound.step5': 'スペースキーを押してみよう。',
    'gui.lessons.challenge.blocks-l1-key-sound.debug1': '鳴らないときは、パソコンの音量と、▼でえらんだ音の名前を見よう。',
    'gui.lessons.challenge.blocks-l1-key-sound.debug2': 'ブロックがはなれていると、下のブロックは動かないよ。',
    'gui.lessons.challenge.blocks-l1-arrow-move.name': '矢印キーで動かそう',
    'gui.lessons.challenge.blocks-l1-arrow-move.task': '上向き矢印キーで上へ、下向き矢印キーで下へ、ネコを動かそう',
    'gui.lessons.challenge.blocks-l1-arrow-move.image': '上向き矢印キーでネコが上へ、下向き矢印キーで下へ動く',
    'gui.lessons.challenge.blocks-l1-arrow-move.step1': '黄色い「イベント」の「上向き矢印キーが押されたとき」をコードエリアへドラッグしよう。▼が「上向き矢印」になっているか見よう。',
    'gui.lessons.challenge.blocks-l1-arrow-move.step2': 'その下に、青い「動き」の「y座標を 10 ずつ変える」をくっつけよう。上下は y、左右は x。',
    'gui.lessons.challenge.blocks-l1-arrow-move.step3': 'できたかたまりを右クリックして「複製」。もう 1 つできたら、「下向き矢印」と「-10」に変えよう。',
    'gui.lessons.challenge.blocks-l1-arrow-move.step4': '矢印キーで、ネコが上と下に動くか見よう。',
    'gui.lessons.challenge.blocks-l1-arrow-move.debug1': '動かないときは、ステージを 1 回クリックしてからキーを押そう。',
    'gui.lessons.challenge.blocks-l1-arrow-move.debug2': '下に動かないときは、数が「-10」（マイナス）になっているか見よう。',
    'gui.lessons.challenge.blocks-l1-click-say.name': '押したら話そう',
    'gui.lessons.challenge.blocks-l1-click-say.task':
        'ネコに好きなコスチュームを足して、\n押したら「こんにちは！」と言って、見た目がかわるようにしよう',
    'gui.lessons.challenge.blocks-l1-click-say.step1':
        '上の「コスチューム」タブを開いて、左下のボタンから好きなコスチュームを足そう。えらんでも、筆で描いてもいいよ。',
    'gui.lessons.challenge.blocks-l1-click-say.step2':
        '「コード」タブにもどって、「押されたとき」のブロックをコードエリアへドラッグしよう。',
    'gui.lessons.challenge.blocks-l1-click-say.step3':
        '紫の「見た目」のブロックをくっつけよう。白いところは「こんにちは！」になっているよ。',
    'gui.lessons.challenge.blocks-l1-click-say.step4': 'その下に、これもくっつけよう。',
    'gui.lessons.challenge.blocks-l1-click-say.step5': 'ステージのネコをクリックしてみよう。',
    'gui.lessons.challenge.blocks-l1-click-say.step6': 'いらないブロックは、パレットへドラッグしてもどすと消えるよ。',
    'gui.lessons.challenge.blocks-l1-click-say.debug1': '何も起きないときは、ステージのネコそのものを押しているか見よう。',
    'gui.lessons.challenge.blocks-l1-click-say.debug2':
        'プログラムを入れたスプライトと、押したスプライトが同じか、右下のスプライトリストで確かめよう。',
    'gui.lessons.challenge.blocks-l1-repeat.name': 'くり返そう',
    'gui.lessons.challenge.blocks-l1-repeat.task': '1 のキーを押したら、\n背景が「Canyon」と「Arctic」に 3 回かわるようにしよう',
    'gui.lessons.challenge.blocks-l1-repeat.step1': '右下の「背景を選ぶ」から、「Canyon」と「Arctic」を足そう。',
    'gui.lessons.challenge.blocks-l1-repeat.step2': '右の「ステージ」をえらぼう。ステージにもプログラムを書けるよ。',
    'gui.lessons.challenge.blocks-l1-repeat.step3': '黄色い「イベント」の「1 キーが押されたとき」をコードエリアへドラッグしよう。▼が「1」になっているか見よう。',
    'gui.lessons.challenge.blocks-l1-repeat.step4': 'その下に、オレンジの「制御」の「繰り返す」をつなげよう。',
    'gui.lessons.challenge.blocks-l1-repeat.step5': '中に「背景を…にする」「1 秒待つ」を 2 組入れよう。',
    'gui.lessons.challenge.blocks-l1-repeat.step6': '1 のキーを押してみよう。',
    'gui.lessons.challenge.blocks-l1-repeat.debug1': '1 回しかかわらないときは、ブロックが「繰り返す」の口の中に入っているか見よう。',
    'gui.lessons.challenge.blocks-l1-repeat.debug2': 'すぐ終わるときは「1 秒待つ」が入っているか見よう。',
    'gui.lessons.challenge.blocks-l1-if.name': 'もし〜なら',
    'gui.lessons.challenge.blocks-l1-if.task':
        'マウスでネコにさわったら「くすぐったい！」、\nさわっていないときは「さわってみて」と言うようにしよう',
    'gui.lessons.challenge.blocks-l1-if.step1': '黄色い「イベント」の「旗が押されたとき」をコードエリアへドラッグしよう。',
    'gui.lessons.challenge.blocks-l1-if.step2': '旗のブロックの下に「ずっと」をつなげよう。',
    'gui.lessons.challenge.blocks-l1-if.step3': '「ずっと」の中に「もし〜なら でなければ」を入れよう。',
    'gui.lessons.challenge.blocks-l1-if.step4': '水色の「調べる」から、六角形のブロックを「もし」の六角形の穴に入れよう。',
    'gui.lessons.challenge.blocks-l1-if.step5': '上と下に「言う」を入れて、それぞれのセリフを書こう。',
    'gui.lessons.challenge.blocks-l1-if.step6': '旗を押して、マウスをネコに重ねたり、はなしたりしよう。止めるときは赤い●。',
    'gui.lessons.challenge.blocks-l1-if.debug1': 'セリフがかわらないときは、「言う」が「もし」の中と「でなければ」の中に 1 つずつ入っているか見よう。',
    'gui.lessons.challenge.blocks-l1-if.debug2': '1 回しか調べないときは、「ずっと」の中に入っているか見よう。',
    'gui.lessons.challenge.blocks-l1-ask-answer.name': '聞いて答えよう',
    'gui.lessons.challenge.blocks-l1-ask-answer.task': 'ネコを押したら名前を聞いて、\n答えた名前と、答えるまでにかかった秒数を言うようにしよう',
    'gui.lessons.challenge.blocks-l1-ask-answer.step1': '黄色い「イベント」の「このスプライトが押されたとき」をコードエリアへドラッグしよう。',
    'gui.lessons.challenge.blocks-l1-ask-answer.step2': '水色の「調べる」の「聞いて待つ」をつなげよう。「なまえは？」と聞くよ。',
    'gui.lessons.challenge.blocks-l1-ask-answer.step3': '「言う」をつなげて、白いところに、丸い「答え」のブロックを入れよう。',
    'gui.lessons.challenge.blocks-l1-ask-answer.step4': '聞く前に「タイマーをリセット」を入れよう。タイマーは 0 から数えはじめるよ。',
    'gui.lessons.challenge.blocks-l1-ask-answer.step5': '緑の「演算」の「と」で、丸い「タイマー」と「秒でした」をつないで、もう 1 つの「言う」に入れよう。',
    'gui.lessons.challenge.blocks-l1-ask-answer.step6': 'ネコを押して、下に出る入力らんに名前を書いて ✓ を押そう。',
    'gui.lessons.challenge.blocks-l1-ask-answer.debug1': '「答え」という文字を言ってしまうときは、文字を書いたのではなく、丸い「答え」のブロックを入れたか見よう。',
    'gui.lessons.challenge.blocks-l1-ask-answer.debug2': '秒数がとても大きいときは、「タイマーをリセット」が「聞いて待つ」の前にあるか見よう。',
    'gui.lessons.challenge.blocks-l1-quiz.name': 'クイズを作ろう',
    'gui.lessons.challenge.blocks-l1-quiz.task': 'ネコを押したら「4＋3＝？」と聞いて、\n7 なら「正解です」、ちがえば「ちがいます」と言うようにしよう',
    'gui.lessons.challenge.blocks-l1-quiz.step1': '黄色い「イベント」の「このスプライトが押されたとき」をコードエリアへドラッグしよう。',
    'gui.lessons.challenge.blocks-l1-quiz.step2': '「聞いて待つ」で問題を出そう。',
    'gui.lessons.challenge.blocks-l1-quiz.step3': 'オレンジの「制御」の「もし〜なら でなければ」をつなげて、上と下に「言う」を入れよう。上は「正解です」、下は「ちがいます」にしよう。',
    'gui.lessons.challenge.blocks-l1-quiz.step4': '緑の「演算」の「=」を、「もし」の穴に入れよう。',
    'gui.lessons.challenge.blocks-l1-quiz.step5': '「=」の左に「答え」を入れよう。右は 7 のままでいいよ。',
    'gui.lessons.challenge.blocks-l1-quiz.step6': '7 と、7 じゃない数の両方をためそう。',
    'gui.lessons.challenge.blocks-l1-quiz.debug1': 'いつも「ちがいます」になるときは、「=」の左に「答え」、右に 7 が入っているか見よう。数は半角の 7 で入れよう。',
    'gui.lessons.challenge.blocks-l1-count.name': '数えよう',
    'gui.lessons.challenge.blocks-l1-count.task': 'ネコを押した回数を数えて、その数を言うようにしよう。\n3 回押してみよう',
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
        'ペンギンを足して、\nネコを押したらペンギンが「やあ！」と言うようにしよう',
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
        '拡張機能「音声合成」を足して、\nネコを押したら「ボタンが押されました」としゃべるようにしよう',
    'gui.lessons.challenge.blocks-l1-speak.step1':
        '左下のボタンから「音声合成」をえらぼう。パレットに新しいなかまがふえるよ。',
    'gui.lessons.challenge.blocks-l1-speak.step2': '「押されたとき」に「しゃべる」をつなげよう。ことばは「ボタンが押されました」になっているよ。',
    'gui.lessons.challenge.blocks-l1-speak.step3': 'ネコを押してみよう。',
    'gui.lessons.challenge.blocks-l1-speak.debug1':
        '声が出ないときは、パソコンの音量を見よう。音声合成はインターネットにつながっていないと使えないよ。',
    'gui.lessons.challenge.blocks-l1-message-list.task':
        'ネコを押したら「メッセージは？」と聞いて、\n答えをリスト「トーク」にためよう。\n3 つためてみよう',
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
    'gui.lessons.completed.next': '次のチャレンジ',
    'gui.lessons.completed.lastInLesson': 'このレッスンのチャレンジは、これでおわり。',
    'gui.lessons.completed.otherLessons': 'ほかのレッスンへ',
    'gui.lessons.completed.library': 'レッスン表へ',
    'gui.lessons.completed.close': '閉じる',
};

export const jaHira = {
    'gui.lessons.course.kyou-kara-programmer.name': 'きょうからプログラマー',
    'gui.lessons.lesson.blocks-l1.name': 'うごかしてみよう',
    'gui.lessons.lesson.blocks-l2.name': 'えらんで たずねよう',
    'gui.lessons.lesson.blocks-l3.name': 'おぼえて つたえよう',
    'gui.lessons.challenge.blocks-l1-key-sound.name': 'キーでおとをならそう',
    'gui.lessons.challenge.blocks-l1-key-sound.task':
        'スペースキーをおしたら、\nネコが「Meow」（ニャー）とないたあと、「Owl」のおとがなるようにしよう',
    'gui.lessons.challenge.blocks-l1-key-sound.step1': 'うえの「おと」タブをひらいて、ひだりしたのボタンから「Owl」をえらんでたそう。',
    'gui.lessons.challenge.blocks-l1-key-sound.step2':
        '「コード」タブにもどって、きいろい「イベント」のブロックをコードエリアへドラッグしよう。',
    'gui.lessons.challenge.blocks-l1-key-sound.step3': 'このブロックを、したにくっつけよう。カチッとはまれば OK。',
    'gui.lessons.challenge.blocks-l1-key-sound.step4': 'もう 1 つおとのブロックをつなげて、▼で「Owl」をえらぼう。',
    'gui.lessons.challenge.blocks-l1-key-sound.step5': 'スペースキーをおしてみよう。',
    'gui.lessons.challenge.blocks-l1-key-sound.debug1': 'ならないときは、パソコンのおんりょうと、▼でえらんだおとのなまえをみよう。',
    'gui.lessons.challenge.blocks-l1-key-sound.debug2': 'ブロックがはなれていると、したのブロックはうごかないよ。',
    'gui.lessons.challenge.blocks-l1-arrow-move.name': 'やじるしキーでうごかそう',
    'gui.lessons.challenge.blocks-l1-arrow-move.task':
        'うえむきやじるしキーでうえへ、\nしたむきやじるしキーでしたへ、ネコをうごかそう',
    'gui.lessons.challenge.blocks-l1-arrow-move.image': 'うえむきやじるしキーでネコがうえへ、したむきやじるしキーでしたへうごく',
    'gui.lessons.challenge.blocks-l1-arrow-move.step1': 'きいろい「イベント」の「うえむきやじるしキーがおされたとき」をコードエリアへドラッグしよう。▼が「うえむきやじるし」になっているかみよう。',
    'gui.lessons.challenge.blocks-l1-arrow-move.step2': 'そのしたに、あおい「うごき」の「yざひょうを 10 ずつかえる」をくっつけよう。じょうげは y、さゆうは x。',
    'gui.lessons.challenge.blocks-l1-arrow-move.step3': 'できたかたまりをみぎクリックして「ふくせい」。もう 1 つできたら、「したむきやじるし」と「-10」にかえよう。',
    'gui.lessons.challenge.blocks-l1-arrow-move.step4': 'やじるしキーで、ネコがうえとしたにうごくかみよう。',
    'gui.lessons.challenge.blocks-l1-arrow-move.debug1': 'うごかないときは、ステージを 1 かいクリックしてからキーをおそう。',
    'gui.lessons.challenge.blocks-l1-arrow-move.debug2': 'したにうごかないときは、かずが「-10」（マイナス）になっているかみよう。',
    'gui.lessons.challenge.blocks-l1-click-say.name': 'おしたらはなそう',
    'gui.lessons.challenge.blocks-l1-click-say.task':
        'ネコにすきなコスチュームをたして、\nおしたら「こんにちは！」といって、みためがかわるようにしよう',
    'gui.lessons.challenge.blocks-l1-click-say.step1':
        'うえの「コスチューム」タブをひらいて、ひだりしたのボタンからすきなコスチュームをたそう。えらんでも、ふででかいてもいいよ。',
    'gui.lessons.challenge.blocks-l1-click-say.step2':
        '「コード」タブにもどって、「おされたとき」のブロックをコードエリアへドラッグしよう。',
    'gui.lessons.challenge.blocks-l1-click-say.step3':
        'むらさきの「みため」のブロックをくっつけよう。しろいところは「こんにちは！」になっているよ。',
    'gui.lessons.challenge.blocks-l1-click-say.step4': 'そのしたに、これもくっつけよう。',
    'gui.lessons.challenge.blocks-l1-click-say.step5': 'ステージのネコをクリックしてみよう。',
    'gui.lessons.challenge.blocks-l1-click-say.step6': 'いらないブロックは、パレットへドラッグしてもどすときえるよ。',
    'gui.lessons.challenge.blocks-l1-click-say.debug1': 'なにもおきないときは、ステージのネコそのものをおしているかみよう。',
    'gui.lessons.challenge.blocks-l1-click-say.debug2':
        'プログラムをいれたスプライトと、おしたスプライトがおなじか、みぎしたのスプライトリストでたしかめよう。',
    'gui.lessons.challenge.blocks-l1-repeat.name': 'くりかえそう',
    'gui.lessons.challenge.blocks-l1-repeat.task': '1 のキーをおしたら、\nはいけいが「Canyon」と「Arctic」に 3 かいかわるようにしよう',
    'gui.lessons.challenge.blocks-l1-repeat.step1': 'みぎしたの「はいけいをえらぶ」から、「Canyon」と「Arctic」をたそう。',
    'gui.lessons.challenge.blocks-l1-repeat.step2': 'みぎの「ステージ」をえらぼう。ステージにもプログラムをかけるよ。',
    'gui.lessons.challenge.blocks-l1-repeat.step3': 'きいろい「イベント」の「1 キーがおされたとき」をコードエリアへドラッグしよう。▼が「1」になっているかみよう。',
    'gui.lessons.challenge.blocks-l1-repeat.step4': 'そのしたに、オレンジの「せいぎょ」の「くりかえす」をつなげよう。',
    'gui.lessons.challenge.blocks-l1-repeat.step5': 'なかに「はいけいを…にする」「1 びょうまつ」を 2 くみいれよう。',
    'gui.lessons.challenge.blocks-l1-repeat.step6': '1 のキーをおしてみよう。',
    'gui.lessons.challenge.blocks-l1-repeat.debug1': '1 かいしかかわらないときは、ブロックが「くりかえす」のくちのなかにはいっているかみよう。',
    'gui.lessons.challenge.blocks-l1-repeat.debug2': 'すぐおわるときは「1 びょうまつ」がはいっているかみよう。',
    'gui.lessons.challenge.blocks-l1-if.name': 'もし〜なら',
    'gui.lessons.challenge.blocks-l1-if.task':
        'マウスでネコにさわったら「くすぐったい！」、\nさわっていないときは「さわってみて」というようにしよう',
    'gui.lessons.challenge.blocks-l1-if.step1': 'きいろい「イベント」の「はたがおされたとき」をコードエリアへドラッグしよう。',
    'gui.lessons.challenge.blocks-l1-if.step2': 'はたのブロックのしたに「ずっと」をつなげよう。',
    'gui.lessons.challenge.blocks-l1-if.step3': '「ずっと」のなかに「もし〜なら でなければ」をいれよう。',
    'gui.lessons.challenge.blocks-l1-if.step4': 'みずいろの「しらべる」から、ろっかっけいのブロックを「もし」のろっかっけいのあなにいれよう。',
    'gui.lessons.challenge.blocks-l1-if.step5': 'うえとしたに「いう」をいれて、それぞれのセリフをかこう。',
    'gui.lessons.challenge.blocks-l1-if.step6': 'はたをおして、マウスをネコにかさねたり、はなしたりしよう。とめるときはあかい●。',
    'gui.lessons.challenge.blocks-l1-if.debug1': 'セリフがかわらないときは、「いう」が「もし」のなかと「でなければ」のなかに 1 つずつはいっているかみよう。',
    'gui.lessons.challenge.blocks-l1-if.debug2': '1 かいしかしらべないときは、「ずっと」のなかにはいっているかみよう。',
    'gui.lessons.challenge.blocks-l1-ask-answer.name': 'きいてこたえよう',
    'gui.lessons.challenge.blocks-l1-ask-answer.task': 'ネコをおしたらなまえをきいて、\nこたえたなまえと、こたえるまでにかかったびょうすうをいうようにしよう',
    'gui.lessons.challenge.blocks-l1-ask-answer.step1': 'きいろい「イベント」の「このスプライトがおされたとき」をコードエリアへドラッグしよう。',
    'gui.lessons.challenge.blocks-l1-ask-answer.step2': 'みずいろの「しらべる」の「きいてまつ」をつなげよう。「なまえは？」ときくよ。',
    'gui.lessons.challenge.blocks-l1-ask-answer.step3': '「いう」をつなげて、しろいところに、まるい「こたえ」のブロックをいれよう。',
    'gui.lessons.challenge.blocks-l1-ask-answer.step4': 'きくまえに「タイマーをリセット」をいれよう。タイマーは 0 からかぞえはじめるよ。',
    'gui.lessons.challenge.blocks-l1-ask-answer.step5': 'みどりの「えんざん」の「と」で、まるい「タイマー」と「びょうでした」をつないで、もう 1 つの「いう」にいれよう。',
    'gui.lessons.challenge.blocks-l1-ask-answer.step6': 'ネコをおして、したにでるにゅうりょくらんになまえをかいて ✓ をおそう。',
    'gui.lessons.challenge.blocks-l1-ask-answer.debug1': '「こたえ」というもじをいってしまうときは、もじをかいたのではなく、まるい「こたえ」のブロックをいれたかみよう。',
    'gui.lessons.challenge.blocks-l1-ask-answer.debug2': 'びょうすうがとてもおおきいときは、「タイマーをリセット」が「きいてまつ」のまえにあるかみよう。',
    'gui.lessons.challenge.blocks-l1-quiz.name': 'クイズをつくろう',
    'gui.lessons.challenge.blocks-l1-quiz.task': 'ネコをおしたら「4＋3＝？」ときいて、\n7 なら「せいかいです」、ちがえば「ちがいます」というようにしよう',
    'gui.lessons.challenge.blocks-l1-quiz.step1': 'きいろい「イベント」の「このスプライトがおされたとき」をコードエリアへドラッグしよう。',
    'gui.lessons.challenge.blocks-l1-quiz.step2': '「きいてまつ」でもんだいをだそう。',
    'gui.lessons.challenge.blocks-l1-quiz.step3': 'オレンジの「せいぎょ」の「もし〜なら でなければ」をつなげて、うえとしたに「いう」をいれよう。うえは「せいかいです」、したは「ちがいます」にしよう。',
    'gui.lessons.challenge.blocks-l1-quiz.step4': 'みどりの「えんざん」の「=」を、「もし」のあなにいれよう。',
    'gui.lessons.challenge.blocks-l1-quiz.step5': '「=」のひだりに「こたえ」をいれよう。みぎは 7 のままでいいよ。',
    'gui.lessons.challenge.blocks-l1-quiz.step6': '7 と、7 じゃないかずのりょうほうをためそう。',
    'gui.lessons.challenge.blocks-l1-quiz.debug1': 'いつも「ちがいます」になるときは、「=」のひだりに「こたえ」、みぎに 7 がはいっているかみよう。かずははんかくの 7 でいれよう。',
    'gui.lessons.challenge.blocks-l1-count.name': 'かぞえよう',
    'gui.lessons.challenge.blocks-l1-count.task': 'ネコをおしたかいすうをかぞえて、そのかずをいうようにしよう。\n3 かいおしてみよう',
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
        'ペンギンをたして、\nネコをおしたらペンギンが「やあ！」というようにしよう',
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
        'かくちょうきのう「おんせいごうせい」をたして、\nネコをおしたら「ボタンがおされました」としゃべるようにしよう',
    'gui.lessons.challenge.blocks-l1-speak.step1':
        'ひだりしたのボタンから「おんせいごうせい」をえらぼう。パレットにあたらしいなかまがふえるよ。',
    'gui.lessons.challenge.blocks-l1-speak.step2': '「おされたとき」に「しゃべる」をつなげよう。ことばは「ボタンがおされました」になっているよ。',
    'gui.lessons.challenge.blocks-l1-speak.step3': 'ネコをおしてみよう。',
    'gui.lessons.challenge.blocks-l1-speak.debug1':
        'こえがでないときは、パソコンのおんりょうをみよう。おんせいごうせいはインターネットにつながっていないとつかえないよ。',
    'gui.lessons.challenge.blocks-l1-message-list.task':
        'ネコをおしたら「メッセージは？」ときいて、\nこたえをリスト「トーク」にためよう。\n3 つためてみよう',
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
    'gui.lessons.completed.next': 'つぎのチャレンジ',
    'gui.lessons.completed.lastInLesson': 'このレッスンのチャレンジは、これでおわり。',
    'gui.lessons.completed.otherLessons': 'ほかのレッスンへ',
    'gui.lessons.completed.library': 'レッスンひょうへ',
    'gui.lessons.completed.close': 'とじる',
};

export const en = {
    'gui.lessons.course.kyou-kara-programmer.name': 'Programmer from Today',
    'gui.lessons.lesson.blocks-l1.name': "Let's Move",
    'gui.lessons.lesson.blocks-l2.name': 'Choose and Ask',
    'gui.lessons.lesson.blocks-l3.name': 'Remember and Tell',
    'gui.lessons.challenge.blocks-l1-key-sound.name': 'Play a sound with a key',
    'gui.lessons.challenge.blocks-l1-key-sound.task':
        'Make the cat meow and then play the "Owl" sound\nwhen the space key is pressed',
    'gui.lessons.challenge.blocks-l1-key-sound.step1':
        'Open the "Sounds" tab at the top and add "Owl" with the button at the bottom left.',
    'gui.lessons.challenge.blocks-l1-key-sound.step2':
        'Go back to the "Code" tab and drag the yellow "Events" block into the code area.',
    'gui.lessons.challenge.blocks-l1-key-sound.step3': 'Snap this block on underneath. It is in when it clicks into place.',
    'gui.lessons.challenge.blocks-l1-key-sound.step4': 'Add one more sound block and choose "Owl" with the ▼.',
    'gui.lessons.challenge.blocks-l1-key-sound.step5': 'Press the space key.',
    'gui.lessons.challenge.blocks-l1-key-sound.debug1':
        'If you hear nothing, check the volume of the computer and the sound name chosen with the ▼.',
    'gui.lessons.challenge.blocks-l1-key-sound.debug2': 'If the blocks are apart, the lower block does not run.',
    'gui.lessons.challenge.blocks-l1-arrow-move.name': 'Move with the arrow keys',
    'gui.lessons.challenge.blocks-l1-arrow-move.task': 'Move the cat up with the up arrow key and down with the down arrow key',
    'gui.lessons.challenge.blocks-l1-arrow-move.image':
        'The up arrow key moves the cat up, and the down arrow key moves it down',
    'gui.lessons.challenge.blocks-l1-arrow-move.step1': 'Drag "when up arrow key pressed" from the yellow "Events" to the code area. Check that the ▼ shows "up arrow".',
    'gui.lessons.challenge.blocks-l1-arrow-move.step2': 'Snap "change y by 10" from the blue "Motion" blocks under it. Up and down is y, left and right is x.',
    'gui.lessons.challenge.blocks-l1-arrow-move.step3': 'Right-click the script you made and choose "Duplicate". Change the copy to "down arrow" and "-10".',
    'gui.lessons.challenge.blocks-l1-arrow-move.step4': 'Check that the arrow keys move the cat up and down.',
    'gui.lessons.challenge.blocks-l1-arrow-move.debug1': 'If it does not move, click the stage once and then press the key.',
    'gui.lessons.challenge.blocks-l1-arrow-move.debug2': 'If it does not move down, check that the number is "-10" (minus).',
    'gui.lessons.challenge.blocks-l1-click-say.name': 'Talk when clicked',
    'gui.lessons.challenge.blocks-l1-click-say.task':
        'Add a costume you like to the cat,\nand make it say "Hello!" and change its look when it is clicked',
    'gui.lessons.challenge.blocks-l1-click-say.step1':
        'Open the "Costumes" tab at the top and add a costume you like with the button at the bottom left. Choose one, or paint one.',
    'gui.lessons.challenge.blocks-l1-click-say.step2':
        'Go back to the "Code" tab and drag the "when this sprite clicked" block into the code area.',
    'gui.lessons.challenge.blocks-l1-click-say.step3':
        'Snap on the purple "Looks" block. The white part already says "Hello!".',
    'gui.lessons.challenge.blocks-l1-click-say.step4': 'Snap this one on underneath.',
    'gui.lessons.challenge.blocks-l1-click-say.step5': 'Click the cat on the stage.',
    'gui.lessons.challenge.blocks-l1-click-say.step6': 'To remove a block you do not need, drag it back to the palette.',
    'gui.lessons.challenge.blocks-l1-click-say.debug1': 'If nothing happens, check that you are clicking the cat itself on the stage.',
    'gui.lessons.challenge.blocks-l1-click-say.debug2':
        'Check in the sprite list at the bottom right that the sprite with the program is the one you clicked.',
    'gui.lessons.challenge.blocks-l1-repeat.name': 'Repeat',
    'gui.lessons.challenge.blocks-l1-repeat.task':
        'Make the backdrop switch between "Canyon" and "Arctic" 3 times\nwhen the 1 key is pressed',
    'gui.lessons.challenge.blocks-l1-repeat.step1': 'Add "Canyon" and "Arctic" from "Choose a Backdrop" at the bottom right.',
    'gui.lessons.challenge.blocks-l1-repeat.step2': 'Select "Stage" on the right. The stage can have a program too.',
    'gui.lessons.challenge.blocks-l1-repeat.step3': 'Drag "when 1 key pressed" from the yellow "Events" to the code area. Check that the ▼ shows "1".',
    'gui.lessons.challenge.blocks-l1-repeat.step4': 'Snap "repeat" from the orange "Control" blocks under it.',
    'gui.lessons.challenge.blocks-l1-repeat.step5': 'Put two pairs of "switch backdrop to" and "wait 1 seconds" inside.',
    'gui.lessons.challenge.blocks-l1-repeat.step6': 'Press the 1 key.',
    'gui.lessons.challenge.blocks-l1-repeat.debug1':
        'If it switches only once, check that the blocks are inside the mouth of "repeat".',
    'gui.lessons.challenge.blocks-l1-repeat.debug2': 'If it ends right away, check that "wait 1 seconds" is in there.',
    'gui.lessons.challenge.blocks-l1-if.name': 'If ...',
    'gui.lessons.challenge.blocks-l1-if.task':
        'Make the cat say "That tickles!" when the mouse touches it,\nand "Touch me" when it does not',
    'gui.lessons.challenge.blocks-l1-if.step1': 'Drag "when green flag clicked" from the yellow "Events" to the code area.',
    'gui.lessons.challenge.blocks-l1-if.step2': 'Snap "forever" under the green flag block.',
    'gui.lessons.challenge.blocks-l1-if.step3': 'Put "if ... then ... else" inside "forever".',
    'gui.lessons.challenge.blocks-l1-if.step4': 'From the light blue "Sensing", put the hexagon block into the hexagon hole of "if".',
    'gui.lessons.challenge.blocks-l1-if.step5': 'Put a "say" block in the top and the bottom, and type each line.',
    'gui.lessons.challenge.blocks-l1-if.step6': 'Click the green flag, then move the mouse onto the cat and away again. Click the red ● to stop.',
    'gui.lessons.challenge.blocks-l1-if.debug1': 'If the line does not change, check that there is one "say" inside "if" and one inside "else".',
    'gui.lessons.challenge.blocks-l1-if.debug2': 'If it checks only once, check that the blocks are inside "forever".',
    'gui.lessons.challenge.blocks-l1-ask-answer.name': 'Ask and answer',
    'gui.lessons.challenge.blocks-l1-ask-answer.task': 'Make the cat ask your name when it is clicked,\nthen say the name and how many seconds you took to answer',
    'gui.lessons.challenge.blocks-l1-ask-answer.step1': 'Drag "when this sprite clicked" from the yellow "Events" to the code area.',
    'gui.lessons.challenge.blocks-l1-ask-answer.step2': 'Snap on "ask and wait" from the light blue "Sensing". It asks "What\'s your name?".',
    'gui.lessons.challenge.blocks-l1-ask-answer.step3': 'Snap on a "say" block, and put the round "answer" block into its white part.',
    'gui.lessons.challenge.blocks-l1-ask-answer.step4': 'Put "reset timer" before asking. The timer starts counting from 0.',
    'gui.lessons.challenge.blocks-l1-ask-answer.step5': 'Use "join" from the green "Operators" to join the round "timer" and " seconds", and put it into another "say".',
    'gui.lessons.challenge.blocks-l1-ask-answer.step6': 'Click the cat, type your name in the box that appears at the bottom, and click ✓.',
    'gui.lessons.challenge.blocks-l1-ask-answer.debug1': 'If the cat says the word "answer", check that you put in the round "answer" block instead of typing the word.',
    'gui.lessons.challenge.blocks-l1-ask-answer.debug2': 'If the seconds are very large, check that "reset timer" comes before "ask and wait".',
    'gui.lessons.challenge.blocks-l1-quiz.name': 'Make a quiz',
    'gui.lessons.challenge.blocks-l1-quiz.task': 'Make the cat ask "4+3=?" when it is clicked,\nand say "Correct" for 7 and "Wrong" for anything else',
    'gui.lessons.challenge.blocks-l1-quiz.step1': 'Drag "when this sprite clicked" from the yellow "Events" to the code area.',
    'gui.lessons.challenge.blocks-l1-quiz.step2': 'Ask the question with "ask and wait".',
    'gui.lessons.challenge.blocks-l1-quiz.step3': 'Snap on "if ... then ... else" from the orange "Control" blocks, and put a "say" in the top and the bottom: "Correct" in the top, "Wrong" in the bottom.',
    'gui.lessons.challenge.blocks-l1-quiz.step4': 'Put the "=" from the green "Operators" into the hole of "if".',
    'gui.lessons.challenge.blocks-l1-quiz.step5': 'Put "answer" on the left of "=". Keep 7 on the right.',
    'gui.lessons.challenge.blocks-l1-quiz.step6': 'Try both 7 and a number that is not 7.',
    'gui.lessons.challenge.blocks-l1-quiz.debug1': 'If it always says "Wrong", check that "answer" is on the left of "=" and 7 is on the right. Type 7 as a half-width number.',
    'gui.lessons.challenge.blocks-l1-count.name': 'Count',
    'gui.lessons.challenge.blocks-l1-count.task': 'Count how many times the cat is clicked, and make it say the number.\nTry clicking it 3 times',
    'gui.lessons.challenge.blocks-l1-count.step1': 'In the orange "Variables", click "Make a Variable" and make a variable named "count".',
    'gui.lessons.challenge.blocks-l1-count.step2': 'Make a program that sets it back to 0 when the green flag is clicked.',
    'gui.lessons.challenge.blocks-l1-count.step3': 'Make a program that adds 1 when the cat is clicked, and says the number.',
    'gui.lessons.challenge.blocks-l1-count.step4': 'Click the green flag, then click the cat 3 times. The number also shows at the top left of the stage.',
    'gui.lessons.challenge.blocks-l1-count.debug1': 'If it goes back to 1 every time, check that "set to 0" is not under "when this sprite clicked".',
    'gui.lessons.challenge.blocks-l1-broadcast.name': 'Signal a friend',
    'gui.lessons.challenge.blocks-l1-speak.name': 'Make it speak',
    'gui.lessons.challenge.blocks-l1-message-list.name': 'Collect messages',
    // チャレンジ 9〜11
    'gui.lessons.challenge.blocks-l1-broadcast.task':
        'Add a penguin,\nand make the penguin say "Hi!" when the cat is clicked',
    'gui.lessons.challenge.blocks-l1-broadcast.step1': 'Add a penguin with "Choose a Sprite" at the bottom right.',
    'gui.lessons.challenge.blocks-l1-broadcast.step2':
        'Select the cat and snap "when this sprite clicked" and "broadcast" together. Choose "New message" from ▼ and make "hello".',
    'gui.lessons.challenge.blocks-l1-broadcast.step3':
        'When you select the penguin, the code area becomes empty. Each sprite has its own program.',
    'gui.lessons.challenge.blocks-l1-broadcast.step4': 'Snap "when I receive" and "say" together for the penguin.',
    'gui.lessons.challenge.blocks-l1-broadcast.step5': 'Click the cat.',
    'gui.lessons.challenge.blocks-l1-broadcast.debug1':
        'If the penguin does not speak, check that the message in "broadcast" and in "when I receive" has the same name.',
    'gui.lessons.challenge.blocks-l1-broadcast.debug2':
        "Also check that you did not put the penguin's program on the cat.",
    'gui.lessons.challenge.blocks-l1-speak.task':
        'Add the "Text to Speech" extension,\nand make the cat speak "The button was clicked"\nwhen it is clicked',
    'gui.lessons.challenge.blocks-l1-speak.step1':
        'Choose "Text to Speech" with the button at the bottom left. New blocks join the palette.',
    'gui.lessons.challenge.blocks-l1-speak.step2':
        'Snap "speak" under "when this sprite clicked". The words are already "The button was clicked".',
    'gui.lessons.challenge.blocks-l1-speak.step3': 'Click the cat.',
    'gui.lessons.challenge.blocks-l1-speak.debug1':
        'If you hear nothing, check the volume of the computer. Text to Speech works only when it is connected to the Internet.',
    'gui.lessons.challenge.blocks-l1-message-list.task':
        'When the cat is clicked, ask "Message?"\nand keep the answers in the list "talk".\nTry keeping 3',
    'gui.lessons.challenge.blocks-l1-message-list.step1':
        'Under "Variables", click "Make a List" and make a list named "talk". An empty box appears on the stage.',
    'gui.lessons.challenge.blocks-l1-message-list.step2':
        'Make a program that empties talk when the green flag is clicked.',
    'gui.lessons.challenge.blocks-l1-message-list.step3':
        'Make a program that asks when the cat is clicked and adds the answer to talk.',
    'gui.lessons.challenge.blocks-l1-message-list.step4':
        'Click the green flag, then click the cat 3 times and type messages. They pile up in the box on the stage in the order you typed them.',
    'gui.lessons.challenge.blocks-l1-message-list.debug1':
        'If only one is kept, check that "delete all of" is not under "when this sprite clicked".',
    'gui.lessons.challenge.blocks-l1-message-list.debug2':
        'If the word "answer" is kept, check that you put in the round "answer" block.',
    'gui.lessons.completed.title': 'You did it!',
    'gui.lessons.completed.next': 'Next challenge',
    'gui.lessons.completed.lastInLesson': 'You have done every challenge of this lesson.',
    'gui.lessons.completed.otherLessons': 'Go to other lessons',
    'gui.lessons.completed.library': 'Go to the lessons',
    'gui.lessons.completed.close': 'Close',
};
