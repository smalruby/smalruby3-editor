// コース「チャットをつくろう」（中学 2 年・EPIC #1616）の文言。
// lessons.locale.js の ja / jaHira / en に spread する（コースのデータは courses.js）。
// キーの決まりは lessons.locale.js と同じ `gui.lessons.<course|lesson|challenge>.<id>.<field>`。
// クイズの用語は教科書（順次処理・反復処理・分岐処理など）にそろえる。教科書の文は写さず、自分の言葉で書く。

const C = 'gui.lessons.challenge.';

export const ja = {
    'gui.lessons.course.chat-wo-tsukurou.name': 'チャットをつくろう',
    'gui.lessons.course.chat-wo-tsukurou.description':
        'チャットを作りながら、順次・反復・分岐とアクティビティ図、データとイベント、メッシュでの通信を学び、自分で工夫したチャットを作品にするよ。',
    'gui.lessons.lesson.chat-l1.name': '手順を図にしよう',

    [`${C}chat-l1-sequence.name`]: '入力して表示しよう（順次処理）',
    [`${C}chat-l1-sequence.task`]:
        '旗を押したら、シマラビが「メッセージを入力」と聞き、入力した文字を変数「シマラビのメッセージ」に入れて、その変数を 2 秒言うようにしよう。\n上から順に 1 つずつ動くことを、図と見くらべよう。',
    [`${C}chat-l1-sequence.step1`]:
        '図の上から順に作るよ。黄色い「イベント」の「旗が押されたとき」の下に、水色の「調べる」の「メッセージを入力と聞いて待つ」をつなげよう。',
    [`${C}chat-l1-sequence.step2`]:
        'オレンジの「変数」の「変数を作る」で「シマラビのメッセージ」を作ろう。「シマラビのメッセージを (答え) にする」をつなげよう。',
    [`${C}chat-l1-sequence.step3`]: '紫の「見た目」の「(シマラビのメッセージ) と 2 秒言う」をつなげよう。',
    [`${C}chat-l1-sequence.step4`]:
        '旗を押して、メッセージを入力して Enter キーを押そう。図のとおり上から順に動くか見よう。',
    [`${C}chat-l1-sequence.debug1`]: '入力したら、Enter キーか ✓ を押そう。押すまで次のブロックに進まないよ。',
    [`${C}chat-l1-sequence.quiz.question`]: '書いた順に 1 つずつ処理することを何という？',
    [`${C}chat-l1-sequence.quiz.choice1`]: '反復処理',
    [`${C}chat-l1-sequence.quiz.choice2`]: '順次処理',
    [`${C}chat-l1-sequence.quiz.choice3`]: '分岐処理',
    [`${C}chat-l1-sequence.quiz.explanation`]:
        '順次処理は、上から順に 1 つずつ実行すること。聞く → 変数に入れる → 言う、の順に動いたね。',

    [`${C}chat-l1-repeat.name`]: '入力を待ち続けよう（反復処理）',
    [`${C}chat-l1-repeat.task`]:
        '旗を押したら「メッセージを入力」と聞く。そのあと、ずっと「変数「シマラビのメッセージ」を (答え) にして、(シマラビのメッセージ) と聞いて待つ」をくり返そう。\n「聞いて待つ」の質問に変数を入れると、入力を待つあいだ、さっきのメッセージが吹き出しに出る。チャットはこうして、いつ来るかわからない入力を待ち続ける。',
    [`${C}chat-l1-repeat.step1`]:
        '図で、いちばん下から上のひし形へもどる線が「ずっと」のくり返し。まず「旗が押されたとき」の下に「メッセージを入力と聞いて待つ」をつなげよう。',
    [`${C}chat-l1-repeat.step2`]: 'その下に、オレンジの「制御」の「ずっと」をつなげよう。',
    [`${C}chat-l1-repeat.step3`]:
        '変数「シマラビのメッセージ」を作って、「ずっと」の中に「シマラビのメッセージを (答え) にする」と「(シマラビのメッセージ) と聞いて待つ」を入れよう。',
    [`${C}chat-l1-repeat.step4`]:
        '旗を押して、2 回以上メッセージを入力しよう。入力を待つあいだ、前のメッセージが吹き出しに出るか見よう。',
    [`${C}chat-l1-repeat.debug1`]:
        '前のメッセージが出ないときは、「聞いて待つ」の白いところに (シマラビのメッセージ) を入れたか見よう。',
    [`${C}chat-l1-repeat.quiz.question`]: '同じ処理をくり返し行うことを何という？',
    [`${C}chat-l1-repeat.quiz.choice1`]: '分岐処理',
    [`${C}chat-l1-repeat.quiz.choice2`]: '順次処理',
    [`${C}chat-l1-repeat.quiz.choice3`]: '反復処理',
    [`${C}chat-l1-repeat.quiz.explanation`]:
        '反復処理は、同じ処理をくり返すこと。チャットは入力を受け付ける処理をずっとくり返して、いつでも発言できるようにしているよ。',

    [`${C}chat-l1-branch.name`]: '空のメッセージは表示しない（分岐処理）',
    [`${C}chat-l1-branch.task`]:
        '旗を押したら「メッセージを入力」と聞いて、何も入力しなかったら「何か書いてね」と言い、書いたら変数「シマラビのメッセージ」に入れて 2 秒言うようにしよう。',
    [`${C}chat-l1-branch.step1`]:
        '図の上のひし形で 2 つに分かれ、下のひし形で合流する。これが「もし〜なら でなければ」。まず「旗が押されたとき」の下に「メッセージを入力と聞いて待つ」をつなげよう。',
    [`${C}chat-l1-branch.step2`]: 'その下に、オレンジの「制御」の「もし〜なら でなければ」をつなげよう。',
    [`${C}chat-l1-branch.step3`]:
        '「もし」の穴に、緑の「演算」の「( ) = ( )」を入れて、左に (答え) を入れよう。右は空のまま。',
    [`${C}chat-l1-branch.step4`]:
        '「もし」の中に「何か書いてね と 2 秒言う」、「でなければ」の中に「シマラビのメッセージを (答え) にする」と「(シマラビのメッセージ) と 2 秒言う」を入れよう。',
    [`${C}chat-l1-branch.step5`]:
        '旗を押して、何も入れずに Enter キー。もう一度旗を押して、何か入れて Enter キー。2 回試そう。',
    [`${C}chat-l1-branch.debug1`]:
        '何も入れなくても「何か書いてね」と言わないときは、「=」の右を空のままにしたか見よう（空白も入れない）。',
    [`${C}chat-l1-branch.quiz.question`]: '条件によって、することを変える処理を何という？',
    [`${C}chat-l1-branch.quiz.choice1`]: '分岐処理',
    [`${C}chat-l1-branch.quiz.choice2`]: '順次処理',
    [`${C}chat-l1-branch.quiz.choice3`]: '反復処理',
    [`${C}chat-l1-branch.quiz.explanation`]:
        '分岐処理は、条件によって行う処理を変えること。アクティビティ図ではひし形で分かれ、ひし形で合流するよ。',

    [`${C}chat-l1-read-diagram.name`]: '図を読んで作ろう',
    [`${C}chat-l1-read-diagram.task`]:
        '図を読んで、「おわり」と入力するまで聞いて言うをくり返し、最後に「またね」と言うプログラムを作ろう。',
    [`${C}chat-l1-read-diagram.explanation`]:
        '「おわり」と入力するまで、聞いて言うをくり返し、最後に「またね」と言うプログラム。図だけを見て作ってみよう。',
    [`${C}chat-l1-read-diagram.quiz.question`]: 'このプログラムで「おわり」と入力したら、最後に言うのは？',
    [`${C}chat-l1-read-diagram.quiz.choice1`]: 'おわり',
    [`${C}chat-l1-read-diagram.quiz.choice2`]: 'またね',
    [`${C}chat-l1-read-diagram.quiz.choice3`]: '何も言わない',
    [`${C}chat-l1-read-diagram.quiz.explanation`]:
        '「おわり」と入力すると、くり返しの条件に合うので、「おわり」は言わずにくり返しをぬけ、その下の「またね」を言う。最後は終了の記号（二重丸）だよ。',

    'gui.lessons.lesson.chat-l2.name': 'データとイベント',

    [`${C}chat-l2-omikuji.name`]: 'おみくじを作ろう（乱数）',
    [`${C}chat-l2-omikuji.task`]:
        'シマラビを押したら、1 から 3 の乱数を変数「くじ」に入れて、くじが 1 なら「大吉」、それ以外は「小吉」と 2 秒言うようにしよう。\n何回か押して、大吉と小吉の両方を出してみよう。',
    [`${C}chat-l2-omikuji.step1`]: '黄色い「イベント」の「このスプライトが押されたとき」を置こう。',
    [`${C}chat-l2-omikuji.step2`]:
        'オレンジの「変数」の「変数を作る」で「くじ」を作ろう。「くじを (1 から 3 までの乱数) にする」をつなげよう。乱数は緑の「演算」にあるよ。',
    [`${C}chat-l2-omikuji.step3`]:
        '図のひし形で、2 つの枝に分かれる。その下に、オレンジの「制御」の「もし〜なら でなければ」をつなげて、「もし」の中に「大吉と 2 秒言う」、「でなければ」の中に「小吉と 2 秒言う」を入れよう（白いところを書きかえる）。',
    [`${C}chat-l2-omikuji.step4`]:
        '図の枝の [くじ = 1] が「もし」の条件。「もし」の穴に緑の「( ) = 1」を入れて、左に (くじ) を入れよう。',
    [`${C}chat-l2-omikuji.step5`]: 'シマラビを何回か押そう。大吉と小吉の両方が出るか見よう。',
    [`${C}chat-l2-omikuji.debug1`]:
        'いつも同じほうが出るときは、「もし」の穴の左に (くじ) を入れたか、「くじを (乱数) にする」が「もし」より上にあるか見よう。',
    [`${C}chat-l2-omikuji.quiz.question`]: '1 から 3 の乱数が 1 になるのは、だいたい何回に 1 回？',
    [`${C}chat-l2-omikuji.quiz.choice1`]: '3 回に 1 回',
    [`${C}chat-l2-omikuji.quiz.choice2`]: '2 回に 1 回',
    [`${C}chat-l2-omikuji.quiz.choice3`]: '毎回',
    [`${C}chat-l2-omikuji.quiz.explanation`]:
        '乱数は、決めた範囲の中から、毎回でたらめに選ばれる数。1・2・3 のどれも同じくらい出るので、1 になるのはだいたい 3 回に 1 回だよ。',

    [`${C}chat-l2-timer.name`]: 'タイマーで知らせよう',
    [`${C}chat-l2-timer.task`]:
        '旗を押したらタイマーをリセットして、タイマーが 10 より大きくなるまで待ってから「10秒たったよ」と言うようにしよう。\n使いすぎを知らせる機能のもとになるプログラム。本当に知らせるなら 600 秒（10 分）にするけれど、試しやすいように 10 秒にしよう。',
    [`${C}chat-l2-timer.step1`]:
        '黄色い「イベント」の「旗が押されたとき」を置いて、その下に水色の「調べる」の「タイマーをリセット」をつなげよう。',
    [`${C}chat-l2-timer.step2`]:
        'その下に、オレンジの「制御」の「〜まで待つ」をつなげよう。図の「〜まで待つ」の箱がこれ。',
    [`${C}chat-l2-timer.step3`]:
        '「〜まで待つ」の穴に緑の「演算」の「( ) > 10」を入れて、左に水色の (タイマー) を入れよう。',
    [`${C}chat-l2-timer.step4`]: 'その下に、紫の「見た目」の「10秒たったよ と言う」をつなげよう。',
    [`${C}chat-l2-timer.step5`]: '旗を押して、10 秒待とう。10 秒たってから言うか見よう。',
    [`${C}chat-l2-timer.debug1`]:
        'すぐに言ってしまうときは、「>」の右が 10 か、左に (タイマー) を入れたか見よう。右には「10秒」のように文字を付けず、数字だけを入れよう。',
    [`${C}chat-l2-timer.quiz.question`]:
        '使いすぎを知らせる機能は、情報の技術を使うときの、どんな注意すべき点への対策？',
    [`${C}chat-l2-timer.quiz.choice1`]: '使う時間を自分で制御できなくなる',
    [`${C}chat-l2-timer.quiz.choice2`]: 'データ量が多くなる',
    [`${C}chat-l2-timer.quiz.choice3`]: 'IP アドレスが変わる',
    [`${C}chat-l2-timer.quiz.explanation`]:
        '動画やゲームなどを続けて、勉強やねる時間よりも先にしてしまうことがある。時間を知らせる機能は、自分で使い方を考えて区切るきっかけになるよ。',

    [`${C}chat-l2-janken.name`]: 'じゃんけんであいこを見つけよう',
    [`${C}chat-l2-janken.task`]:
        'シマラビを押したら「0:グー 1:チョキ 2:パー」と聞こう。コンピューターの手を 0 から 2 の乱数で決めて変数「手」に入れ、答えと手が同じなら「あいこ」、ちがえば「勝負あり」と 2 秒言うようにしよう。',
    [`${C}chat-l2-janken.step1`]:
        '「このスプライトが押されたとき」を置いて、その下に水色の「調べる」の「0:グー 1:チョキ 2:パー と聞いて待つ」をつなげよう。',
    [`${C}chat-l2-janken.step2`]: '変数「手」を作って、「手を (0 から 2 までの乱数) にする」をつなげよう。',
    [`${C}chat-l2-janken.step3`]:
        'その下に「もし〜なら でなければ」をつなげて、「もし」の中に「あいこと 2 秒言う」、「でなければ」の中に「勝負ありと 2 秒言う」を入れよう（白いところを書きかえる）。',
    [`${C}chat-l2-janken.step4`]:
        '図の枝の [答え = 手] が「もし」の条件。「もし」の穴に「( ) = ( )」を入れて、左に (答え)、右に (手) を入れよう。',
    [`${C}chat-l2-janken.step5`]:
        'シマラビを押して、数を入れて Enter キー。あいこと勝負ありの両方が出るまで、何回か試そう。',
    [`${C}chat-l2-janken.debug1`]:
        '同じ数のはずなのに「あいこ」にならないときは、数を半角で入れたか見よう（全角の「０」は 0 と等しくない）。',
    [`${C}chat-l2-janken.quiz.question`]: '変数「手」のはたらきは？',
    [`${C}chat-l2-janken.quiz.choice1`]: '画面に絵を出す',
    [`${C}chat-l2-janken.quiz.choice2`]: '値を入れておき、あとで比べるのに使う',
    [`${C}chat-l2-janken.quiz.choice3`]: 'ネットワークにつなぐ',
    [`${C}chat-l2-janken.quiz.explanation`]:
        '変数は、名前を付けて値を入れておく入れもの。入れた値は、あとで取り出して使える。ここではコンピューターの手を入れておき、答えと比べて、言うことを変えたね。',
    'gui.lessons.lesson.chat-l3.name': 'メッシュでつながろう',

    [`${C}chat-l3-local-message.name`]: 'メッセージと変数を分けて送ろう（同じコンピューターの中）',
    [`${C}chat-l3-local-message.task`]:
        'ライブラリからシマネコを足そう。旗を押したらシマラビが「メッセージを入力」と聞き、答えを変数「シマラビのメッセージ」に入れて、メッセージ「シマラビのメッセージ」を送る。シマネコは、そのメッセージを受け取ったら、変数「シマラビのメッセージ」を 3 秒言うようにしよう。\nメッセージは「送ったよ」の知らせだけ。文字は変数に入れておく。',
    [`${C}chat-l3-local-message.step1`]: '右下の「スプライトを選ぶ」から、シマネコを足そう。',
    [`${C}chat-l3-local-message.step2`]:
        'シマラビをえらんで、黄色い「イベント」の「旗が押されたとき」を置こう。その下に「メッセージを入力と聞いて待つ」と、変数「シマラビのメッセージ」を作って「シマラビのメッセージを (答え) にする」をつなげよう。変数は「すべてのスプライト用」にする。',
    [`${C}chat-l3-local-message.step3`]:
        'その下に「イベント」の「〜を送る」をつなげて、▼ の「新しいメッセージ」で「シマラビのメッセージ」を作ろう。図の、とがった五角形が「送る」。',
    [`${C}chat-l3-local-message.step4`]:
        'シマネコをえらんで、「〜を受け取ったとき」を置き、▼ で「シマラビのメッセージ」をえらぼう。図の、へこんだ箱が「受け取ったとき」で、五角形からの矢印がそこへ届く。その下に「(シマラビのメッセージ) と 3 秒言う」をつなげよう。',
    [`${C}chat-l3-local-message.step5`]:
        '旗を押して、メッセージを入力して Enter キーを押そう。シマネコが入力した文字を言うか見よう。',
    [`${C}chat-l3-local-message.debug1`]:
        'シマネコが何も言わないときは、「受け取ったとき」の ▼ が「シマラビのメッセージ」か見よう。',
    [`${C}chat-l3-local-message.debug2`]:
        'シマネコが「0」と言うときは、変数を「すべてのスプライト用」で作ったか、「送る」が「シマラビのメッセージを (答え) にする」より下にあるか見よう。',
    [`${C}chat-l3-local-message.quiz.question`]: 'メッセージを送ったとき、相手に届くのは？',
    [`${C}chat-l3-local-message.quiz.choice1`]: '「送ったよ」という知らせだけ',
    [`${C}chat-l3-local-message.quiz.choice2`]: '入力した文字',
    [`${C}chat-l3-local-message.quiz.choice3`]: 'スプライトの絵',
    [`${C}chat-l3-local-message.quiz.explanation`]:
        'メッセージは知らせを伝えるだけで、中身は運ばない。中身は変数に入れておき、受け取った側がその変数を読む。メッシュでも同じ考え方だよ。',

    [`${C}chat-l3-mesh-signal.name`]: 'メッシュでメッセージを送り合おう',
    [`${C}chat-l3-mesh-signal.task`]:
        '拡張機能「メッシュ」を足そう。ペアなら 1 人がホストになってグループを作り、もう 1 人がそのグループに参加する。ひとりなら練習相手とやろう。\nスペースキーを押したらシマラビがメッセージ「てをふる」を送る。「てをふる」を受け取ったら、シマネコが「やあ！」と 2 秒言うようにしよう。',
    [`${C}chat-l3-mesh-signal.step1`]:
        '左下の拡張機能のボタンから「メッシュ」をえらぼう。パレットに「メッシュ」がふえるよ。',
    [`${C}chat-l3-mesh-signal.step2`]:
        'ペアなら、「メッシュ」の横のボタンから、1 人が「メッシュのホストになる」でグループを作り、もう 1 人が「メッシュに参加する」でそのグループに入る。ひとりなら、右上の練習相手のパネルを使おう。',
    [`${C}chat-l3-mesh-signal.step3`]:
        'シマラビをえらんで、黄色い「イベント」の「スペースキーが押されたとき」を置こう。その下に「〜を送る」をつなげて、▼ の「新しいメッセージ」で「てをふる」を作ろう。',
    [`${C}chat-l3-mesh-signal.step4`]:
        'シマネコをえらんで、「てをふるを受け取ったとき」を置き、その下に「やあ！と 2 秒言う」をつなげよう。図では、相手の五角形からの矢印も、このへこんだ箱に届く。',
    [`${C}chat-l3-mesh-signal.step5`]:
        'ステージを押してから、スペースキーを押そう。ひとりなら、練習相手のパネルの「てをふる」も押してみよう。どちらでもシマネコが「やあ！」と言うか見よう。',
    [`${C}chat-l3-mesh-signal.debug1`]:
        'スペースキーを押しても何も起きないときは、ステージを一度押してから、もう一度スペースキーを押そう。',
    [`${C}chat-l3-mesh-signal.debug2`]:
        'ペアで相手から届かないときは、2 人が同じグループに入っているか、メッセージの名前が同じ「てをふる」か見よう。',
    [`${C}chat-l3-mesh-signal.quiz.question`]:
        '種類のちがう機器どうしでも通信できるように決めた、共通の約束事を何という？',
    [`${C}chat-l3-mesh-signal.quiz.choice1`]: 'アルゴリズム',
    [`${C}chat-l3-mesh-signal.quiz.choice2`]: 'コンテンツ',
    [`${C}chat-l3-mesh-signal.quiz.choice3`]: 'プロトコル',
    [`${C}chat-l3-mesh-signal.quiz.explanation`]:
        '通信の約束事をプロトコルという。インターネットでは TCP/IP というプロトコルを使っていて、メッシュもその上でメッセージを届けているよ。',

    [`${C}chat-l3-mesh-variable.name`]: '変数を共有しよう',
    [`${C}chat-l3-mesh-variable.task`]:
        '1 のキーで変数「シマラビのきぶん」を「うれしい」、2 のキーで「ねむい」にしよう。シマネコを押したら、シマネコの気分（「シマネコのきぶん」のセンサーの値）を 2 秒言うようにしよう。\nペアでシマネコの役の人は、シマラビとシマネコを入れかえて作ろう。',
    [`${C}chat-l3-mesh-variable.step1`]:
        'シマラビをえらんで、オレンジの「変数」の「変数を作る」で「シマラビのきぶん」を作ろう。「すべてのスプライト用」にすると、メッシュでつながった相手と共有される。',
    [`${C}chat-l3-mesh-variable.step2`]:
        '黄色い「イベント」の「1 キーが押されたとき」を置いて、「シマラビのきぶんを うれしい にする」をつなげよう。',
    [`${C}chat-l3-mesh-variable.step3`]:
        'もう 1 つ「2 キーが押されたとき」を置いて、「シマラビのきぶんを ねむい にする」をつなげよう。',
    [`${C}chat-l3-mesh-variable.step4`]:
        'ひとりなら、練習相手のパネルの「うれしい」を押そう（ペアなら、相手に 1 のキーを押してもらう）。相手の気分が届くと、「メッシュ」の「(　) センサーの値」の ▼ に「シマネコのきぶん」が出る。',
    [`${C}chat-l3-mesh-variable.step5`]:
        'シマネコをえらんで、「このスプライトが押されたとき」を置こう。その下に「(　) と 2 秒言う」をつなげて、白いところに「(シマネコのきぶん) センサーの値」を入れよう。',
    [`${C}chat-l3-mesh-variable.step6`]:
        '1 のキーと 2 のキーを押して、練習相手のパネルの「届いた」に自分の気分が出るか見よう。パネルの「うれしい」「ねむい」を押してからシマネコを押して、相手の気分を言うか見よう。',
    [`${C}chat-l3-mesh-variable.debug1`]:
        '▼ に「シマネコのきぶん」が無いときは、先に練習相手の「うれしい」を押そう（ペアなら、相手に 1 のキーを押してもらおう）。',
    [`${C}chat-l3-mesh-variable.debug2`]:
        '自分の気分が相手に届かないときは、変数「シマラビのきぶん」を「すべてのスプライト用」で作ったか見よう。',
    [`${C}chat-l3-mesh-variable.debug3`]:
        '「センサーの値」の ▼ では、相手の気分（「シマネコのきぶん」）をえらぼう。自分の気分をえらぶと、相手の気分は言えないよ。',
    [`${C}chat-l3-mesh-variable.quiz.question`]:
        'ネットワークにつながった情報機器に割りふられる、個別の番号を何という？',
    [`${C}chat-l3-mesh-variable.quiz.choice1`]: 'ドメイン名',
    [`${C}chat-l3-mesh-variable.quiz.choice2`]: 'IP アドレス',
    [`${C}chat-l3-mesh-variable.quiz.choice3`]: 'ルータ',
    [`${C}chat-l3-mesh-variable.quiz.explanation`]:
        'IP アドレスで通信の相手を見分ける。数字だけでは人にはわかりにくいので、Web ページではドメイン名という文字に置きかえて使うよ。',
};

