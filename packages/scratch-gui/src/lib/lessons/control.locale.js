// コース「自動でセンサーとモーターでうごかそう」（中学 3 年・計測・制御・EPIC #2158）の文言。
// lessons.locale.js の ja / jaHira / en に spread する（コースのデータは courses.js）。
// キーの決まりは lessons.locale.js と同じ `gui.lessons.<course|lesson|challenge>.<id>.<field>`。
// センサー・部品の名前は拡張機能「アーテックロボ」の表示（教科書の一般的な名前）にそろえる。クイズの用語は教科書
// （計測・制御システム・センサー・仕事を行う部分・インタフェース・アナログ・デジタル）にそろえ、文は自分の言葉で書く。
// ヒントは、実機（基板）と練習用の基板の両方の操作を書く。

const C = 'gui.lessons.challenge.';

export const ja = {
    'gui.lessons.course.jidou-sensor-motor.name': '自動でセンサーとモーターでうごかそう',
    'gui.lessons.course.jidou-sensor-motor.description':
        'センサーの値で LED やモーターを自動で動かす計測・制御システムを作り、自分の課題を解決するシステムを作品にするよ。',
    // レッスン 1「センサーと LED をためそう」（#2170・ワークシート第 2 時）
    'gui.lessons.lesson.ctrl-l1.name': 'センサーと LED をためそう',
    [`${C}ctrl-l1-measure.name`]: '明るさをはかろう',
    [`${C}ctrl-l1-measure.task`]:
        '拡張機能「アーテックロボ」を足して、光センサーの値を変数「明るさ」に入れ、ずっと言い続けよう。\nセンサーに手をかざして（練習用の基板ならスライダーを動かして）、値が変わるのを見よう',
    [`${C}ctrl-l1-measure.step1`]:
        '課題の説明と、アクティビティ図を理解しよう。図で、いちばん下から上のひし形へもどる線が「ずっと」のくり返し。センサーで計測した値を、ずっと画面に出し続けるよ。',
    [`${C}ctrl-l1-measure.step2`]:
        '左下の「拡張機能を追加」を押して「アーテックロボ」を選ぼう。基板があれば USB ケーブルでパソコンにさして「接続する（生徒用）」を押そう。無ければ接続の画面を閉じよう（練習用の基板で動くよ）。',
    [`${C}ctrl-l1-measure.step3`]: '「旗が押されたとき」の下に、「制御」の「ずっと」をつなげよう。',
    [`${C}ctrl-l1-measure.step4`]:
        '「変数」の「変数を作る」で変数「明るさ」を作ろう。「明るさを 0 にする」を「ずっと」の中に入れ、白いところに「アーテックロボ」の「光センサー (A6) の値」を入れよう。',
    [`${C}ctrl-l1-measure.step5`]: 'その下に「見た目」の「言う」をつなげ、白いところに (明るさ) を入れよう。',
    [`${C}ctrl-l1-measure.step6`]:
        '緑の旗を押して、センサーに手をかざしたり、はなしたりしよう。練習用の基板なら、パネルの「光センサー (A6)」のスライダーを動かそう。',
    [`${C}ctrl-l1-measure.debug1`]:
        '値が変わらないときは、光センサーが A6 にささっているか見よう。光センサーが無ければ、▼で「赤外線センサー（フォトリフレクタ）(A4)」を選んでもいいよ。',
    [`${C}ctrl-l1-measure.debug2`]: 'ずっと同じ数のときは、「言う」の白いところに (明るさ) を入れたか見よう。',
    [`${C}ctrl-l1-measure.quiz.question`]: 'センサーの電気の信号が、画面では数になって出た。この変換をしたのはどれ？',
    [`${C}ctrl-l1-measure.quiz.choice1`]: 'スプライト',
    [`${C}ctrl-l1-measure.quiz.choice2`]: 'Studuino（インタフェース）',
    [`${C}ctrl-l1-measure.quiz.choice3`]: 'LED',
    [`${C}ctrl-l1-measure.quiz.explanation`]:
        'センサーのアナログの信号を、コンピューターがわかるデジタルの数に変えるのはインタフェースの役目。ここでは Studuino 基板がインタフェースだよ。',
    [`${C}ctrl-l1-blink.name`]: 'LED を点滅させよう',
    [`${C}ctrl-l1-blink.task`]:
        '緑の旗を押したら、左の LED (A0) を 1 秒つけて、1 秒消す、をずっとくり返そう。\n練習用の基板なら、パネルの LED の印がついたり消えたりするよ',
    [`${C}ctrl-l1-blink.step1`]:
        '課題の説明と、アクティビティ図を理解しよう。図で、いちばん下から上のひし形へもどる線が「ずっと」のくり返し。',
    [`${C}ctrl-l1-blink.step2`]: '「旗が押されたとき」の下に、「制御」の「ずっと」をつなげよう。',
    [`${C}ctrl-l1-blink.step3`]:
        '「ずっと」の中に、「アーテックロボ」の「左 のLED をオンにする」と、「制御」の「1 秒待つ」を入れよう。',
    [`${C}ctrl-l1-blink.step4`]: 'その下に「左 のLED をオフにする」と「1 秒待つ」をつなげよう。',
    [`${C}ctrl-l1-blink.step5`]:
        '緑の旗を押して、LED (A0) がついたり消えたりするのを見よう（練習用の基板なら、パネルの LED (A0) の印）。',
    [`${C}ctrl-l1-blink.debug1`]:
        'LED が光らないときは、LED が A0 にささっているか、ブロックの ▼ が「左」になっているか見よう。',
    [`${C}ctrl-l1-blink.debug2`]:
        'ついたままのときは、「オフにする」のあとにも「1 秒待つ」があるか見よう。待たないと、消えてすぐにつくよ。',
    [`${C}ctrl-l1-blink.quiz.question`]: 'LED やモーターのように、プログラムの命令で動いて仕事をするものを何という？',
    [`${C}ctrl-l1-blink.quiz.choice1`]: 'センサー',
    [`${C}ctrl-l1-blink.quiz.choice2`]: '仕事を行う部分',
    [`${C}ctrl-l1-blink.quiz.choice3`]: 'インタフェース',
    [`${C}ctrl-l1-blink.quiz.explanation`]:
        'LED・モーター・ヒーターなど、命令を受けて動くものが仕事を行う部分。センサーは周りのようすを計測するものだよ。',
    [`${C}ctrl-l1-touch-led.name`]: 'タッチセンサーで LED をつけよう',
    [`${C}ctrl-l1-touch-led.task`]:
        'タッチセンサー (A2) を押しているあいだだけ、左の LED (A0) をつけよう。\nタッチセンサーの値は、押すと 0、はなすと 1 になるよ',
    [`${C}ctrl-l1-touch-led.step1`]:
        '課題の説明と、アクティビティ図を理解しよう。ひし形で、センサーの値が 0 かどうかで道が分かれるよ。',
    [`${C}ctrl-l1-touch-led.step2`]: '「旗が押されたとき」の下に、「制御」の「ずっと」をつなげよう。',
    [`${C}ctrl-l1-touch-led.step3`]: '「ずっと」の中に、「制御」の「もし〜なら でなければ」を入れよう。',
    [`${C}ctrl-l1-touch-led.step4`]:
        '「もし」の白いところに「演算」の「〜 = 0」を入れ、左に「アーテックロボ」の「〜の値」を入れて、▼で「タッチセンサー (A2)」を選ぼう。',
    [`${C}ctrl-l1-touch-led.step5`]:
        '「もし」の中に「左 のLED をオンにする」、「でなければ」の中に「左 のLED をオフにする」を入れよう。',
    [`${C}ctrl-l1-touch-led.step6`]:
        '緑の旗を押して、タッチセンサーを押したり、はなしたりしよう。練習用の基板なら、パネルの「タッチセンサー (A2)」のボタンを押そう。',
    [`${C}ctrl-l1-touch-led.debug1`]:
        '逆になるときは、「= 0」の数を見よう。タッチセンサーは、押すと 0、はなすと 1 だよ。',
    [`${C}ctrl-l1-touch-led.debug2`]:
        'タッチセンサーが無ければ、▼でほかのセンサーを選んでもいいよ（練習用の基板なら、スライダーを 0 にすると「押した」と同じ）。',
    [`${C}ctrl-l1-touch-led.quiz.question`]:
        'タッチセンサーの値は 0 か 1 の 2 つだけ。このように、とびとびの値で表すことを何という？',
    [`${C}ctrl-l1-touch-led.quiz.choice1`]: 'アナログ',
    [`${C}ctrl-l1-touch-led.quiz.choice2`]: 'デジタル',
    [`${C}ctrl-l1-touch-led.quiz.choice3`]: 'センサー',
    [`${C}ctrl-l1-touch-led.quiz.explanation`]:
        'とびとびの値で表すのがデジタル、光の強さのように切れ目なく変わる量がアナログ。光センサーの値も、Studuino で 0〜1023 のデジタルの数になるよ。',
    [`${C}ctrl-l1-threshold.name`]: 'さかい目を決めよう',
    [`${C}ctrl-l1-threshold.task`]:
        '光センサーの値がさかい目の 500 より小さければ「暗い」、そうでなければ「明るい」と言い続けよう。\n思ったとおりに言い分けなければ、手をかざして値を確かめ、500 を変えよう',
    [`${C}ctrl-l1-threshold.step1`]:
        '課題の説明と、アクティビティ図を理解しよう。ひし形で、計測した値がさかい目より小さいかどうかで道が分かれるよ。',
    [`${C}ctrl-l1-threshold.step2`]: '「旗が押されたとき」の下に、「制御」の「ずっと」をつなげよう。',
    [`${C}ctrl-l1-threshold.step3`]: '「ずっと」の中に、「制御」の「もし〜なら でなければ」を入れよう。',
    [`${C}ctrl-l1-threshold.step4`]:
        '「もし」の白いところに「演算」の「〜 < 500」を入れ、左に「アーテックロボ」の「光センサー (A6) の値」を入れよう。',
    [`${C}ctrl-l1-threshold.step5`]:
        '「もし」の中に「暗い と言う」、「でなければ」の中に「明るい と言う」を入れよう。',
    [`${C}ctrl-l1-threshold.step6`]:
        '緑の旗を押して、センサーに手をかざしたり、はなしたりしよう。練習用の基板なら、スライダーを 500 より小さく、大きく動かそう。',
    [`${C}ctrl-l1-threshold.debug1`]:
        'いつも同じことを言うときは、1-1 のように明るいときと暗いときの値をはかって、そのあいだの数に 500 を変えよう。',
    [`${C}ctrl-l1-threshold.debug2`]: '逆に言うときは、「<」を「>」にするか、「暗い」と「明るい」を入れかえよう。',
    [`${C}ctrl-l1-threshold.quiz.question`]: 'さかい目の 500 を、教室ごとに変えることがあるのはなぜ？',
    [`${C}ctrl-l1-threshold.quiz.choice1`]: '部屋の明るさで値が変わるから',
    [`${C}ctrl-l1-threshold.quiz.choice2`]: '500 は大きすぎて使えないから',
    [`${C}ctrl-l1-threshold.quiz.choice3`]: 'センサーが 1 つしか無いから',
    [`${C}ctrl-l1-threshold.quiz.explanation`]:
        'センサーの値は、部屋の明るさや机の色で変わる。だから、実際にはかってからさかい目を決めるよ。決めた数がしきい値だよ。',
    // レッスン 2「自動で動かそう」（#2171・ワークシート第 3 時）
    'gui.lessons.lesson.ctrl-l2.name': '自動で動かそう',
    [`${C}ctrl-l2-auto-light.name`]: '自動点灯 LED ライト',
    [`${C}ctrl-l2-auto-light.task`]:
        '明るさを計測して変数「明るさ」に入れ、さかい目の 500 より小さい（暗い）ときは LED (A0) をつけ、そうでなければ消す、をずっとくり返そう。\n暗くなったら自動で点くライトの完成だよ',
    [`${C}ctrl-l2-auto-light.step1`]:
        '課題の説明と、アクティビティ図を理解しよう。「明るさを計測する」→ ひし形で「暗い？」と判断 →「LED をつける／消す」の仕事 → もどる線でまた計測。これが計測・制御システムの形だよ。',
    [`${C}ctrl-l2-auto-light.step2`]:
        '「旗が押されたとき」の下に「ずっと」をつなげ、その中に「明るさを (光センサー (A6) の値) にする」を入れよう（変数「明るさ」が無ければ「変数を作る」で作ろう）。',
    [`${C}ctrl-l2-auto-light.step3`]:
        'その下に「もし〜なら でなければ」をつなげ、白いところに「〜 < 500」を入れて、左に (明るさ) を入れよう。',
    [`${C}ctrl-l2-auto-light.step4`]:
        '「もし」の中に「左 のLED をオンにする」、「でなければ」の中に「左 のLED をオフにする」を入れよう。',
    [`${C}ctrl-l2-auto-light.step5`]:
        '緑の旗を押して、センサーを手でおおったり、はなしたりしよう。練習用の基板なら、光センサーのスライダーを 500 より小さく、大きく動かそう。',
    [`${C}ctrl-l2-auto-light.debug1`]:
        'LED がつきっぱなしのときは、「<」の向きと 500 の数を見よう。レッスン 1 で決めたさかい目に変えてもいいよ。',
    [`${C}ctrl-l2-auto-light.debug2`]:
        'すぐ止まってしまうときは、全部のブロックが「ずっと」の中に入っているか見よう。',
    [`${C}ctrl-l2-auto-light.quiz.question`]: 'このライトのプログラムから「ずっと」をなくすと、どうなる？',
    [`${C}ctrl-l2-auto-light.quiz.choice1`]: '1 回はかるだけで、あとは変わらない',
    [`${C}ctrl-l2-auto-light.quiz.choice2`]: 'LED がずっと点滅する',
    [`${C}ctrl-l2-auto-light.quiz.choice3`]: 'センサーがこわれる',
    [`${C}ctrl-l2-auto-light.quiz.explanation`]:
        '計測・制御システムは、計測 → 判断 → 仕事 をくり返す。くり返さないと、1 回はかったあとは明るさが変わっても LED は変わらないよ。',
    [`${C}ctrl-l2-near-light.name`]: '近づいたらつけよう',
    [`${C}ctrl-l2-near-light.task`]:
        '赤外線センサー（フォトリフレクタ）(A4) の値が 500 より大きい（何かが近づいた）ときは LED (A0) をつけ、そうでなければ消そう。\nセンサーを替えると、同じ形のプログラムで別のシステムになるよ',
    [`${C}ctrl-l2-near-light.step1`]:
        '課題の説明と、アクティビティ図を理解しよう。2-1 と同じ形で、計測するセンサーと、ひし形の判断だけがちがうよ。',
    [`${C}ctrl-l2-near-light.step2`]:
        '「旗が押されたとき」の下に「ずっと」をつなげ、その中に「もし〜なら でなければ」を入れよう。',
    [`${C}ctrl-l2-near-light.step3`]:
        '白いところに「〜 > 500」を入れ、左に「〜の値」を入れて、▼で「赤外線センサー（フォトリフレクタ）(A4)」を選ぼう。',
    [`${C}ctrl-l2-near-light.step4`]:
        '「もし」の中に「左 のLED をオンにする」、「でなければ」の中に「左 のLED をオフにする」を入れよう。',
    [`${C}ctrl-l2-near-light.step5`]:
        '緑の旗を押して、センサーに手を近づけたり、はなしたりしよう。練習用の基板なら、赤外線センサー (A4) のスライダーを動かそう。',
    [`${C}ctrl-l2-near-light.debug1`]:
        '近づけてもつかないときは、「>」の向きと 500 の数を見よう。手を近づけたときの値をはかって決めてもいいよ。',
    [`${C}ctrl-l2-near-light.debug2`]:
        '赤外線センサーが無ければ、▼でほかのセンサーを選んでもいいよ（光センサーなら、明るくするとつく）。',
    [`${C}ctrl-l2-near-light.quiz.question`]: '人が近づいたことを知りたいときに、センサーを選ぶ決め手は？',
    [`${C}ctrl-l2-near-light.quiz.choice1`]: '何を計測したいか',
    [`${C}ctrl-l2-near-light.quiz.choice2`]: 'ブロックの色',
    [`${C}ctrl-l2-near-light.quiz.choice3`]: 'ポートの番号の大きさ',
    [`${C}ctrl-l2-near-light.quiz.explanation`]:
        'センサーは、計測したいもの（明るさ・近さ・ふれたか・音）に合わせて選ぶ。センサーを替えると、同じ形のプログラムで別のシステムになるよ。',
    [`${C}ctrl-l2-read-diagram.name`]: '図から作ろう：夜だけ押しボタン式',
    [`${C}ctrl-l2-read-diagram.task`]:
        '図を読んで、暗い（光センサーの値が 500 より小さい）「かつ」タッチセンサーを押している ときだけ LED (A0) をつけ、そうでなければ消すプログラムを作ろう。',
    [`${C}ctrl-l2-read-diagram.explanation`]:
        '夜だけ、ボタンを押すと明かりがつくしくみ。ひし形の判断は、2 つの条件の両方に合うかどうか。図だけを見て作ってみよう。',
    [`${C}ctrl-l2-read-diagram.quiz.question`]: '2 つの条件の両方に合うときだけ動かすには、どのブロックを使う？',
    [`${C}ctrl-l2-read-diagram.quiz.choice1`]: '「〜かつ〜」',
    [`${C}ctrl-l2-read-diagram.quiz.choice2`]: '「〜または〜」',
    [`${C}ctrl-l2-read-diagram.quiz.choice3`]: '「〜ではない」',
    [`${C}ctrl-l2-read-diagram.quiz.explanation`]:
        '「かつ」は両方に合うとき、「または」はどちらかに合うときに真になる。昼にボタンを押しても、夜でなければつかないよ。',
};

