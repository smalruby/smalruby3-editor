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
    // レッスン 3「モーターで動かそう」（#2172・ワークシート第 4 時）
    'gui.lessons.lesson.ctrl-l3.name': 'モーターで動かそう',
    [`${C}ctrl-l3-dc-motor.name`]: 'DC モーターを動かそう',
    [`${C}ctrl-l3-dc-motor.task`]:
        '緑の旗を押したら、DC モーター (M1) を 0.5 秒正転させ、1 秒待って、0.5 秒逆転させよう。\n実機では電池ボックスのスイッチを ON にしよう（USB だけではモーターは回らない）',
    [`${C}ctrl-l3-dc-motor.step1`]:
        '課題の説明と、アクティビティ図を理解しよう。上から順に、正転 → 待つ → 逆転と仕事をするよ。DC モーターは回り続け、向きを変えられる。',
    [`${C}ctrl-l3-dc-motor.step2`]:
        '「旗が押されたとき」の下に、「アーテックロボ」の「0.5 秒 DCモーター M1 を 正転させる」をつなげよう。',
    [`${C}ctrl-l3-dc-motor.step3`]:
        'その下に「1 秒待つ」と、もう 1 つの「0.5 秒 DCモーター M1 を 〜」をつなげ、▼で「逆転させる」を選ぼう。',
    [`${C}ctrl-l3-dc-motor.step4`]:
        '緑の旗を押して、モーターが回る向きを見よう（練習用の基板なら、パネルの DC モーター (M1) の ↻ と ↺）。',
    [`${C}ctrl-l3-dc-motor.debug1`]:
        '実機で回らないときは、電池ボックスのスイッチが ON か、モーターが M1 にささっているか見よう。',
    [`${C}ctrl-l3-dc-motor.debug2`]: '同じ向きにしか回らないときは、2 つめのブロックの ▼ が「逆転させる」か見よう。',
    [`${C}ctrl-l3-dc-motor.quiz.question`]: 'DC モーターの回る向きを反対にするには？',
    [`${C}ctrl-l3-dc-motor.quiz.choice1`]: '逆転させる',
    [`${C}ctrl-l3-dc-motor.quiz.choice2`]: '角度を変える',
    [`${C}ctrl-l3-dc-motor.quiz.choice3`]: '速さを 0 にする',
    [`${C}ctrl-l3-dc-motor.quiz.explanation`]:
        'DC モーターは、流す電気の向きを変えると反対に回る。正転・逆転で、タイヤを前にも後ろにも回せるよ。',
    [`${C}ctrl-l3-servo.name`]: 'サーボで角度を決めよう',
    [`${C}ctrl-l3-servo.task`]:
        '緑の旗を押したら、1 秒でアーム（サーボモーター D10）を 0 度にし、1 秒待って、1 秒で 90 度にしよう。\nスイッチをちょうど押せる角度をさがしてもいいよ',
    [`${C}ctrl-l3-servo.step1`]:
        '課題の説明と、アクティビティ図を理解しよう。サーボモーターは、決めた角度まで動いて止まるよ。',
    [`${C}ctrl-l3-servo.step2`]:
        '「旗が押されたとき」の下に「1 秒でアーム（サーボモーター D10）を 0 度に曲げる」をつなげよう（90 を 0 に変えよう）。',
    [`${C}ctrl-l3-servo.step3`]: 'その下に「1 秒待つ」と、もう 1 つの「1 秒でアームを 90 度に曲げる」をつなげよう。',
    [`${C}ctrl-l3-servo.step4`]:
        '緑の旗を押して、アームの角度が変わるのを見よう（練習用の基板なら、パネルのサーボモーター (D10) の角度）。',
    [`${C}ctrl-l3-servo.debug1`]:
        '実機で動かないときは、サーボモーターが D10 にささっているか、電池ボックスが ON か見よう。',
    [`${C}ctrl-l3-servo.debug2`]:
        'いきなり大きく動かすとはずれることがある。10 度ずつ変えて、ちょうどよい角度をさがそう。',
    [`${C}ctrl-l3-servo.quiz.question`]: 'DC モーターとちがって、サーボモーターが得意なことは？',
    [`${C}ctrl-l3-servo.quiz.choice1`]: '決めた角度で止まる',
    [`${C}ctrl-l3-servo.quiz.choice2`]: 'ずっと回り続ける',
    [`${C}ctrl-l3-servo.quiz.choice3`]: '明るさをはかる',
    [`${C}ctrl-l3-servo.quiz.explanation`]:
        'サーボモーターは角度を決めて止まるので、スイッチを押す・ふたを開けるのに向いている。DC モーターはタイヤを回すのに向いているよ。',
    [`${C}ctrl-l3-auto-switch.name`]: '自動スイッチを作ろう',
    [`${C}ctrl-l3-auto-switch.task`]:
        '光センサーの値が 500 より小さい（暗い）ときはアームを 90 度にしてスイッチを押し、そうでなければ 0 度にもどそう。\n暗くなったら自動でスイッチを入れるしくみだよ',
    [`${C}ctrl-l3-auto-switch.step1`]:
        '課題の説明と、アクティビティ図を理解しよう。自動点灯 LED ライトの「LED」を「アーム」に替えた形だよ。',
    [`${C}ctrl-l3-auto-switch.step2`]:
        '「旗が押されたとき」の下に「ずっと」をつなげ、その中に「もし〜なら でなければ」を入れよう。',
    [`${C}ctrl-l3-auto-switch.step3`]: '白いところに「〜 < 500」を入れ、左に「光センサー (A6) の値」を入れよう。',
    [`${C}ctrl-l3-auto-switch.step4`]:
        '「もし」の中に「1 秒でアームを 90 度に曲げる」、「でなければ」の中に「1 秒でアームを 0 度に曲げる」を入れよう。',
    [`${C}ctrl-l3-auto-switch.step5`]:
        '緑の旗を押して、センサーを手でおおったり、はなしたりしよう。練習用の基板なら、光センサーのスライダーを動かして、アームの角度を見よう。',
    [`${C}ctrl-l3-auto-switch.debug1`]: '逆に動くときは、「<」の向きか、90 と 0 を入れかえよう。',
    [`${C}ctrl-l3-auto-switch.debug2`]:
        '光センサーが無ければ、▼でほかのセンサーを選んでもいいよ（値が 500 より小さいときに 90 度になる）。',
    [`${C}ctrl-l3-auto-switch.quiz.question`]:
        'アームの力が足りずスイッチを押せない。力（トルク）を大きくする工夫は？',
    [`${C}ctrl-l3-auto-switch.quiz.choice1`]: 'ギヤ比を変えて大きい歯車を回す',
    [`${C}ctrl-l3-auto-switch.quiz.choice2`]: '角度を 180 度にする',
    [`${C}ctrl-l3-auto-switch.quiz.choice3`]: 'プログラムを速くする',
    [`${C}ctrl-l3-auto-switch.quiz.explanation`]:
        '小さい歯車から大きい歯車に回すと、回る速さはおそくなるが力は大きくなる。てこを使う・押す場所を変える工夫もあるよ。実物で試そう。',
    [`${C}ctrl-l3-bumper-car.name`]: 'ぶつかったら止まる車',
    [`${C}ctrl-l3-bumper-car.task`]:
        'タッチセンサー (A2) が押された（ぶつかった）ら車を止め、そうでなければ前に進めよう。\n車は 2 つの DC モーター (M1, M2) で動くよ',
    [`${C}ctrl-l3-bumper-car.step1`]:
        '課題の説明と、アクティビティ図を理解しよう。ひし形で「ぶつかった？」と判断して、止めるか進めるかを決めるよ。',
    [`${C}ctrl-l3-bumper-car.step2`]:
        '「旗が押されたとき」の下に「ずっと」をつなげ、その中に「もし〜なら でなければ」を入れよう。',
    [`${C}ctrl-l3-bumper-car.step3`]:
        '白いところに「〜 = 0」を入れ、左に「〜の値」を入れて、▼で「タッチセンサー (A2)」を選ぼう。',
    [`${C}ctrl-l3-bumper-car.step4`]:
        '「もし」の中に「止める (M1, M2)」、「でなければ」の中に「進める (M1, M2)」を入れよう（「アーテックロボ」のいちばん上のブロックの ▼）。',
    [`${C}ctrl-l3-bumper-car.step5`]:
        '緑の旗を押して、タッチセンサーを押したり、はなしたりしよう。練習用の基板なら、タッチセンサーのボタンを押して、DC モーターの ↻ と ■ を見よう。',
    [`${C}ctrl-l3-bumper-car.debug1`]:
        '実機で動かないときは、電池ボックスが ON か、モーターが M1 と M2 にささっているか見よう。',
    [`${C}ctrl-l3-bumper-car.debug2`]:
        'タッチセンサーが無ければ、▼でほかのセンサーを選んでもいいよ（練習用の基板なら、スライダーを 0 にすると止まる）。',
    [`${C}ctrl-l3-bumper-car.quiz.question`]: 'ぶつかったことを知って止まるしくみは、身のまわりのどこにある？',
    [`${C}ctrl-l3-bumper-car.quiz.choice1`]: 'エレベーターのドア',
    [`${C}ctrl-l3-bumper-car.quiz.choice2`]: 'テレビのリモコン',
    [`${C}ctrl-l3-bumper-car.quiz.choice3`]: 'えんぴつけずり',
    [`${C}ctrl-l3-bumper-car.quiz.explanation`]:
        'エレベーターのドアは、人やものにふれたことをセンサーで計測すると、閉まるのをやめて開く。安全のための計測・制御システムだよ。',
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
    'gui.lessons.lesson.ctrl-l3.name': 'モーターで うごかそう',
    [`${C}ctrl-l3-dc-motor.name`]: 'DC モーターを うごかそう',
    [`${C}ctrl-l3-dc-motor.task`]:
        'みどりのはたを おしたら、DC モーター (M1) を 0.5 びょう せいてんさせ、1 びょう まって、0.5 びょう ぎゃくてんさせよう。\nじっきでは でんちボックスの スイッチを ON に しよう（USB だけでは モーターは まわらない）',
    [`${C}ctrl-l3-dc-motor.step1`]:
        'かだいの せつめいと、アクティビティずを りかいしよう。うえから じゅんに、せいてん → まつ → ぎゃくてん と しごとを するよ。DC モーターは まわりつづけ、むきを かえられる。',
    [`${C}ctrl-l3-dc-motor.step2`]:
        '「はたが おされたとき」の したに、「アーテックロボ」の「0.5 びょう DC モーター M1 を せいてんさせる」を つなげよう。',
    [`${C}ctrl-l3-dc-motor.step3`]:
        'その したに「1 びょう まつ」と、もう 1 つの「0.5 びょう DC モーター M1 を 〜」を つなげ、▼で「ぎゃくてんさせる」を えらぼう。',
    [`${C}ctrl-l3-dc-motor.step4`]:
        'みどりのはたを おして、モーターが まわる むきを みよう（れんしゅうようの きばんなら、パネルの DC モーター (M1) の ↻ と ↺）。',
    [`${C}ctrl-l3-dc-motor.debug1`]:
        'じっきで まわらないときは、でんちボックスの スイッチが ON か、モーターが M1 に ささっているか みよう。',
    [`${C}ctrl-l3-dc-motor.debug2`]:
        'おなじ むきにしか まわらないときは、2 つめの ブロックの ▼ が「ぎゃくてんさせる」か みよう。',
    [`${C}ctrl-l3-dc-motor.quiz.question`]: 'DC モーターの まわる むきを はんたいに するには？',
    [`${C}ctrl-l3-dc-motor.quiz.choice1`]: 'ぎゃくてんさせる',
    [`${C}ctrl-l3-dc-motor.quiz.choice2`]: 'かくどを かえる',
    [`${C}ctrl-l3-dc-motor.quiz.choice3`]: 'はやさを 0 に する',
    [`${C}ctrl-l3-dc-motor.quiz.explanation`]:
        'DC モーターは、ながす でんきの むきを かえると はんたいに まわる。せいてん・ぎゃくてんで、タイヤを まえにも うしろにも まわせるよ。',
    [`${C}ctrl-l3-servo.name`]: 'サーボで かくどを きめよう',
    [`${C}ctrl-l3-servo.task`]:
        'みどりのはたを おしたら、1 びょうで アーム（サーボモーター D10）を 0 どに し、1 びょう まって、1 びょうで 90 どに しよう。\nスイッチを ちょうど おせる かくどを さがしても いいよ',
    [`${C}ctrl-l3-servo.step1`]:
        'かだいの せつめいと、アクティビティずを りかいしよう。サーボモーターは、きめた かくどまで うごいて とまるよ。',
    [`${C}ctrl-l3-servo.step2`]:
        '「はたが おされたとき」の したに「1 びょうで アーム（サーボモーター D10）を 0 どに まげる」を つなげよう（90 を 0 に かえよう）。',
    [`${C}ctrl-l3-servo.step3`]:
        'その したに「1 びょう まつ」と、もう 1 つの「1 びょうで アームを 90 どに まげる」を つなげよう。',
    [`${C}ctrl-l3-servo.step4`]:
        'みどりのはたを おして、アームの かくどが かわるのを みよう（れんしゅうようの きばんなら、パネルの サーボモーター (D10) の かくど）。',
    [`${C}ctrl-l3-servo.debug1`]:
        'じっきで うごかないときは、サーボモーターが D10 に ささっているか、でんちボックスが ON か みよう。',
    [`${C}ctrl-l3-servo.debug2`]:
        'いきなり おおきく うごかすと はずれることが ある。10 どずつ かえて、ちょうどよい かくどを さがそう。',
    [`${C}ctrl-l3-servo.quiz.question`]: 'DC モーターと ちがって、サーボモーターが とくいなことは？',
    [`${C}ctrl-l3-servo.quiz.choice1`]: 'きめた かくどで とまる',
    [`${C}ctrl-l3-servo.quiz.choice2`]: 'ずっと まわりつづける',
    [`${C}ctrl-l3-servo.quiz.choice3`]: 'あかるさを はかる',
    [`${C}ctrl-l3-servo.quiz.explanation`]:
        'サーボモーターは かくどを きめて とまるので、スイッチを おす・ふたを あけるのに むいている。DC モーターは タイヤを まわすのに むいているよ。',
    [`${C}ctrl-l3-auto-switch.name`]: 'じどう スイッチを つくろう',
    [`${C}ctrl-l3-auto-switch.task`]:
        'ひかりセンサーの あたいが 500 より ちいさい（くらい）ときは アームを 90 どに して スイッチを おし、そうでなければ 0 どに もどそう。\nくらく なったら じどうで スイッチを いれる しくみだよ',
    [`${C}ctrl-l3-auto-switch.step1`]:
        'かだいの せつめいと、アクティビティずを りかいしよう。じどう てんとう LED ライトの「LED」を「アーム」に かえた かたちだよ。',
    [`${C}ctrl-l3-auto-switch.step2`]:
        '「はたが おされたとき」の したに「ずっと」を つなげ、その なかに「もし〜なら でなければ」を いれよう。',
    [`${C}ctrl-l3-auto-switch.step3`]:
        'しろいところに「〜 < 500」を いれ、ひだりに「ひかりセンサー (A6) の あたい」を いれよう。',
    [`${C}ctrl-l3-auto-switch.step4`]:
        '「もし」の なかに「1 びょうで アームを 90 どに まげる」、「でなければ」の なかに「1 びょうで アームを 0 どに まげる」を いれよう。',
    [`${C}ctrl-l3-auto-switch.step5`]:
        'みどりのはたを おして、センサーを てで おおったり、はなしたり しよう。れんしゅうようの きばんなら、ひかりセンサーの スライダーを うごかして、アームの かくどを みよう。',
    [`${C}ctrl-l3-auto-switch.debug1`]: 'ぎゃくに うごくときは、「<」の むきか、90 と 0 を いれかえよう。',
    [`${C}ctrl-l3-auto-switch.debug2`]:
        'ひかりセンサーが なければ、▼で ほかの センサーを えらんでも いいよ（あたいが 500 より ちいさいときに 90 どに なる）。',
    [`${C}ctrl-l3-auto-switch.quiz.question`]:
        'アームの ちからが たりず スイッチを おせない。ちから（トルク）を おおきくする くふうは？',
    [`${C}ctrl-l3-auto-switch.quiz.choice1`]: 'ギヤひを かえて おおきい はぐるまを まわす',
    [`${C}ctrl-l3-auto-switch.quiz.choice2`]: 'かくどを 180 どに する',
    [`${C}ctrl-l3-auto-switch.quiz.choice3`]: 'プログラムを はやく する',
    [`${C}ctrl-l3-auto-switch.quiz.explanation`]:
        'ちいさい はぐるまから おおきい はぐるまに まわすと、まわる はやさは おそく なるが ちからは おおきく なる。てこを つかう・おす ばしょを かえる くふうも あるよ。じつぶつで ためそう。',
    [`${C}ctrl-l3-bumper-car.name`]: 'ぶつかったら とまる くるま',
    [`${C}ctrl-l3-bumper-car.task`]:
        'タッチセンサー (A2) が おされた（ぶつかった）ら くるまを とめ、そうでなければ まえに すすめよう。\nくるまは 2 つの DC モーター (M1, M2) で うごくよ',
    [`${C}ctrl-l3-bumper-car.step1`]:
        'かだいの せつめいと、アクティビティずを りかいしよう。ひしがたで「ぶつかった？」と はんだんして、とめるか すすめるかを きめるよ。',
    [`${C}ctrl-l3-bumper-car.step2`]:
        '「はたが おされたとき」の したに「ずっと」を つなげ、その なかに「もし〜なら でなければ」を いれよう。',
    [`${C}ctrl-l3-bumper-car.step3`]:
        'しろいところに「〜 = 0」を いれ、ひだりに「〜の あたい」を いれて、▼で「タッチセンサー (A2)」を えらぼう。',
    [`${C}ctrl-l3-bumper-car.step4`]:
        '「もし」の なかに「とめる (M1, M2)」、「でなければ」の なかに「すすめる (M1, M2)」を いれよう（「アーテックロボ」の いちばん うえの ブロックの ▼）。',
    [`${C}ctrl-l3-bumper-car.step5`]:
        'みどりのはたを おして、タッチセンサーを おしたり、はなしたり しよう。れんしゅうようの きばんなら、タッチセンサーの ボタンを おして、DC モーターの ↻ と ■ を みよう。',
    [`${C}ctrl-l3-bumper-car.debug1`]:
        'じっきで うごかないときは、でんちボックスが ON か、モーターが M1 と M2 に ささっているか みよう。',
    [`${C}ctrl-l3-bumper-car.debug2`]:
        'タッチセンサーが なければ、▼で ほかの センサーを えらんでも いいよ（れんしゅうようの きばんなら、スライダーを 0 に すると とまる）。',
    [`${C}ctrl-l3-bumper-car.quiz.question`]: 'ぶつかったことを しって とまる しくみは、みのまわりの どこに ある？',
    [`${C}ctrl-l3-bumper-car.quiz.choice1`]: 'エレベーターの ドア',
    [`${C}ctrl-l3-bumper-car.quiz.choice2`]: 'テレビの リモコン',
    [`${C}ctrl-l3-bumper-car.quiz.choice3`]: 'えんぴつけずり',
    [`${C}ctrl-l3-bumper-car.quiz.explanation`]:
        'エレベーターの ドアは、ひとや ものに ふれたことを センサーで けいそくすると、しまるのを やめて ひらく。あんぜんの ための けいそく・せいぎょ システムだよ。',
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
    'gui.lessons.lesson.ctrl-l3.name': 'Move It with Motors',
    [`${C}ctrl-l3-dc-motor.name`]: 'Run the DC Motor',
    [`${C}ctrl-l3-dc-motor.task`]:
        'When the green flag is clicked, run the DC motor (M1) forward for 0.5 seconds, wait 1 second, and run it in reverse for 0.5 seconds.\nOn the real board, turn the battery box switch ON (USB alone cannot turn the motor)',
    [`${C}ctrl-l3-dc-motor.step1`]:
        'Understand the task and the activity diagram. From the top: forward → wait → reverse. A DC motor keeps turning and can change its direction.',
    [`${C}ctrl-l3-dc-motor.step2`]:
        'Attach "0.5 seconds DC motor M1 forward" from "ArtecRobo" under "when flag clicked".',
    [`${C}ctrl-l3-dc-motor.step3`]:
        'Attach "wait 1 seconds" and another "0.5 seconds DC motor M1" under it, and choose "reverse" with ▼.',
    [`${C}ctrl-l3-dc-motor.step4`]:
        'Click the green flag and watch the direction of the motor (on the practice board, ↻ and ↺ of DC motor (M1) of the panel).',
    [`${C}ctrl-l3-dc-motor.debug1`]:
        'If it does not turn on the real board, check that the battery box is ON and the motor is in M1.',
    [`${C}ctrl-l3-dc-motor.debug2`]: 'If it turns only one way, check that ▼ of the 2nd block is "reverse".',
    [`${C}ctrl-l3-dc-motor.quiz.question`]: 'How do you make the DC motor turn the other way?',
    [`${C}ctrl-l3-dc-motor.quiz.choice1`]: 'Run it in reverse',
    [`${C}ctrl-l3-dc-motor.quiz.choice2`]: 'Change the angle',
    [`${C}ctrl-l3-dc-motor.quiz.choice3`]: 'Set the speed to 0',
    [`${C}ctrl-l3-dc-motor.quiz.explanation`]:
        'A DC motor turns the other way when the electric current flows the other way. With forward and reverse, you can turn a tire both ways.',
    [`${C}ctrl-l3-servo.name`]: 'Set the Angle with the Servo',
    [`${C}ctrl-l3-servo.task`]:
        'When the green flag is clicked, move the arm (servo motor D10) to 0 degrees in 1 second, wait 1 second, and move it to 90 degrees in 1 second.\nYou may look for the angle that just presses the switch',
    [`${C}ctrl-l3-servo.step1`]:
        'Understand the task and the activity diagram. A servo motor moves to the angle you set and stops.',
    [`${C}ctrl-l3-servo.step2`]:
        'Attach "bend the arm (servo motor D10) to 0 degrees in 1 seconds" under "when flag clicked" (change 90 to 0).',
    [`${C}ctrl-l3-servo.step3`]:
        'Attach "wait 1 seconds" and another "bend the arm to 90 degrees in 1 seconds" under it.',
    [`${C}ctrl-l3-servo.step4`]:
        'Click the green flag and watch the angle of the arm change (on the practice board, the angle of servo motor (D10) of the panel).',
    [`${C}ctrl-l3-servo.debug1`]:
        'If it does not move on the real board, check that the servo motor is in D10 and the battery box is ON.',
    [`${C}ctrl-l3-servo.debug2`]:
        'A big move at once may knock things off. Change it 10 degrees at a time to find a good angle.',
    [`${C}ctrl-l3-servo.quiz.question`]: 'Unlike a DC motor, what is a servo motor good at?',
    [`${C}ctrl-l3-servo.quiz.choice1`]: 'Stopping at a set angle',
    [`${C}ctrl-l3-servo.quiz.choice2`]: 'Turning forever',
    [`${C}ctrl-l3-servo.quiz.choice3`]: 'Measuring brightness',
    [`${C}ctrl-l3-servo.quiz.explanation`]:
        'A servo motor stops at a set angle, so it is good for pressing a switch or opening a lid. A DC motor is good for turning tires.',
    [`${C}ctrl-l3-auto-switch.name`]: 'Make an Automatic Switch',
    [`${C}ctrl-l3-auto-switch.task`]:
        'When the light sensor value is less than 500 (dark), move the arm to 90 degrees to press the switch; when it is not, move it back to 0 degrees.\nIt turns the switch on by itself when it gets dark',
    [`${C}ctrl-l3-auto-switch.step1`]:
        'Understand the task and the activity diagram. It is the automatic LED light with the "LED" changed to the "arm".',
    [`${C}ctrl-l3-auto-switch.step2`]: 'Attach "forever" under "when flag clicked", and put "if then else" into it.',
    [`${C}ctrl-l3-auto-switch.step3`]:
        'Put "< 500" into its white part, and put "light sensor (A6) value" on the left.',
    [`${C}ctrl-l3-auto-switch.step4`]:
        'Put "bend the arm to 90 degrees in 1 seconds" into "if" and "bend the arm to 0 degrees in 1 seconds" into "else".',
    [`${C}ctrl-l3-auto-switch.step5`]:
        'Click the green flag, and cover the sensor with your hand and take it away. On the practice board, move the light sensor slider and watch the angle of the arm.',
    [`${C}ctrl-l3-auto-switch.debug1`]: 'If it moves the opposite way, change the direction of "<" or swap 90 and 0.',
    [`${C}ctrl-l3-auto-switch.debug2`]:
        'If you have no light sensor, you may choose another sensor with ▼ (it goes to 90 degrees when the value is less than 500).',
    [`${C}ctrl-l3-auto-switch.quiz.question`]:
        'The arm is not strong enough to press the switch. How can you make the force (torque) bigger?',
    [`${C}ctrl-l3-auto-switch.quiz.choice1`]: 'Change the gear ratio to turn a big gear',
    [`${C}ctrl-l3-auto-switch.quiz.choice2`]: 'Set the angle to 180 degrees',
    [`${C}ctrl-l3-auto-switch.quiz.choice3`]: 'Make the program faster',
    [`${C}ctrl-l3-auto-switch.quiz.explanation`]:
        'Turning a big gear with a small gear makes it slower but stronger. Using a lever or pressing at another place also helps. Try it with the real parts.',
    [`${C}ctrl-l3-bumper-car.name`]: 'A Car That Stops When It Bumps',
    [`${C}ctrl-l3-bumper-car.task`]:
        'Stop the car when the touch sensor (A2) is pressed (it bumped), and move it forward when it is not.\nThe car moves with 2 DC motors (M1, M2)',
    [`${C}ctrl-l3-bumper-car.step1`]:
        'Understand the task and the activity diagram. The diamond judges "bumped?" and decides to stop or to go.',
    [`${C}ctrl-l3-bumper-car.step2`]: 'Attach "forever" under "when flag clicked", and put "if then else" into it.',
    [`${C}ctrl-l3-bumper-car.step3`]:
        'Put "= 0" into its white part, put "value" on the left, and choose "touch sensor (A2)" with ▼.',
    [`${C}ctrl-l3-bumper-car.step4`]:
        'Put "stop (M1, M2)" into "if" and "move forward (M1, M2)" into "else" (▼ of the top block of "ArtecRobo").',
    [`${C}ctrl-l3-bumper-car.step5`]:
        'Click the green flag, and press and release the touch sensor. On the practice board, press the touch sensor button and watch ↻ and ■ of the DC motors.',
    [`${C}ctrl-l3-bumper-car.debug1`]:
        'If it does not move on the real board, check that the battery box is ON and the motors are in M1 and M2.',
    [`${C}ctrl-l3-bumper-car.debug2`]:
        'If you have no touch sensor, you may choose another sensor with ▼ (on the practice board, a slider at 0 stops it).',
    [`${C}ctrl-l3-bumper-car.quiz.question`]: 'Where around you is a system that stops when it touches something?',
    [`${C}ctrl-l3-bumper-car.quiz.choice1`]: 'An elevator door',
    [`${C}ctrl-l3-bumper-car.quiz.choice2`]: 'A TV remote',
    [`${C}ctrl-l3-bumper-car.quiz.choice3`]: 'A pencil sharpener',
    [`${C}ctrl-l3-bumper-car.quiz.explanation`]:
        'When a sensor of an elevator door measures that it touched a person or a thing, the door stops closing and opens. It is a measurement and control system for safety.',
};