export const jaHira = {
    'gui.lessons.course.chat-wo-tsukurou.name': 'チャットをつくろう',
    'gui.lessons.course.chat-wo-tsukurou.description':
        'チャットをつくりながら、じゅんじ・はんぷく・ぶんきとアクティビティず、データとイベント、メッシュでのつうしんをまなび、じぶんでくふうしたチャットをさくひんにするよ。',
    'gui.lessons.lesson.chat-l1.name': 'てじゅんを ずに しよう',

    [`${C}chat-l1-sequence.name`]: 'にゅうりょくして ひょうじしよう（じゅんじしょり）',
    [`${C}chat-l1-sequence.task`]:
        'はたをおしたら、シマラビが「メッセージを にゅうりょく」ときき、にゅうりょくしたもじを へんすう「シマラビのメッセージ」にいれて、そのへんすうを 2 びょう いうようにしよう。\nうえから じゅんに 1 つずつ うごくことを、ずと みくらべよう。',
    [`${C}chat-l1-sequence.step1`]:
        'ずの うえから じゅんに つくるよ。きいろい「イベント」の「はたがおされたとき」のしたに、みずいろの「しらべる」の「メッセージを にゅうりょく ときいてまつ」をつなげよう。',
    [`${C}chat-l1-sequence.step2`]:
        'オレンジの「へんすう」の「へんすうをつくる」で「シマラビのメッセージ」をつくろう。「シマラビのメッセージを (こたえ) にする」をつなげよう。',
    [`${C}chat-l1-sequence.step3`]: 'むらさきの「みため」の「(シマラビのメッセージ) と 2 びょう いう」をつなげよう。',
    [`${C}chat-l1-sequence.step4`]:
        'はたをおして、メッセージを にゅうりょくして Enter キーをおそう。ずのとおり うえから じゅんに うごくか みよう。',
    [`${C}chat-l1-sequence.debug1`]:
        'にゅうりょくしたら、Enter キーか ✓ をおそう。おすまで つぎのブロックに すすまないよ。',
    [`${C}chat-l1-sequence.quiz.question`]: 'かいた じゅんに 1 つずつ しょりすることを なんという？',
    [`${C}chat-l1-sequence.quiz.choice1`]: 'はんぷくしょり',
    [`${C}chat-l1-sequence.quiz.choice2`]: 'じゅんじしょり',
    [`${C}chat-l1-sequence.quiz.choice3`]: 'ぶんきしょり',
    [`${C}chat-l1-sequence.quiz.explanation`]:
        'じゅんじしょりは、うえから じゅんに 1 つずつ じっこうすること。きく → へんすうにいれる → いう、の じゅんに うごいたね。',

    [`${C}chat-l1-repeat.name`]: 'にゅうりょくを まちつづけよう（はんぷくしょり）',
    [`${C}chat-l1-repeat.task`]:
        'はたをおしたら「メッセージを にゅうりょく」ときく。そのあと、ずっと「へんすう「シマラビのメッセージ」を (こたえ) にして、(シマラビのメッセージ) と きいてまつ」をくりかえそう。\n「きいてまつ」のしつもんに へんすうをいれると、にゅうりょくをまつあいだ、さっきのメッセージが ふきだしにでる。チャットはこうして、いつくるか わからない にゅうりょくを まちつづける。',
    [`${C}chat-l1-repeat.step1`]:
        'ずで、いちばん したから うえのひしがたへ もどるせんが「ずっと」のくりかえし。まず「はたがおされたとき」のしたに「メッセージを にゅうりょく ときいてまつ」をつなげよう。',
    [`${C}chat-l1-repeat.step2`]: 'そのしたに、オレンジの「せいぎょ」の「ずっと」をつなげよう。',
    [`${C}chat-l1-repeat.step3`]:
        'へんすう「シマラビのメッセージ」をつくって、「ずっと」のなかに「シマラビのメッセージを (こたえ) にする」と「(シマラビのメッセージ) と きいてまつ」をいれよう。',
    [`${C}chat-l1-repeat.step4`]:
        'はたをおして、2 かいいじょう メッセージを にゅうりょくしよう。にゅうりょくをまつあいだ、まえのメッセージが ふきだしにでるか みよう。',
    [`${C}chat-l1-repeat.debug1`]:
        'まえのメッセージが でないときは、「きいてまつ」のしろいところに (シマラビのメッセージ) をいれたか みよう。',
    [`${C}chat-l1-repeat.quiz.question`]: 'おなじ しょりを くりかえし おこなうことを なんという？',
    [`${C}chat-l1-repeat.quiz.choice1`]: 'ぶんきしょり',
    [`${C}chat-l1-repeat.quiz.choice2`]: 'じゅんじしょり',
    [`${C}chat-l1-repeat.quiz.choice3`]: 'はんぷくしょり',
    [`${C}chat-l1-repeat.quiz.explanation`]:
        'はんぷくしょりは、おなじ しょりを くりかえすこと。チャットは にゅうりょくを うけつける しょりを ずっと くりかえして、いつでも はつげんできるように しているよ。',

    [`${C}chat-l1-branch.name`]: 'からのメッセージは ひょうじしない（ぶんきしょり）',
    [`${C}chat-l1-branch.task`]:
        'はたをおしたら「メッセージを にゅうりょく」ときいて、なにも にゅうりょくしなかったら「なにか かいてね」といい、かいたら へんすう「シマラビのメッセージ」にいれて 2 びょう いうようにしよう。',
    [`${C}chat-l1-branch.step1`]:
        'ずの うえのひしがたで 2 つにわかれ、したのひしがたで ごうりゅうする。これが「もし〜なら でなければ」。まず「はたがおされたとき」のしたに「メッセージを にゅうりょく ときいてまつ」をつなげよう。',
    [`${C}chat-l1-branch.step2`]: 'そのしたに、オレンジの「せいぎょ」の「もし〜なら でなければ」をつなげよう。',
    [`${C}chat-l1-branch.step3`]:
        '「もし」のあなに、みどりの「えんざん」の「( ) = ( )」をいれて、ひだりに (こたえ) をいれよう。みぎは からのまま。',
    [`${C}chat-l1-branch.step4`]:
        '「もし」のなかに「なにか かいてね と 2 びょう いう」、「でなければ」のなかに「シマラビのメッセージを (こたえ) にする」と「(シマラビのメッセージ) と 2 びょう いう」をいれよう。',
    [`${C}chat-l1-branch.step5`]:
        'はたをおして、なにも いれずに Enter キー。もういちど はたをおして、なにか いれて Enter キー。2 かい ためそう。',
    [`${C}chat-l1-branch.debug1`]:
        'なにも いれなくても「なにか かいてね」といわないときは、「=」のみぎを からのままにしたか みよう（くうはくも いれない）。',
    [`${C}chat-l1-branch.quiz.question`]: 'じょうけんによって、することを かえる しょりを なんという？',
    [`${C}chat-l1-branch.quiz.choice1`]: 'ぶんきしょり',
    [`${C}chat-l1-branch.quiz.choice2`]: 'じゅんじしょり',
    [`${C}chat-l1-branch.quiz.choice3`]: 'はんぷくしょり',
    [`${C}chat-l1-branch.quiz.explanation`]:
        'ぶんきしょりは、じょうけんによって おこなう しょりを かえること。アクティビティずでは ひしがたで わかれ、ひしがたで ごうりゅうするよ。',

    [`${C}chat-l1-read-diagram.name`]: 'ずを よんで つくろう',
    [`${C}chat-l1-read-diagram.task`]:
        'ずをよんで、「おわり」と にゅうりょくするまで きいて いうを くりかえし、さいごに「またね」という プログラムをつくろう。',
    [`${C}chat-l1-read-diagram.explanation`]:
        '「おわり」と にゅうりょくするまで、きいて いうを くりかえし、さいごに「またね」という プログラム。ずだけを みて つくってみよう。',
    [`${C}chat-l1-read-diagram.quiz.question`]:
        'このプログラムで「おわり」と にゅうりょくしたら、さいごに いうのは？',
    [`${C}chat-l1-read-diagram.quiz.choice1`]: 'おわり',
    [`${C}chat-l1-read-diagram.quiz.choice2`]: 'またね',
    [`${C}chat-l1-read-diagram.quiz.choice3`]: 'なにも いわない',
    [`${C}chat-l1-read-diagram.quiz.explanation`]:
        '「おわり」と にゅうりょくすると、くりかえしの じょうけんに あうので、「おわり」は いわずに くりかえしを ぬけ、そのしたの「またね」をいう。さいごは しゅうりょうの きごう（にじゅうまる）だよ。',

    'gui.lessons.lesson.chat-l2.name': 'データとイベント',

    [`${C}chat-l2-omikuji.name`]: 'おみくじを つくろう（らんすう）',
    [`${C}chat-l2-omikuji.task`]:
        'シマラビをおしたら、1 から 3 の らんすうを へんすう「くじ」にいれて、くじが 1 なら「だいきち」、それいがいは「しょうきち」と 2 びょう いうようにしよう。\nなんかいか おして、だいきちと しょうきちの りょうほうを だしてみよう。',
    [`${C}chat-l2-omikuji.step1`]: 'きいろい「イベント」の「このスプライトがおされたとき」をおこう。',
    [`${C}chat-l2-omikuji.step2`]:
        'オレンジの「へんすう」の「へんすうをつくる」で「くじ」をつくろう。「くじを (1 から 3 までの らんすう) にする」をつなげよう。らんすうは みどりの「えんざん」にあるよ。',
    [`${C}chat-l2-omikuji.step3`]:
        'ずの ひしがたで、2 つの えだに わかれる。そのしたに、オレンジの「せいぎょ」の「もし〜なら でなければ」をつなげて、「もし」のなかに「だいきちと 2 びょう いう」、「でなければ」のなかに「しょうきちと 2 びょう いう」をいれよう（しろいところを かきかえる）。',
    [`${C}chat-l2-omikuji.step4`]:
        'ずの えだの [くじ = 1] が「もし」の じょうけん。「もし」のあなに みどりの「( ) = 1」をいれて、ひだりに (くじ) をいれよう。',
    [`${C}chat-l2-omikuji.step5`]:
        'シマラビを なんかいか おそう。だいきちと しょうきちの りょうほうが でるか みよう。',
    [`${C}chat-l2-omikuji.debug1`]:
        'いつも おなじほうが でるときは、「もし」のあなの ひだりに (くじ) をいれたか、「くじを (らんすう) にする」が「もし」より うえにあるか みよう。',
    [`${C}chat-l2-omikuji.quiz.question`]: '1 から 3 の らんすうが 1 になるのは、だいたい なんかいに 1 かい？',
    [`${C}chat-l2-omikuji.quiz.choice1`]: '3 かいに 1 かい',
    [`${C}chat-l2-omikuji.quiz.choice2`]: '2 かいに 1 かい',
    [`${C}chat-l2-omikuji.quiz.choice3`]: 'まいかい',
    [`${C}chat-l2-omikuji.quiz.explanation`]:
        'らんすうは、きめた はんいのなかから、まいかい でたらめに えらばれる かず。1・2・3 の どれも おなじくらい でるので、1 になるのは だいたい 3 かいに 1 かいだよ。',

    [`${C}chat-l2-timer.name`]: 'タイマーで しらせよう',
    [`${C}chat-l2-timer.task`]:
        'はたをおしたら タイマーをリセットして、タイマーが 10 より おおきくなるまで まってから「10びょう たったよ」と いうようにしよう。\nつかいすぎを しらせる きのうの もとになる プログラム。ほんとうに しらせるなら 600 びょう（10 ぷん）にするけれど、ためしやすいように 10 びょうにしよう。',
    [`${C}chat-l2-timer.step1`]:
        'きいろい「イベント」の「はたがおされたとき」をおいて、そのしたに みずいろの「しらべる」の「タイマーをリセット」をつなげよう。',
    [`${C}chat-l2-timer.step2`]:
        'そのしたに、オレンジの「せいぎょ」の「〜までまつ」をつなげよう。ずの「〜までまつ」の はこが これ。',
    [`${C}chat-l2-timer.step3`]:
        '「〜までまつ」のあなに みどりの「えんざん」の「( ) > 10」をいれて、ひだりに みずいろの (タイマー) をいれよう。',
    [`${C}chat-l2-timer.step4`]: 'そのしたに、むらさきの「みため」の「10びょう たったよ という」をつなげよう。',
    [`${C}chat-l2-timer.step5`]: 'はたをおして、10 びょう まとう。10 びょう たってから いうか みよう。',
    [`${C}chat-l2-timer.debug1`]:
        'すぐに いってしまうときは、「>」の みぎが 10 か、ひだりに (タイマー) をいれたか みよう。みぎには「10びょう」のように もじを つけず、すうじだけを いれよう。',
    [`${C}chat-l2-timer.quiz.question`]:
        'つかいすぎを しらせる きのうは、じょうほうの ぎじゅつを つかうときの、どんな ちゅういすべき てんへの たいさく？',
    [`${C}chat-l2-timer.quiz.choice1`]: 'つかう じかんを じぶんで せいぎょ できなくなる',
    [`${C}chat-l2-timer.quiz.choice2`]: 'データりょうが おおくなる',
    [`${C}chat-l2-timer.quiz.choice3`]: 'IP アドレスが かわる',
    [`${C}chat-l2-timer.quiz.explanation`]:
        'どうがや ゲームなどを つづけて、べんきょうや ねる じかんよりも さきに してしまうことがある。じかんを しらせる きのうは、じぶんで つかいかたを かんがえて くぎる きっかけになるよ。',

    [`${C}chat-l2-janken.name`]: 'じゃんけんで あいこを みつけよう',
    [`${C}chat-l2-janken.task`]:
        'シマラビをおしたら「0:グー 1:チョキ 2:パー」と きこう。コンピューターの てを 0 から 2 の らんすうで きめて へんすう「て」にいれ、こたえと てが おなじなら「あいこ」、ちがえば「しょうぶあり」と 2 びょう いうようにしよう。',
    [`${C}chat-l2-janken.step1`]:
        '「このスプライトがおされたとき」をおいて、そのしたに みずいろの「しらべる」の「0:グー 1:チョキ 2:パー と きいてまつ」をつなげよう。',
    [`${C}chat-l2-janken.step2`]:
        'へんすう「て」をつくって、「てを (0 から 2 までの らんすう) にする」をつなげよう。',
    [`${C}chat-l2-janken.step3`]:
        'そのしたに「もし〜なら でなければ」をつなげて、「もし」のなかに「あいこと 2 びょう いう」、「でなければ」のなかに「しょうぶありと 2 びょう いう」をいれよう（しろいところを かきかえる）。',
    [`${C}chat-l2-janken.step4`]:
        'ずの えだの [こたえ = て] が「もし」の じょうけん。「もし」のあなに「( ) = ( )」をいれて、ひだりに (こたえ)、みぎに (て) をいれよう。',
    [`${C}chat-l2-janken.step5`]:
        'シマラビをおして、かずをいれて Enter キー。あいこと しょうぶありの りょうほうが でるまで、なんかいか ためそう。',
    [`${C}chat-l2-janken.debug1`]:
        'おなじ かずの はずなのに「あいこ」に ならないときは、かずを はんかくで いれたか みよう（ぜんかくの「０」は 0 と ひとしくない）。',
    [`${C}chat-l2-janken.quiz.question`]: 'へんすう「て」の はたらきは？',
    [`${C}chat-l2-janken.quiz.choice1`]: 'がめんに えを だす',
    [`${C}chat-l2-janken.quiz.choice2`]: 'あたいを いれておき、あとで くらべるのに つかう',
    [`${C}chat-l2-janken.quiz.choice3`]: 'ネットワークに つなぐ',
    [`${C}chat-l2-janken.quiz.explanation`]:
        'へんすうは、なまえを つけて あたいを いれておく いれもの。いれた あたいは、あとで とりだして つかえる。ここでは コンピューターの てを いれておき、こたえと くらべて、いうことを かえたね。',
    'gui.lessons.lesson.chat-l3.name': 'メッシュで つながろう',

    [`${C}chat-l3-local-message.name`]: 'メッセージと へんすうを わけて おくろう（おなじ コンピューターの なか）',
    [`${C}chat-l3-local-message.task`]:
        'ライブラリから シマネコを たそう。はたをおしたら シマラビが「メッセージを にゅうりょく」ときき、こたえを へんすう「シマラビのメッセージ」にいれて、メッセージ「シマラビのメッセージ」をおくる。シマネコは、そのメッセージを うけとったら、へんすう「シマラビのメッセージ」を 3 びょう いうようにしよう。\nメッセージは「おくったよ」の しらせだけ。もじは へんすうに いれておく。',
    [`${C}chat-l3-local-message.step1`]: 'みぎしたの「スプライトをえらぶ」から、シマネコを たそう。',
    [`${C}chat-l3-local-message.step2`]:
        'シマラビを えらんで、きいろい「イベント」の「はたがおされたとき」を おこう。そのしたに「メッセージを にゅうりょく ときいてまつ」と、へんすう「シマラビのメッセージ」をつくって「シマラビのメッセージを (こたえ) にする」をつなげよう。へんすうは「すべてのスプライトよう」にする。',
    [`${C}chat-l3-local-message.step3`]:
        'そのしたに「イベント」の「〜をおくる」をつなげて、▼ の「あたらしいメッセージ」で「シマラビのメッセージ」をつくろう。ずの、とがった ごかくけいが「おくる」。',
    [`${C}chat-l3-local-message.step4`]:
        'シマネコを えらんで、「〜をうけとったとき」をおき、▼ で「シマラビのメッセージ」をえらぼう。ずの、へこんだ はこが「うけとったとき」で、ごかくけいからの やじるしが そこへ とどく。そのしたに「(シマラビのメッセージ) と 3 びょう いう」をつなげよう。',
    [`${C}chat-l3-local-message.step5`]:
        'はたをおして、メッセージを にゅうりょくして Enter キーを おそう。シマネコが にゅうりょくした もじを いうか みよう。',
    [`${C}chat-l3-local-message.debug1`]:
        'シマネコが なにも いわないときは、「うけとったとき」の ▼ が「シマラビのメッセージ」か みよう。',
    [`${C}chat-l3-local-message.debug2`]:
        'シマネコが「0」と いうときは、へんすうを「すべてのスプライトよう」で つくったか、「おくる」が「シマラビのメッセージを (こたえ) にする」より したに あるか みよう。',
    [`${C}chat-l3-local-message.quiz.question`]: 'メッセージを おくったとき、あいてに とどくのは？',
    [`${C}chat-l3-local-message.quiz.choice1`]: '「おくったよ」という しらせだけ',
    [`${C}chat-l3-local-message.quiz.choice2`]: 'にゅうりょくした もじ',
    [`${C}chat-l3-local-message.quiz.choice3`]: 'スプライトの え',
    [`${C}chat-l3-local-message.quiz.explanation`]:
        'メッセージは しらせを つたえるだけで、なかみは はこばない。なかみは へんすうに いれておき、うけとった がわが その へんすうを よむ。メッシュでも おなじ かんがえかただよ。',

    [`${C}chat-l3-mesh-signal.name`]: 'メッシュで メッセージを おくりあおう',
    [`${C}chat-l3-mesh-signal.task`]:
        'かくちょうきのう「メッシュ」を たそう。ペアなら 1 にんが ホストになって グループを つくり、もう 1 にんが その グループに さんかする。ひとりなら れんしゅうあいてと やろう。\nスペースキーを おしたら シマラビが メッセージ「てをふる」を おくる。「てをふる」を うけとったら、シマネコが「やあ！」と 2 びょう いうようにしよう。',
    [`${C}chat-l3-mesh-signal.step1`]:
        'ひだりしたの かくちょうきのうの ボタンから「メッシュ」を えらぼう。パレットに「メッシュ」が ふえるよ。',
    [`${C}chat-l3-mesh-signal.step2`]:
        'ペアなら、「メッシュ」の よこの ボタンから、1 にんが「メッシュのホストになる」で グループを つくり、もう 1 にんが「メッシュにさんかする」で その グループに はいる。ひとりなら、みぎうえの れんしゅうあいての パネルを つかおう。',
    [`${C}chat-l3-mesh-signal.step3`]:
        'シマラビを えらんで、きいろい「イベント」の「スペースキーがおされたとき」を おこう。そのしたに「〜をおくる」をつなげて、▼ の「あたらしいメッセージ」で「てをふる」をつくろう。',
    [`${C}chat-l3-mesh-signal.step4`]:
        'シマネコを えらんで、「てをふるをうけとったとき」をおき、そのしたに「やあ！と 2 びょう いう」をつなげよう。ずでは、あいての ごかくけいからの やじるしも、この へこんだ はこに とどく。',
    [`${C}chat-l3-mesh-signal.step5`]:
        'ステージを おしてから、スペースキーを おそう。ひとりなら、れんしゅうあいての パネルの「てをふる」も おしてみよう。どちらでも シマネコが「やあ！」と いうか みよう。',
    [`${C}chat-l3-mesh-signal.debug1`]:
        'スペースキーを おしても なにも おきないときは、ステージを いちど おしてから、もういちど スペースキーを おそう。',
    [`${C}chat-l3-mesh-signal.debug2`]:
        'ペアで あいてから とどかないときは、2 にんが おなじ グループに はいっているか、メッセージの なまえが おなじ「てをふる」か みよう。',
    [`${C}chat-l3-mesh-signal.quiz.question`]:
        'しゅるいの ちがう きき どうしでも つうしん できるように きめた、きょうつうの やくそくごとを なんという？',
    [`${C}chat-l3-mesh-signal.quiz.choice1`]: 'アルゴリズム',
    [`${C}chat-l3-mesh-signal.quiz.choice2`]: 'コンテンツ',
    [`${C}chat-l3-mesh-signal.quiz.choice3`]: 'プロトコル',
    [`${C}chat-l3-mesh-signal.quiz.explanation`]:
        'つうしんの やくそくごとを プロトコルという。インターネットでは TCP/IP という プロトコルを つかっていて、メッシュも その うえで メッセージを とどけているよ。',

    [`${C}chat-l3-mesh-variable.name`]: 'へんすうを きょうゆうしよう',
    [`${C}chat-l3-mesh-variable.task`]:
        '1 のキーで へんすう「シマラビのきぶん」を「うれしい」、2 のキーで「ねむい」にしよう。シマネコを おしたら、シマネコの きぶん（「シマネコのきぶん」の センサーの あたい）を 2 びょう いうようにしよう。\nペアで シマネコの やくの ひとは、シマラビと シマネコを いれかえて つくろう。',
    [`${C}chat-l3-mesh-variable.step1`]:
        'シマラビを えらんで、オレンジの「へんすう」の「へんすうをつくる」で「シマラビのきぶん」をつくろう。「すべてのスプライトよう」にすると、メッシュで つながった あいてと きょうゆう される。',
    [`${C}chat-l3-mesh-variable.step2`]:
        'きいろい「イベント」の「1 キーがおされたとき」をおいて、「シマラビのきぶんを うれしい にする」をつなげよう。',
    [`${C}chat-l3-mesh-variable.step3`]:
        'もう 1 つ「2 キーがおされたとき」をおいて、「シマラビのきぶんを ねむい にする」をつなげよう。',
    [`${C}chat-l3-mesh-variable.step4`]:
        'ひとりなら、れんしゅうあいての パネルの「うれしい」を おそう（ペアなら、あいてに 1 のキーを おしてもらう）。あいての きぶんが とどくと、「メッシュ」の「(　) センサーのあたい」の ▼ に「シマネコのきぶん」が でる。',
    [`${C}chat-l3-mesh-variable.step5`]:
        'シマネコを えらんで、「このスプライトがおされたとき」を おこう。そのしたに「(　) と 2 びょう いう」をつなげて、しろいところに「(シマネコのきぶん) センサーのあたい」を いれよう。',
    [`${C}chat-l3-mesh-variable.step6`]:
        '1 のキーと 2 のキーを おして、れんしゅうあいての パネルの「とどいた」に じぶんの きぶんが でるか みよう。パネルの「うれしい」「ねむい」を おしてから シマネコを おして、あいての きぶんを いうか みよう。',
    [`${C}chat-l3-mesh-variable.debug1`]:
        '▼ に「シマネコのきぶん」が ないときは、さきに れんしゅうあいての「うれしい」を おそう（ペアなら、あいてに 1 のキーを おしてもらおう）。',
    [`${C}chat-l3-mesh-variable.debug2`]:
        'じぶんの きぶんが あいてに とどかないときは、へんすう「シマラビのきぶん」を「すべてのスプライトよう」で つくったか みよう。',
    [`${C}chat-l3-mesh-variable.debug3`]:
        '「センサーのあたい」の ▼ では、あいての きぶん（「シマネコのきぶん」）を えらぼう。じぶんの きぶんを えらぶと、あいての きぶんは いえないよ。',
    [`${C}chat-l3-mesh-variable.quiz.question`]:
        'ネットワークに つながった じょうほうききに わりふられる、こべつの ばんごうを なんという？',
    [`${C}chat-l3-mesh-variable.quiz.choice1`]: 'ドメインめい',
    [`${C}chat-l3-mesh-variable.quiz.choice2`]: 'IP アドレス',
    [`${C}chat-l3-mesh-variable.quiz.choice3`]: 'ルータ',
    [`${C}chat-l3-mesh-variable.quiz.explanation`]:
        'IP アドレスで つうしんの あいてを みわける。すうじだけでは ひとには わかりにくいので、Web ページでは ドメインめいという もじに おきかえて つかうよ。',
};