export const jaHira = {
    'gui.lessons.course.jidou-sensor-motor.name': 'じどうで センサーと モーターで うごかそう',
    'gui.lessons.course.jidou-sensor-motor.description':
        'センサーの あたいで LED や モーターを じどうで うごかす けいそく・せいぎょ システムを つくり、じぶんの かだいを かいけつする システムを さくひんに するよ。',
    'gui.lessons.lesson.ctrl-l1.name': 'センサーと LED を ためそう',
    [`${C}ctrl-l1-measure.name`]: 'あかるさを はかろう',
    [`${C}ctrl-l1-measure.task`]:
        'かくちょうきのう「アーテックロボ」を たして、ひかりセンサーの あたいを へんすう「あかるさ」に いれ、ずっと いいつづけよう。\nセンサーに てを かざして（れんしゅうようの きばんなら スライダーを うごかして）、あたいが かわるのを みよう',
    [`${C}ctrl-l1-measure.step1`]:
        'かだいの せつめいと、アクティビティずを りかいしよう。ずで、いちばん したから うえのひしがたへ もどるせんが「ずっと」のくりかえし。センサーで けいそくした あたいを、ずっと がめんに だしつづけるよ。',
    [`${C}ctrl-l1-measure.step2`]:
        'ひだりしたの「かくちょうきのうを ついか」を おして「アーテックロボ」を えらぼう。きばんが あれば USB ケーブルで パソコンに さして「せつぞくする（せいとよう）」を おそう。なければ せつぞくの がめんを とじよう（れんしゅうようの きばんで うごくよ）。',
    [`${C}ctrl-l1-measure.step3`]: '「はたが おされたとき」の したに、「せいぎょ」の「ずっと」を つなげよう。',
    [`${C}ctrl-l1-measure.step4`]:
        '「へんすう」の「へんすうを つくる」で へんすう「あかるさ」を つくろう。「あかるさを 0 にする」を「ずっと」の なかに いれ、しろいところに「アーテックロボ」の「ひかりセンサー (A6) の あたい」を いれよう。',
    [`${C}ctrl-l1-measure.step5`]:
        'その したに「みため」の「いう」を つなげ、しろいところに (あかるさ) を いれよう。',
    [`${C}ctrl-l1-measure.step6`]:
        'みどりのはたを おして、センサーに てを かざしたり、はなしたり しよう。れんしゅうようの きばんなら、パネルの「ひかりセンサー (A6)」の スライダーを うごかそう。',
    [`${C}ctrl-l1-measure.debug1`]:
        'あたいが かわらないときは、ひかりセンサーが A6 に ささっているか みよう。ひかりセンサーが なければ、▼で「せきがいせんセンサー（フォトリフレクタ）(A4)」を えらんでも いいよ。',
    [`${C}ctrl-l1-measure.debug2`]:
        'ずっと おなじ かずの ときは、「いう」の しろいところに (あかるさ) を いれたか みよう。',
    [`${C}ctrl-l1-measure.quiz.question`]:
        'センサーの でんきの しんごうが、がめんでは かずに なって でた。この へんかんを したのは どれ？',
    [`${C}ctrl-l1-measure.quiz.choice1`]: 'スプライト',
    [`${C}ctrl-l1-measure.quiz.choice2`]: 'スタディーノ（インタフェース）',
    [`${C}ctrl-l1-measure.quiz.choice3`]: 'LED',
    [`${C}ctrl-l1-measure.quiz.explanation`]:
        'センサーの アナログの しんごうを、コンピューターが わかる デジタルの かずに かえるのは インタフェースの やくめ。ここでは スタディーノ きばんが インタフェースだよ。',
    [`${C}ctrl-l1-blink.name`]: 'LED を てんめつさせよう',
    [`${C}ctrl-l1-blink.task`]:
        'みどりのはたを おしたら、ひだりの LED (A0) を 1 びょう つけて、1 びょう けす、を ずっと くりかえそう。\nれんしゅうようの きばんなら、パネルの LED の しるしが ついたり きえたり するよ',
    [`${C}ctrl-l1-blink.step1`]:
        'かだいの せつめいと、アクティビティずを りかいしよう。ずで、いちばん したから うえのひしがたへ もどるせんが「ずっと」のくりかえし。',
    [`${C}ctrl-l1-blink.step2`]: '「はたが おされたとき」の したに、「せいぎょ」の「ずっと」を つなげよう。',
    [`${C}ctrl-l1-blink.step3`]:
        '「ずっと」の なかに、「アーテックロボ」の「ひだり の LED を オンにする」と、「せいぎょ」の「1 びょう まつ」を いれよう。',
    [`${C}ctrl-l1-blink.step4`]: 'その したに「ひだり の LED を オフにする」と「1 びょう まつ」を つなげよう。',
    [`${C}ctrl-l1-blink.step5`]:
        'みどりのはたを おして、LED (A0) が ついたり きえたり するのを みよう（れんしゅうようの きばんなら、パネルの LED (A0) の しるし）。',
    [`${C}ctrl-l1-blink.debug1`]:
        'LED が ひからないときは、LED が A0 に ささっているか、ブロックの ▼ が「ひだり」に なっているか みよう。',
    [`${C}ctrl-l1-blink.debug2`]:
        'ついたままの ときは、「オフにする」の あとにも「1 びょう まつ」が あるか みよう。またないと、きえて すぐに つくよ。',
    [`${C}ctrl-l1-blink.quiz.question`]:
        'LED や モーターのように、プログラムの めいれいで うごいて しごとを するものを なんという？',
    [`${C}ctrl-l1-blink.quiz.choice1`]: 'センサー',
    [`${C}ctrl-l1-blink.quiz.choice2`]: 'しごとを おこなう ぶぶん',
    [`${C}ctrl-l1-blink.quiz.choice3`]: 'インタフェース',
    [`${C}ctrl-l1-blink.quiz.explanation`]:
        'LED・モーター・ヒーターなど、めいれいを うけて うごくものが しごとを おこなう ぶぶん。センサーは まわりの ようすを けいそくする ものだよ。',
    [`${C}ctrl-l1-touch-led.name`]: 'タッチセンサーで LED を つけよう',
    [`${C}ctrl-l1-touch-led.task`]:
        'タッチセンサー (A2) を おしている あいだだけ、ひだりの LED (A0) を つけよう。\nタッチセンサーの あたいは、おすと 0、はなすと 1 に なるよ',
    [`${C}ctrl-l1-touch-led.step1`]:
        'かだいの せつめいと、アクティビティずを りかいしよう。ひしがたで、センサーの あたいが 0 かどうかで みちが わかれるよ。',
    [`${C}ctrl-l1-touch-led.step2`]: '「はたが おされたとき」の したに、「せいぎょ」の「ずっと」を つなげよう。',
    [`${C}ctrl-l1-touch-led.step3`]: '「ずっと」の なかに、「せいぎょ」の「もし〜なら でなければ」を いれよう。',
    [`${C}ctrl-l1-touch-led.step4`]:
        '「もし」の しろいところに「えんざん」の「〜 = 0」を いれ、ひだりに「アーテックロボ」の「〜の あたい」を いれて、▼で「タッチセンサー (A2)」を えらぼう。',
    [`${C}ctrl-l1-touch-led.step5`]:
        '「もし」の なかに「ひだり の LED を オンにする」、「でなければ」の なかに「ひだり の LED を オフにする」を いれよう。',
    [`${C}ctrl-l1-touch-led.step6`]:
        'みどりのはたを おして、タッチセンサーを おしたり、はなしたり しよう。れんしゅうようの きばんなら、パネルの「タッチセンサー (A2)」の ボタンを おそう。',
    [`${C}ctrl-l1-touch-led.debug1`]:
        'ぎゃくに なるときは、「= 0」の かずを みよう。タッチセンサーは、おすと 0、はなすと 1 だよ。',
    [`${C}ctrl-l1-touch-led.debug2`]:
        'タッチセンサーが なければ、▼で ほかの センサーを えらんでも いいよ（れんしゅうようの きばんなら、スライダーを 0 に すると「おした」と おなじ）。',
    [`${C}ctrl-l1-touch-led.quiz.question`]:
        'タッチセンサーの あたいは 0 か 1 の 2 つだけ。このように、とびとびの あたいで あらわすことを なんという？',
    [`${C}ctrl-l1-touch-led.quiz.choice1`]: 'アナログ',
    [`${C}ctrl-l1-touch-led.quiz.choice2`]: 'デジタル',
    [`${C}ctrl-l1-touch-led.quiz.choice3`]: 'センサー',
    [`${C}ctrl-l1-touch-led.quiz.explanation`]:
        'とびとびの あたいで あらわすのが デジタル、ひかりの つよさのように きれめなく かわる りょうが アナログ。ひかりセンサーの あたいも、スタディーノで 0〜1023 の デジタルの かずに なるよ。',
    [`${C}ctrl-l1-threshold.name`]: 'さかいめを きめよう',
    [`${C}ctrl-l1-threshold.task`]:
        'ひかりセンサーの あたいが さかいめの 500 より ちいさければ「くらい」、そうでなければ「あかるい」と いいつづけよう。\nおもったとおりに いいわけなければ、てを かざして あたいを たしかめ、500 を かえよう',
    [`${C}ctrl-l1-threshold.step1`]:
        'かだいの せつめいと、アクティビティずを りかいしよう。ひしがたで、けいそくした あたいが さかいめより ちいさいかどうかで みちが わかれるよ。',
    [`${C}ctrl-l1-threshold.step2`]: '「はたが おされたとき」の したに、「せいぎょ」の「ずっと」を つなげよう。',
    [`${C}ctrl-l1-threshold.step3`]: '「ずっと」の なかに、「せいぎょ」の「もし〜なら でなければ」を いれよう。',
    [`${C}ctrl-l1-threshold.step4`]:
        '「もし」の しろいところに「えんざん」の「〜 < 500」を いれ、ひだりに「アーテックロボ」の「ひかりセンサー (A6) の あたい」を いれよう。',
    [`${C}ctrl-l1-threshold.step5`]:
        '「もし」の なかに「くらい と いう」、「でなければ」の なかに「あかるい と いう」を いれよう。',
    [`${C}ctrl-l1-threshold.step6`]:
        'みどりのはたを おして、センサーに てを かざしたり、はなしたり しよう。れんしゅうようの きばんなら、スライダーを 500 より ちいさく、おおきく うごかそう。',
    [`${C}ctrl-l1-threshold.debug1`]:
        'いつも おなじことを いうときは、1-1 のように あかるいときと くらいときの あたいを はかって、その あいだの かずに 500 を かえよう。',
    [`${C}ctrl-l1-threshold.debug2`]:
        'ぎゃくに いうときは、「<」を「>」に するか、「くらい」と「あかるい」を いれかえよう。',
    [`${C}ctrl-l1-threshold.quiz.question`]: 'さかいめの 500 を、きょうしつごとに かえることが あるのは なぜ？',
    [`${C}ctrl-l1-threshold.quiz.choice1`]: 'へやの あかるさで あたいが かわるから',
    [`${C}ctrl-l1-threshold.quiz.choice2`]: '500 は おおきすぎて つかえないから',
    [`${C}ctrl-l1-threshold.quiz.choice3`]: 'センサーが 1 つしか ないから',
    [`${C}ctrl-l1-threshold.quiz.explanation`]:
        'センサーの あたいは、へやの あかるさや つくえの いろで かわる。だから、じっさいに はかってから さかいめを きめるよ。きめた かずが しきいちだよ。',
    'gui.lessons.lesson.ctrl-l2.name': 'じどうで うごかそう',
    [`${C}ctrl-l2-auto-light.name`]: 'じどう てんとう LED ライト',
    [`${C}ctrl-l2-auto-light.task`]:
        'あかるさを けいそくして へんすう「あかるさ」に いれ、さかいめの 500 より ちいさい（くらい）ときは LED (A0) を つけ、そうでなければ けす、を ずっと くりかえそう。\nくらく なったら じどうで つく ライトの かんせいだよ',
    [`${C}ctrl-l2-auto-light.step1`]:
        'かだいの せつめいと、アクティビティずを りかいしよう。「あかるさを けいそくする」→ ひしがたで「くらい？」と はんだん →「LED を つける／けす」の しごと → もどるせんで また けいそく。これが けいそく・せいぎょ システムの かたちだよ。',
    [`${C}ctrl-l2-auto-light.step2`]:
        '「はたが おされたとき」の したに「ずっと」を つなげ、その なかに「あかるさを (ひかりセンサー (A6) の あたい) にする」を いれよう（へんすう「あかるさ」が なければ「へんすうを つくる」で つくろう）。',
    [`${C}ctrl-l2-auto-light.step3`]:
        'その したに「もし〜なら でなければ」を つなげ、しろいところに「〜 < 500」を いれて、ひだりに (あかるさ) を いれよう。',
    [`${C}ctrl-l2-auto-light.step4`]:
        '「もし」の なかに「ひだり の LED を オンにする」、「でなければ」の なかに「ひだり の LED を オフにする」を いれよう。',
    [`${C}ctrl-l2-auto-light.step5`]:
        'みどりのはたを おして、センサーを てで おおったり、はなしたり しよう。れんしゅうようの きばんなら、ひかりセンサーの スライダーを 500 より ちいさく、おおきく うごかそう。',
    [`${C}ctrl-l2-auto-light.debug1`]:
        'LED が つきっぱなしの ときは、「<」の むきと 500 の かずを みよう。レッスン 1 で きめた さかいめに かえても いいよ。',
    [`${C}ctrl-l2-auto-light.debug2`]:
        'すぐ とまって しまうときは、ぜんぶの ブロックが「ずっと」の なかに はいっているか みよう。',
    [`${C}ctrl-l2-auto-light.quiz.question`]: 'この ライトの プログラムから「ずっと」を なくすと、どうなる？',
    [`${C}ctrl-l2-auto-light.quiz.choice1`]: '1 かい はかるだけで、あとは かわらない',
    [`${C}ctrl-l2-auto-light.quiz.choice2`]: 'LED が ずっと てんめつする',
    [`${C}ctrl-l2-auto-light.quiz.choice3`]: 'センサーが こわれる',
    [`${C}ctrl-l2-auto-light.quiz.explanation`]:
        'けいそく・せいぎょ システムは、けいそく → はんだん → しごと を くりかえす。くりかえさないと、1 かい はかった あとは あかるさが かわっても LED は かわらないよ。',
    [`${C}ctrl-l2-near-light.name`]: 'ちかづいたら つけよう',
    [`${C}ctrl-l2-near-light.task`]:
        'せきがいせんセンサー（フォトリフレクタ）(A4) の あたいが 500 より おおきい（なにかが ちかづいた）ときは LED (A0) を つけ、そうでなければ けそう。\nセンサーを かえると、おなじ かたちの プログラムで べつの システムに なるよ',
    [`${C}ctrl-l2-near-light.step1`]:
        'かだいの せつめいと、アクティビティずを りかいしよう。2-1 と おなじ かたちで、けいそくする センサーと、ひしがたの はんだんだけが ちがうよ。',
    [`${C}ctrl-l2-near-light.step2`]:
        '「はたが おされたとき」の したに「ずっと」を つなげ、その なかに「もし〜なら でなければ」を いれよう。',
    [`${C}ctrl-l2-near-light.step3`]:
        'しろいところに「〜 > 500」を いれ、ひだりに「〜の あたい」を いれて、▼で「せきがいせんセンサー（フォトリフレクタ）(A4)」を えらぼう。',
    [`${C}ctrl-l2-near-light.step4`]:
        '「もし」の なかに「ひだり の LED を オンにする」、「でなければ」の なかに「ひだり の LED を オフにする」を いれよう。',
    [`${C}ctrl-l2-near-light.step5`]:
        'みどりのはたを おして、センサーに てを ちかづけたり、はなしたり しよう。れんしゅうようの きばんなら、せきがいせんセンサー (A4) の スライダーを うごかそう。',
    [`${C}ctrl-l2-near-light.debug1`]:
        'ちかづけても つかないときは、「>」の むきと 500 の かずを みよう。てを ちかづけたときの あたいを はかって きめても いいよ。',
    [`${C}ctrl-l2-near-light.debug2`]:
        'せきがいせんセンサーが なければ、▼で ほかの センサーを えらんでも いいよ（ひかりセンサーなら、あかるく すると つく）。',
    [`${C}ctrl-l2-near-light.quiz.question`]: 'ひとが ちかづいたことを しりたいときに、センサーを えらぶ きめては？',
    [`${C}ctrl-l2-near-light.quiz.choice1`]: 'なにを けいそくしたいか',
    [`${C}ctrl-l2-near-light.quiz.choice2`]: 'ブロックの いろ',
    [`${C}ctrl-l2-near-light.quiz.choice3`]: 'ポートの ばんごうの おおきさ',
    [`${C}ctrl-l2-near-light.quiz.explanation`]:
        'センサーは、けいそくしたいもの（あかるさ・ちかさ・ふれたか・おと）に あわせて えらぶ。センサーを かえると、おなじ かたちの プログラムで べつの システムに なるよ。',
    [`${C}ctrl-l2-read-diagram.name`]: 'ずから つくろう：よるだけ おしボタンしき',
    [`${C}ctrl-l2-read-diagram.task`]:
        'ずを よんで、くらい（ひかりセンサーの あたいが 500 より ちいさい）「かつ」タッチセンサーを おしている ときだけ LED (A0) を つけ、そうでなければ けす プログラムを つくろう。',
    [`${C}ctrl-l2-read-diagram.explanation`]:
        'よるだけ、ボタンを おすと あかりが つく しくみ。ひしがたの はんだんは、2 つの じょうけんの りょうほうに あうかどうか。ずだけを みて つくってみよう。',
    [`${C}ctrl-l2-read-diagram.quiz.question`]:
        '2 つの じょうけんの りょうほうに あうときだけ うごかすには、どの ブロックを つかう？',
    [`${C}ctrl-l2-read-diagram.quiz.choice1`]: '「〜かつ〜」',
    [`${C}ctrl-l2-read-diagram.quiz.choice2`]: '「〜または〜」',
    [`${C}ctrl-l2-read-diagram.quiz.choice3`]: '「〜ではない」',
    [`${C}ctrl-l2-read-diagram.quiz.explanation`]:
        '「かつ」は りょうほうに あうとき、「または」は どちらかに あうときに しんに なる。ひるに ボタンを おしても、よるで なければ つかないよ。',
};