export const en = {
    'gui.lessons.course.chat-wo-tsukurou.name': "Let's Make a Chat",
    'gui.lessons.course.chat-wo-tsukurou.description':
        'Make a chat app and learn sequence, repetition, branching and activity diagrams, data and events, and talking over the mesh, then make your own chat as your work.',
    'gui.lessons.lesson.chat-l1.name': 'Draw the Steps',

    [`${C}chat-l1-sequence.name`]: 'Type and Show (Sequence)',
    [`${C}chat-l1-sequence.task`]:
        'When the flag is clicked, make Shimaraby ask "Enter a message", put what was typed into the variable "shimaraby_message", and say that variable for 2 seconds.\nCompare it with the diagram: it runs one step at a time from the top.',
    [`${C}chat-l1-sequence.step1`]:
        'Build it from the top of the diagram. Under the yellow Events block "when flag clicked", attach the light blue Sensing block "ask Enter a message and wait".',
    [`${C}chat-l1-sequence.step2`]:
        'In the orange Variables, click "Make a Variable" and make "shimaraby_message". Attach "set shimaraby_message to (answer)".',
    [`${C}chat-l1-sequence.step3`]: 'Attach the purple Looks block "say (shimaraby_message) for 2 seconds".',
    [`${C}chat-l1-sequence.step4`]:
        'Click the flag, type a message and press Enter. Check that it runs from the top, like the diagram.',
    [`${C}chat-l1-sequence.debug1`]:
        'After typing, press Enter or click ✓. The next block does not run until you do.',
    [`${C}chat-l1-sequence.quiz.question`]:
        'What do we call running steps one at a time, in the order they are written?',
    [`${C}chat-l1-sequence.quiz.choice1`]: 'Repetition',
    [`${C}chat-l1-sequence.quiz.choice2`]: 'Sequence',
    [`${C}chat-l1-sequence.quiz.choice3`]: 'Branching',
    [`${C}chat-l1-sequence.quiz.explanation`]:
        'Sequence means running the steps one at a time from the top. It asked, put the answer in the variable, then said it, in that order.',

    [`${C}chat-l1-repeat.name`]: 'Keep Waiting for Input (Repetition)',
    [`${C}chat-l1-repeat.task`]:
        'When the flag is clicked, ask "Enter a message". Then forever repeat "set the variable shimaraby_message to (answer), and ask (shimaraby_message) and wait".\nWhen you put the variable in the question of "ask and wait", the last message shows in the speech bubble while it waits. This is how a chat keeps waiting for input that can come at any time.',
    [`${C}chat-l1-repeat.step1`]:
        'In the diagram, the line that goes back to the diamond is the "forever" loop. First attach "ask Enter a message and wait" under "when flag clicked".',
    [`${C}chat-l1-repeat.step2`]: 'Under it, attach "forever" from the orange Control blocks.',
    [`${C}chat-l1-repeat.step3`]:
        'Make the variable "shimaraby_message", and put "set shimaraby_message to (answer)" and "ask (shimaraby_message) and wait" inside "forever".',
    [`${C}chat-l1-repeat.step4`]:
        'Click the flag and type messages two times or more. Check that the last message shows in the speech bubble while it waits.',
    [`${C}chat-l1-repeat.debug1`]:
        'If the last message does not show, check that (shimaraby_message) is in the white part of "ask and wait".',
    [`${C}chat-l1-repeat.quiz.question`]: 'What do we call doing the same steps again and again?',
    [`${C}chat-l1-repeat.quiz.choice1`]: 'Branching',
    [`${C}chat-l1-repeat.quiz.choice2`]: 'Sequence',
    [`${C}chat-l1-repeat.quiz.choice3`]: 'Repetition',
    [`${C}chat-l1-repeat.quiz.explanation`]:
        'Repetition means doing the same steps again and again. A chat repeats taking input forever, so you can post at any time.',

    [`${C}chat-l1-branch.name`]: "Don't Show Empty Messages (Branching)",
    [`${C}chat-l1-branch.task`]:
        'When the flag is clicked, ask "Enter a message". If nothing was typed, say "Write something"; otherwise put it into the variable "shimaraby_message" and say it for 2 seconds.',
    [`${C}chat-l1-branch.step1`]:
        'In the diagram, the flow splits at the top diamond and joins at the bottom diamond. That is "if then else". First attach "ask Enter a message and wait" under "when flag clicked".',
    [`${C}chat-l1-branch.step2`]: 'Under it, attach "if then else" from the orange Control blocks.',
    [`${C}chat-l1-branch.step3`]:
        'Put the green Operators block "( ) = ( )" in the hole of "if", and put (answer) on the left. Leave the right empty.',
    [`${C}chat-l1-branch.step4`]:
        'Put "say Write something for 2 seconds" inside "if", and "set shimaraby_message to (answer)" and "say (shimaraby_message) for 2 seconds" inside "else".',
    [`${C}chat-l1-branch.step5`]:
        'Click the flag and press Enter without typing. Click the flag again, type something and press Enter. Try both.',
    [`${C}chat-l1-branch.debug1`]:
        'If it does not say "Write something" when you type nothing, check that the right side of "=" is empty (no spaces either).',
    [`${C}chat-l1-branch.quiz.question`]: 'What do we call changing what to do by a condition?',
    [`${C}chat-l1-branch.quiz.choice1`]: 'Branching',
    [`${C}chat-l1-branch.quiz.choice2`]: 'Sequence',
    [`${C}chat-l1-branch.quiz.choice3`]: 'Repetition',
    [`${C}chat-l1-branch.quiz.explanation`]:
        'Branching means changing what to do by a condition. In an activity diagram, the flow splits at a diamond and joins at a diamond.',

    [`${C}chat-l1-read-diagram.name`]: 'Read the Diagram and Build',
    [`${C}chat-l1-read-diagram.task`]:
        'Read the diagram and make a program that repeats asking and saying until "end" is typed, and says "Bye!" at the end.',
    [`${C}chat-l1-read-diagram.explanation`]:
        'A program that repeats asking and saying until "end" is typed, and says "Bye!" at the end. Try to make it just by reading the diagram.',
    [`${C}chat-l1-read-diagram.quiz.question`]: 'In this program, what does it say last when you type "end"?',
    [`${C}chat-l1-read-diagram.quiz.choice1`]: 'end',
    [`${C}chat-l1-read-diagram.quiz.choice2`]: 'Bye!',
    [`${C}chat-l1-read-diagram.quiz.choice3`]: 'Nothing',
    [`${C}chat-l1-read-diagram.quiz.explanation`]:
        'When you type "end", the condition of the loop is met, so it leaves the loop without saying "end" and says "Bye!" below it. The end is the final node (the double circle).',

    'gui.lessons.lesson.chat-l2.name': 'Data and Events',

    [`${C}chat-l2-omikuji.name`]: 'Make a Fortune Draw (Random Numbers)',
    [`${C}chat-l2-omikuji.task`]:
        'When Shimaraby is clicked, put a random number from 1 to 3 into the variable "fortune". If fortune is 1, say "Great luck" for 2 seconds; otherwise say "Small luck" for 2 seconds.\nClick it a few times and get both Great luck and Small luck.',
    [`${C}chat-l2-omikuji.step1`]: 'Place the yellow Events block "when this sprite clicked".',
    [`${C}chat-l2-omikuji.step2`]:
        'In the orange Variables, click "Make a Variable" and make "fortune". Attach "set fortune to (pick random 1 to 3)". "pick random" is in the green Operators.',
    [`${C}chat-l2-omikuji.step3`]:
        'At the diamond of the diagram, the flow splits into two branches. Attach "if then else" from the orange Control blocks under it, and put "say Great luck for 2 seconds" inside "if" and "say Small luck for 2 seconds" inside "else" (change the white part).',
    [`${C}chat-l2-omikuji.step4`]:
        'The branch [fortune = 1] of the diagram is the condition of "if". Put the green "( ) = 1" in the hole of "if", and put (fortune) on the left.',
    [`${C}chat-l2-omikuji.step5`]: 'Click Shimaraby a few times. Check that both Great luck and Small luck come out.',
    [`${C}chat-l2-omikuji.debug1`]:
        'If the same one always comes out, check that (fortune) is on the left of the hole of "if", and that "set fortune to (pick random)" is above "if".',
    [`${C}chat-l2-omikuji.quiz.question`]: 'About how often does a random number from 1 to 3 become 1?',
    [`${C}chat-l2-omikuji.quiz.choice1`]: 'Once in 3 times',
    [`${C}chat-l2-omikuji.quiz.choice2`]: 'Once in 2 times',
    [`${C}chat-l2-omikuji.quiz.choice3`]: 'Every time',
    [`${C}chat-l2-omikuji.quiz.explanation`]:
        'A random number is picked by chance from a range each time. 1, 2 and 3 come out about equally, so it becomes 1 about once in 3 times.',

    [`${C}chat-l2-timer.name`]: 'Tell the Time with a Timer',
    [`${C}chat-l2-timer.task`]:
        'When the flag is clicked, reset the timer, wait until the timer is greater than 10, then say "10 seconds passed".\nThis is the base of a feature that tells you that you have used it too long. A real one would use 600 seconds (10 minutes), but use 10 seconds so you can try it easily.',
    [`${C}chat-l2-timer.step1`]:
        'Place the yellow Events block "when flag clicked", and attach the light blue Sensing block "reset timer" under it.',
    [`${C}chat-l2-timer.step2`]:
        'Under it, attach "wait until" from the orange Control blocks. It is the "wait until" box of the diagram.',
    [`${C}chat-l2-timer.step3`]:
        'Put the green Operators block "( ) > 10" in the hole of "wait until", and put the light blue (timer) on the left.',
    [`${C}chat-l2-timer.step4`]: 'Under it, attach the purple Looks block "say 10 seconds passed".',
    [`${C}chat-l2-timer.step5`]: 'Click the flag and wait 10 seconds. Check that it says it after 10 seconds.',
    [`${C}chat-l2-timer.debug1`]:
        'If it says it right away, check that the right side of ">" is 10 and that (timer) is on the left. Put only a number on the right, not words like "10 seconds".',
    [`${C}chat-l2-timer.quiz.question`]:
        'A feature that tells you that you have used it too long is a measure against which point to be careful about when using information technology?',
    [`${C}chat-l2-timer.quiz.choice1`]: 'You can no longer control how long you use it by yourself',
    [`${C}chat-l2-timer.quiz.choice2`]: 'The amount of data grows',
    [`${C}chat-l2-timer.quiz.choice3`]: 'The IP address changes',
    [`${C}chat-l2-timer.quiz.explanation`]:
        'You may keep watching videos or playing games and put them before studying or sleeping. A feature that tells the time gives you a chance to think about how you use it and to stop.',

    [`${C}chat-l2-janken.name`]: 'Find a Tie in Rock-Paper-Scissors',
    [`${C}chat-l2-janken.task`]:
        'When Shimaraby is clicked, ask "0:rock 1:scissors 2:paper". Pick the computer\'s hand with a random number from 0 to 2 and put it into the variable "hand". If the answer and hand are the same, say "Tie" for 2 seconds; if not, say "No tie" for 2 seconds.',
    [`${C}chat-l2-janken.step1`]:
        'Place "when this sprite clicked", and attach the light blue Sensing block "ask 0:rock 1:scissors 2:paper and wait" under it.',
    [`${C}chat-l2-janken.step2`]: 'Make the variable "hand", and attach "set hand to (pick random 0 to 2)".',
    [`${C}chat-l2-janken.step3`]:
        'Under it, attach "if then else", and put "say Tie for 2 seconds" inside "if" and "say No tie for 2 seconds" inside "else" (change the white part).',
    [`${C}chat-l2-janken.step4`]:
        'The branch [answer = hand] of the diagram is the condition of "if". Put "( ) = ( )" in the hole of "if", and put (answer) on the left and (hand) on the right.',
    [`${C}chat-l2-janken.step5`]:
        'Click Shimaraby, type a number and press Enter. Try a few times until both Tie and No tie come out.',
    [`${C}chat-l2-janken.debug1`]:
        'If it does not say "Tie" when the numbers should be the same, check that you typed the number in half-width (a full-width "０" is not equal to 0).',
    [`${C}chat-l2-janken.quiz.question`]: 'What does the variable "hand" do?',
    [`${C}chat-l2-janken.quiz.choice1`]: 'Shows a picture on the screen',
    [`${C}chat-l2-janken.quiz.choice2`]: 'Keeps a value to compare later',
    [`${C}chat-l2-janken.quiz.choice3`]: 'Connects to the network',
    [`${C}chat-l2-janken.quiz.explanation`]:
        "A variable is a named box that keeps a value. You can take the value out and use it later. Here it kept the computer's hand, compared it with the answer and changed what to say.",
    'gui.lessons.lesson.chat-l3.name': 'Connect with Mesh',

    [`${C}chat-l3-local-message.name`]: 'Send the Message and the Variable Apart (in One Computer)',
    [`${C}chat-l3-local-message.task`]:
        'Add Shimacat from the library. When the flag is clicked, Shimaraby asks "Enter a message", puts the answer into the variable "shimaraby_message" and broadcasts the message "shimaraby_message". When Shimacat receives that message, it says the variable "shimaraby_message" for 3 seconds.\nA message is only the news "I sent it". Keep the text in the variable.',
    [`${C}chat-l3-local-message.step1`]: 'Use "Choose a Sprite" at the bottom right to add Shimacat.',
    [`${C}chat-l3-local-message.step2`]:
        'Select Shimaraby and place the yellow Events block "when flag clicked". Under it, attach "ask Enter a message and wait", make the variable "shimaraby_message" and attach "set shimaraby_message to (answer)". Make the variable "For all sprites".',
    [`${C}chat-l3-local-message.step3`]:
        'Under it, attach the Events block "broadcast", and make "shimaraby_message" with "New message" in its ▼. In the diagram, the pointed pentagon is "broadcast".',
    [`${C}chat-l3-local-message.step4`]:
        'Select Shimacat, place "when I receive" and choose "shimaraby_message" in its ▼. In the diagram, the notched box is "when I receive", and the arrow from the pentagon comes into it. Under it, attach "say (shimaraby_message) for 3 seconds".',
    [`${C}chat-l3-local-message.step5`]:
        'Click the flag, type a message and press Enter. Check that Shimacat says what you typed.',
    [`${C}chat-l3-local-message.debug1`]:
        'If Shimacat says nothing, check that the ▼ of "when I receive" is "shimaraby_message".',
    [`${C}chat-l3-local-message.debug2`]:
        'If Shimacat says "0", check that you made the variable "For all sprites" and that "broadcast" is under "set shimaraby_message to (answer)".',
    [`${C}chat-l3-local-message.quiz.question`]: 'When you broadcast a message, what reaches the other side?',
    [`${C}chat-l3-local-message.quiz.choice1`]: 'Only the news "I sent it"',
    [`${C}chat-l3-local-message.quiz.choice2`]: 'The text you typed',
    [`${C}chat-l3-local-message.quiz.choice3`]: 'The picture of the sprite',
    [`${C}chat-l3-local-message.quiz.explanation`]:
        'A message only tells the news and carries no contents. Keep the contents in a variable, and the receiver reads that variable. The mesh works the same way.',

    [`${C}chat-l3-mesh-signal.name`]: 'Send Messages over the Mesh',
    [`${C}chat-l3-mesh-signal.task`]:
        'Add the extension "Mesh". In a pair, one of you becomes the host and makes a group, and the other joins that group. On your own, use the practice partner.\nWhen the space key is pressed, Shimaraby broadcasts the message "wave". When Shimacat receives "wave", it says "Hi!" for 2 seconds.',
    [`${C}chat-l3-mesh-signal.step1`]:
        'Choose "Mesh" with the extension button at the bottom left. "Mesh" is added to the palette.',
    [`${C}chat-l3-mesh-signal.step2`]:
        'In a pair, use the button next to "Mesh": one of you makes a group with "Become Mesh Host", and the other joins it with "Join Mesh". On your own, use the practice partner panel at the top right.',
    [`${C}chat-l3-mesh-signal.step3`]:
        'Select Shimaraby and place the yellow Events block "when space key pressed". Under it, attach "broadcast" and make "wave" with "New message" in its ▼.',
    [`${C}chat-l3-mesh-signal.step4`]:
        'Select Shimacat, place "when I receive wave" and attach "say Hi! for 2 seconds" under it. In the diagram, the arrow from the partner\'s pentagon also comes into this notched box.',
    [`${C}chat-l3-mesh-signal.step5`]:
        'Click the stage, then press the space key. On your own, also click "wave" on the practice partner panel. Check that Shimacat says "Hi!" either way.',
    [`${C}chat-l3-mesh-signal.debug1`]:
        'If nothing happens when you press the space key, click the stage once and press the space key again.',
    [`${C}chat-l3-mesh-signal.debug2`]:
        'If nothing comes from your pair, check that you are both in the same group and that the message name is the same "wave".',
    [`${C}chat-l3-mesh-signal.quiz.question`]:
        'What do we call the common rules that let different kinds of devices talk to each other?',
    [`${C}chat-l3-mesh-signal.quiz.choice1`]: 'Algorithm',
    [`${C}chat-l3-mesh-signal.quiz.choice2`]: 'Content',
    [`${C}chat-l3-mesh-signal.quiz.choice3`]: 'Protocol',
    [`${C}chat-l3-mesh-signal.quiz.explanation`]:
        'The rules of communication are called a protocol. The internet uses the protocol TCP/IP, and the mesh delivers messages on top of it.',

    [`${C}chat-l3-mesh-variable.name`]: 'Share a Variable',
    [`${C}chat-l3-mesh-variable.task`]:
        'With the 1 key, set the variable "shimaraby_mood" to "happy", and with the 2 key to "sleepy". When Shimacat is clicked, it says the mood of Shimacat (the sensor value of "shimacat_mood") for 2 seconds.\nIn a pair, the one who plays Shimacat swaps Shimaraby and Shimacat.',
    [`${C}chat-l3-mesh-variable.step1`]:
        'Select Shimaraby and make "shimaraby_mood" with "Make a Variable" in the orange Variables. Make it "For all sprites" so that it is shared with the one you connect to over the mesh.',
    [`${C}chat-l3-mesh-variable.step2`]:
        'Place the yellow Events block "when 1 key pressed" and attach "set shimaraby_mood to happy".',
    [`${C}chat-l3-mesh-variable.step3`]:
        'Place another "when 2 key pressed" and attach "set shimaraby_mood to sleepy".',
    [`${C}chat-l3-mesh-variable.step4`]:
        'On your own, click "happy" on the practice partner panel (in a pair, ask your pair to press the 1 key). When the mood arrives, "shimacat_mood" appears in the ▼ of the Mesh block "( ) sensor value".',
    [`${C}chat-l3-mesh-variable.step5`]:
        'Select Shimacat and place "when this sprite clicked". Under it, attach "say ( ) for 2 seconds" and put "(shimacat_mood) sensor value" into its white space.',
    [`${C}chat-l3-mesh-variable.step6`]:
        'Press the 1 key and the 2 key, and check that your mood appears in "Received" on the practice partner panel. Click "happy" or "sleepy" on the panel, then click Shimacat and check that it says the mood of the partner.',
    [`${C}chat-l3-mesh-variable.debug1`]:
        'If "shimacat_mood" is not in the ▼, first click "happy" on the practice partner panel (in a pair, ask your pair to press the 1 key).',
    [`${C}chat-l3-mesh-variable.debug2`]:
        'If your mood does not reach the other side, check that you made the variable "shimaraby_mood" "For all sprites".',
    [`${C}chat-l3-mesh-variable.debug3`]:
        'In the ▼ of "sensor value", choose the mood of the other side ("shimacat_mood"). If you choose your own mood, it cannot say the mood of the other side.',
    [`${C}chat-l3-mesh-variable.quiz.question`]:
        'What do we call the number given to each device on a network to tell it apart?',
    [`${C}chat-l3-mesh-variable.quiz.choice1`]: 'Domain name',
    [`${C}chat-l3-mesh-variable.quiz.choice2`]: 'IP address',
    [`${C}chat-l3-mesh-variable.quiz.choice3`]: 'Router',
    [`${C}chat-l3-mesh-variable.quiz.explanation`]:
        'An IP address tells which device to talk to. Numbers alone are hard for people to read, so web pages use a domain name made of letters instead.',
};