export const en = {
    'gui.lessons.course.jidou-sensor-motor.name': 'Move It Automatically with Sensors and Motors',
    'gui.lessons.course.jidou-sensor-motor.description':
        'Build systems that move LEDs and motors automatically by sensor values, then make a system that solves your own problem.',
    'gui.lessons.lesson.ctrl-l1.name': 'Try the Sensors and LEDs',
    [`${C}ctrl-l1-measure.name`]: 'Measure the Brightness',
    [`${C}ctrl-l1-measure.task`]:
        'Add the "ArtecRobo" extension, put the value of the light sensor in the variable "brightness", and keep saying it.\nHold your hand over the sensor (or move the slider of the practice board) and watch the value change',
    [`${C}ctrl-l1-measure.step1`]:
        'Understand the task and the activity diagram. In the diagram, the line that goes back to the diamond is the "forever" loop. You keep showing the value the sensor measures.',
    [`${C}ctrl-l1-measure.step2`]:
        'Press "Add Extension" at the bottom left and choose "ArtecRobo". If you have the board, connect it with USB and press "Connect (for students)". If not, close the connection window (the practice board works instead).',
    [`${C}ctrl-l1-measure.step3`]: 'Attach "forever" from "Control" under "when flag clicked".',
    [`${C}ctrl-l1-measure.step4`]:
        'Make the variable "brightness" with "Make a Variable" in "Variables". Put "set brightness to 0" into "forever", and put "light sensor (A6) value" from "ArtecRobo" into its white part.',
    [`${C}ctrl-l1-measure.step5`]: 'Attach "say" from "Looks" under it, and put (brightness) into its white part.',
    [`${C}ctrl-l1-measure.step6`]:
        'Click the green flag, and hold your hand over the sensor and take it away. On the practice board, move the "light sensor (A6)" slider of the panel.',
    [`${C}ctrl-l1-measure.debug1`]:
        'If the value does not change, check that the light sensor is in A6. If you have no light sensor, you may choose "infrared sensor (photoreflector) (A4)" with ▼.',
    [`${C}ctrl-l1-measure.debug2`]:
        'If it keeps saying the same number, check that (brightness) is in the white part of "say".',
    [`${C}ctrl-l1-measure.quiz.question`]:
        'The electric signal of the sensor showed up as a number on the screen. Which one changed it?',
    [`${C}ctrl-l1-measure.quiz.choice1`]: 'The sprite',
    [`${C}ctrl-l1-measure.quiz.choice2`]: 'Studuino (the interface)',
    [`${C}ctrl-l1-measure.quiz.choice3`]: 'The LED',
    [`${C}ctrl-l1-measure.quiz.explanation`]:
        'The interface changes the analog signal of a sensor into a digital number the computer understands. Here the Studuino board is the interface.',
    [`${C}ctrl-l1-blink.name`]: 'Blink the LED',
    [`${C}ctrl-l1-blink.task`]:
        'When the green flag is clicked, turn on the left LED (A0) for 1 second and off for 1 second, forever.\nOn the practice board, the LED mark of the panel turns on and off',
    [`${C}ctrl-l1-blink.step1`]:
        'Understand the task and the activity diagram. In the diagram, the line that goes back to the diamond is the "forever" loop.',
    [`${C}ctrl-l1-blink.step2`]: 'Attach "forever" from "Control" under "when flag clicked".',
    [`${C}ctrl-l1-blink.step3`]:
        'Put "turn left LED on" from "ArtecRobo" and "wait 1 seconds" from "Control" into "forever".',
    [`${C}ctrl-l1-blink.step4`]: 'Attach "turn left LED off" and "wait 1 seconds" under them.',
    [`${C}ctrl-l1-blink.step5`]:
        'Click the green flag and watch the LED (A0) turn on and off (on the practice board, the LED (A0) mark of the panel).',
    [`${C}ctrl-l1-blink.debug1`]:
        'If the LED does not light, check that the LED is in A0 and that ▼ of the block is "left".',
    [`${C}ctrl-l1-blink.debug2`]:
        'If it stays on, check that "wait 1 seconds" is also after "off". Without waiting, it turns on right after it turns off.',
    [`${C}ctrl-l1-blink.quiz.question`]:
        'What do we call parts like LEDs and motors that move and do work by the commands of a program?',
    [`${C}ctrl-l1-blink.quiz.choice1`]: 'Sensors',
    [`${C}ctrl-l1-blink.quiz.choice2`]: 'Parts that do work',
    [`${C}ctrl-l1-blink.quiz.choice3`]: 'Interfaces',
    [`${C}ctrl-l1-blink.quiz.explanation`]:
        'LEDs, motors and heaters move when they get commands: they are the parts that do work. Sensors measure what is around them.',
    [`${C}ctrl-l1-touch-led.name`]: 'Light the LED with the Touch Sensor',
    [`${C}ctrl-l1-touch-led.task`]:
        'Turn on the left LED (A0) only while the touch sensor (A2) is pressed.\nThe value of the touch sensor is 0 when pressed and 1 when released',
    [`${C}ctrl-l1-touch-led.step1`]:
        'Understand the task and the activity diagram. At the diamond, the path splits by whether the sensor value is 0.',
    [`${C}ctrl-l1-touch-led.step2`]: 'Attach "forever" from "Control" under "when flag clicked".',
    [`${C}ctrl-l1-touch-led.step3`]: 'Put "if then else" from "Control" into "forever".',
    [`${C}ctrl-l1-touch-led.step4`]:
        'Put "= 0" from "Operators" into the white part of "if", put "value" from "ArtecRobo" on its left, and choose "touch sensor (A2)" with ▼.',
    [`${C}ctrl-l1-touch-led.step5`]: 'Put "turn left LED on" into "if" and "turn left LED off" into "else".',
    [`${C}ctrl-l1-touch-led.step6`]:
        'Click the green flag, and press and release the touch sensor. On the practice board, press the "touch sensor (A2)" button of the panel.',
    [`${C}ctrl-l1-touch-led.debug1`]:
        'If it works the other way, check the number of "= 0". The touch sensor is 0 when pressed and 1 when released.',
    [`${C}ctrl-l1-touch-led.debug2`]:
        'If you have no touch sensor, you may choose another sensor with ▼ (on the practice board, a slider at 0 is the same as "pressed").',
    [`${C}ctrl-l1-touch-led.quiz.question`]:
        'The touch sensor has only 2 values, 0 and 1. What do we call showing things with separate steps like this?',
    [`${C}ctrl-l1-touch-led.quiz.choice1`]: 'Analog',
    [`${C}ctrl-l1-touch-led.quiz.choice2`]: 'Digital',
    [`${C}ctrl-l1-touch-led.quiz.choice3`]: 'Sensor',
    [`${C}ctrl-l1-touch-led.quiz.explanation`]:
        'Digital shows things with separate steps; analog is an amount that changes smoothly, like the strength of light. Studuino turns the light sensor value into a digital number from 0 to 1023.',
    [`${C}ctrl-l1-threshold.name`]: 'Decide the Border Value',
    [`${C}ctrl-l1-threshold.task`]:
        'Keep saying "dark" when the light sensor value is less than the border value 500, and "bright" when it is not.\nIf it does not say the right word, check the values with your hand and change 500',
    [`${C}ctrl-l1-threshold.step1`]:
        'Understand the task and the activity diagram. At the diamond, the path splits by whether the measured value is less than the border value.',
    [`${C}ctrl-l1-threshold.step2`]: 'Attach "forever" from "Control" under "when flag clicked".',
    [`${C}ctrl-l1-threshold.step3`]: 'Put "if then else" from "Control" into "forever".',
    [`${C}ctrl-l1-threshold.step4`]:
        'Put "< 500" from "Operators" into the white part of "if", and put "light sensor (A6) value" from "ArtecRobo" on its left.',
    [`${C}ctrl-l1-threshold.step5`]: 'Put "say dark" into "if" and "say bright" into "else".',
    [`${C}ctrl-l1-threshold.step6`]:
        'Click the green flag, and hold your hand over the sensor and take it away. On the practice board, move the slider below and above 500.',
    [`${C}ctrl-l1-threshold.debug1`]:
        'If it always says the same word, measure the values when bright and dark as in 1-1, and change 500 to a number between them.',
    [`${C}ctrl-l1-threshold.debug2`]: 'If it says the opposite, change "<" to ">", or swap "dark" and "bright".',
    [`${C}ctrl-l1-threshold.quiz.question`]: 'Why might you change the border value 500 in each classroom?',
    [`${C}ctrl-l1-threshold.quiz.choice1`]: 'The room light changes the value',
    [`${C}ctrl-l1-threshold.quiz.choice2`]: '500 is too big to use',
    [`${C}ctrl-l1-threshold.quiz.choice3`]: 'There is only one sensor',
    [`${C}ctrl-l1-threshold.quiz.explanation`]:
        'Sensor values change with the light of the room and the color of the desk. So measure first, then decide the border value (the threshold).',
    'gui.lessons.lesson.ctrl-l2.name': 'Move It Automatically',
    [`${C}ctrl-l2-auto-light.name`]: 'Automatic LED Light',
    [`${C}ctrl-l2-auto-light.task`]:
        'Forever: measure the brightness into the variable "brightness", turn on the LED (A0) when it is less than the border value 500 (dark), and turn it off when it is not.\nThis is a light that turns on by itself when it gets dark',
    [`${C}ctrl-l2-auto-light.step1`]:
        'Understand the task and the activity diagram. "Measure the brightness" → judge "dark?" at the diamond → the work "turn the LED on / off" → back along the line to measure again. This is the shape of a measurement and control system.',
    [`${C}ctrl-l2-auto-light.step2`]:
        'Attach "forever" under "when flag clicked", and put "set brightness to (light sensor (A6) value)" into it (if there is no variable "brightness", make it with "Make a Variable").',
    [`${C}ctrl-l2-auto-light.step3`]:
        'Attach "if then else" under it, put "< 500" into its white part, and put (brightness) on the left.',
    [`${C}ctrl-l2-auto-light.step4`]: 'Put "turn left LED on" into "if" and "turn left LED off" into "else".',
    [`${C}ctrl-l2-auto-light.step5`]:
        'Click the green flag, and cover the sensor with your hand and take it away. On the practice board, move the light sensor slider below and above 500.',
    [`${C}ctrl-l2-auto-light.debug1`]:
        'If the LED stays on, check the direction of "<" and the number 500. You may use the border value you decided in lesson 1.',
    [`${C}ctrl-l2-auto-light.debug2`]: 'If it stops at once, check that all the blocks are inside "forever".',
    [`${C}ctrl-l2-auto-light.quiz.question`]: 'What happens if you take "forever" out of this light program?',
    [`${C}ctrl-l2-auto-light.quiz.choice1`]: 'It measures once and never changes',
    [`${C}ctrl-l2-auto-light.quiz.choice2`]: 'The LED blinks forever',
    [`${C}ctrl-l2-auto-light.quiz.choice3`]: 'The sensor breaks',
    [`${C}ctrl-l2-auto-light.quiz.explanation`]:
        'A measurement and control system repeats measure → judge → work. Without repeating, the LED does not change after the first measurement even if the brightness changes.',
    [`${C}ctrl-l2-near-light.name`]: 'Light Up When Something Comes Near',
    [`${C}ctrl-l2-near-light.task`]:
        'Turn on the LED (A0) when the infrared sensor (photoreflector) (A4) value is more than 500 (something came near), and turn it off when it is not.\nWith another sensor, the same shape of program becomes another system',
    [`${C}ctrl-l2-near-light.step1`]:
        'Understand the task and the activity diagram. It has the same shape as 2-1; only the sensor and the judgement at the diamond are different.',
    [`${C}ctrl-l2-near-light.step2`]: 'Attach "forever" under "when flag clicked", and put "if then else" into it.',
    [`${C}ctrl-l2-near-light.step3`]:
        'Put "> 500" into its white part, put "value" on the left, and choose "infrared sensor (photoreflector) (A4)" with ▼.',
    [`${C}ctrl-l2-near-light.step4`]: 'Put "turn left LED on" into "if" and "turn left LED off" into "else".',
    [`${C}ctrl-l2-near-light.step5`]:
        'Click the green flag, and bring your hand near the sensor and take it away. On the practice board, move the infrared sensor (A4) slider.',
    [`${C}ctrl-l2-near-light.debug1`]:
        'If it does not light up when you come near, check the direction of ">" and the number 500. You may measure the value with your hand near and decide.',
    [`${C}ctrl-l2-near-light.debug2`]:
        'If you have no infrared sensor, you may choose another sensor with ▼ (with the light sensor, it lights up when it is bright).',
    [`${C}ctrl-l2-near-light.quiz.question`]: 'To know that a person came near, what decides which sensor to use?',
    [`${C}ctrl-l2-near-light.quiz.choice1`]: 'What you want to measure',
    [`${C}ctrl-l2-near-light.quiz.choice2`]: 'The color of the block',
    [`${C}ctrl-l2-near-light.quiz.choice3`]: 'The size of the port number',
    [`${C}ctrl-l2-near-light.quiz.explanation`]:
        'Choose the sensor for what you want to measure (brightness, nearness, touch, sound). With another sensor, the same shape of program becomes another system.',
    [`${C}ctrl-l2-read-diagram.name`]: 'Build from the Diagram: Night Push Button',
    [`${C}ctrl-l2-read-diagram.task`]:
        'Read the diagram and make a program that turns on the LED (A0) only when it is dark (light sensor value less than 500) "and" the touch sensor is pressed, and turns it off when not.',
    [`${C}ctrl-l2-read-diagram.explanation`]:
        'A light that turns on with a button only at night. The diamond checks whether both of 2 conditions are true. Try to make it only from the diagram.',
    [`${C}ctrl-l2-read-diagram.quiz.question`]:
        'Which block do you use to move only when both of 2 conditions are true?',
    [`${C}ctrl-l2-read-diagram.quiz.choice1`]: '"and"',
    [`${C}ctrl-l2-read-diagram.quiz.choice2`]: '"or"',
    [`${C}ctrl-l2-read-diagram.quiz.choice3`]: '"not"',
    [`${C}ctrl-l2-read-diagram.quiz.explanation`]:
        '"and" is true when both are true; "or" is true when either is. Pressing the button in the daytime does not turn it on.',
};
