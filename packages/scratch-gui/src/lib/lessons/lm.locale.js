// コース「ことばを予想する AI をつくろう」（中学 3 年〜高校・EPIC #2103）の文言。
// lessons.locale.js の ja / jaHira / en に spread する（コースのデータは courses.js の lmLesson1 など）。
// キーの決まりは lessons.locale.js と同じ `gui.lessons.<course|lesson|challenge>.<id>.<field>`。
// ja-Hira は漢字を使わない。en の名前（変数・リスト・定義ブロック）は courses.js の LM_WORDS と同じ。

const C = 'gui.lessons.challenge.';

export const ja = {
    'gui.lessons.course.kotoba-yosou-ai.name': 'ことばを予想する AI をつくろう',
    'gui.lessons.course.kotoba-yosou-ai.description':
        '前の文字から次の文字を予想する小さな AI をリストと乱数で作り、生成 AI が学習したデータから次のことばを選んでいることを確かめるよ。',
    'gui.lessons.lesson.lm-l1.name': 'AI と話してみよう',

    [`${C}lm-l1-make.name`]: 'AI に文を作らせよう',
    [`${C}lm-l1-make.task`]:
        'AI に文を作らせよう。\nロボットを押したら、AI が文を 1 つ作って言うようにしよう。\n（旗を押すと、AI が教科書の文を学習します）',
    [`${C}lm-l1-make.step1`]:
        'このプログラムには、AI の 4 つの定義ブロック（学習する・こうほを集める・文字をえらぶ・文をつくる）が、もう入っています。まず「イベント」の「このスプライトが押されたとき」を置こう。',
    [`${C}lm-l1-make.step2`]:
        '「このスプライトが押されたとき」の下に、「ブロック定義」の「文をつくる」をつなげよう。',
    [`${C}lm-l1-make.step3`]:
        '「文をつくる」の下に「見た目」の「(こんにちは！) と言う」をつなげ、「こんにちは！」のところに「変数」の「文」を入れよう。',
    [`${C}lm-l1-make.step4`]:
        'Ruby で読むと、こうなります。「when_clicked do」から「end」までが「このスプライトが押されたとき」のスクリプトです。定義ブロック「文をつくる」は、名前を書くだけで呼べます。変数の名前の前には「@」が付きます。',
    [`${C}lm-l1-make.step5`]:
        '旗を押して AI に教科書を学習させてから、ステージのロボットを押してみよう。AI が文を作って言います。',
    [`${C}lm-l1-make.debug1`]: '先に旗を押したか見よう。学習する前の AI は何も知らないので、文を作れません。',

    [`${C}lm-l1-teach.name`]: '教科書に文を足そう',
    [`${C}lm-l1-teach.task`]:
        'AI に新しい文を教えよう。\n「a」キーを押したら、教える文を入力して教科書に足し、もう一度学習するようにしよう。\n足した文の言葉を AI が使うか、ロボットを押して確かめよう。',
    [`${C}lm-l1-teach.step1`]: '「イベント」の「(a) キーが押されたとき」を置こう。',
    [`${C}lm-l1-teach.step2`]: 'その下に「調べる」の「(教える文を入れてね) と聞いて待つ」をつなげよう。',
    [`${C}lm-l1-teach.step3`]:
        '「変数」の「(なにか) を (教科書) に追加する」をつなげ、「なにか」のところに「調べる」の「答え」を入れよう（▼ で「教科書」を選ぶ）。入力した文が教科書の最後に入ります。',
    [`${C}lm-l1-teach.step4`]:
        '最後に「ブロック定義」の「学習する」をつなげよう。教科書が変わっても、学習し直さないと AI は新しい文を知りません。',
    [`${C}lm-l1-teach.step5`]:
        'Ruby で読むと、こうなります。「答え」は「answer」、リストに足すのは「@教科書.push(answer)」です。',
    [`${C}lm-l1-teach.step6`]:
        '旗を押してから「a」キーを押し、「。」で終わる文を入れよう（例: 「ロボットはおしゃべりが好きです。」）。そのあとロボットを何回か押してみよう。',
    [`${C}lm-l1-teach.debug1`]:
        '「学習する」が「追加する」のあとにあるか見よう。前にあると、足した文を学習しません。',

    [`${C}lm-l1-look.name`]: '「こ」の次を数えよう',
    [`${C}lm-l1-look.task`]:
        'AI が覚えたことを見てみよう。\nステージの「まえ」と「つぎ」は、同じ行どうしで「この文字の次に、この文字が来た」という組です。\n「c」キーを押したら、「こ」の次に来た文字を「こうほ」に集めて見せよう。',
    [`${C}lm-l1-look.step1`]:
        '旗を押して、ステージの「まえ」と「つぎ」を見てみよう。「まえ」が空の行は、文の 1 文字めです。行がたくさんあって「こ」の行を探すのは大変なので、「こうほを集める」に集めてもらいます。まず「(c) キーが押されたとき」を置こう。',
    [`${C}lm-l1-look.step2`]:
        'その下に「変数」の「(文) を (こ) にする」をつなげよう（▼ で「文」を選ぶ）。「こうほを集める」は、「文」の最後の文字の次に来た文字を集めます。',
    [`${C}lm-l1-look.step3`]:
        '「ブロック定義」の「こうほを集める」と、「変数」の「リスト (こうほ) を表示する」をつなげよう。',
    [`${C}lm-l1-look.step4`]:
        'Ruby で読むと、こうなります。「文」に「こ」を入れるのは「@文 = "こ"」、リストを表示するのは「show_list("@こうほ")」です。',
    [`${C}lm-l1-look.step5`]: '旗を押してから「c」キーを押そう。ステージの「こうほ」に出た文字を数えてみよう。',
    [`${C}lm-l1-look.debug1`]: '先に旗を押したか見よう。学習する前は「まえ」「つぎ」が空なので、こうほも空です。',
    [`${C}lm-l1-look.quiz.question`]: '「こうほ」に入ったのは、どれ？',
    [`${C}lm-l1-look.quiz.choice1`]: '「ん」が 1 つと「で」が 1 つ',
    [`${C}lm-l1-look.quiz.choice2`]: '「ん」が 3 つと「で」が 1 つ',
    [`${C}lm-l1-look.quiz.choice3`]: '「ん」「に」「ち」「は」が 1 つずつ',
    [`${C}lm-l1-look.quiz.explanation`]:
        '教科書には「こんにちは」が 2 回、「こんばんは」が 1 回、「ねこです」が 1 回あるので、「こ」の次は「ん」が 3 回、「で」が 1 回です。AI は数えずに、出てきた回数だけ「まえ」「つぎ」に入れています。',

    [`${C}lm-l1-random.name`]: '何回も作らせよう',
    [`${C}lm-l1-random.task`]:
        'ロボットを 1 回押したら、AI が文を 5 回作って、1 つずつ 2 秒言うようにしよう。\n毎回ちがう文になるかな？',
    [`${C}lm-l1-random.step1`]:
        '「このスプライトが押されたとき」の下にある 2 つのブロックを外して、「制御」の「(5) 回繰り返す」をつなげよう。',
    [`${C}lm-l1-random.step2`]:
        '「(5) 回繰り返す」の中に「文をつくる」と「見た目」の「(こんにちは！) と (2) 秒言う」を入れ、「こんにちは！」のところに「文」を入れよう。外した「(文) と言う」は消してよい。',
    [`${C}lm-l1-random.step3`]: 'Ruby で読むと、こうなります。「5.times do」から「end」までを 5 回くり返します。',
    [`${C}lm-l1-random.step4`]: '旗を押してから、ロボットを押そう。5 つの文はちがったかな？',
    [`${C}lm-l1-random.debug1`]: '「文をつくる」がくり返しの中にあるか見よう。外にあると、同じ文を 5 回言います。',
    [`${C}lm-l1-random.quiz.question`]: '同じプログラムなのに、作る文が毎回ちがうのはなぜ？',
    [`${C}lm-l1-random.quiz.choice1`]: '押すたびに教科書が変わるから',
    [`${C}lm-l1-random.quiz.choice2`]: '押すたびに学習し直しているから',
    [`${C}lm-l1-random.quiz.choice3`]: '次の文字を「こうほ」から乱数で選んでいるから',
    [`${C}lm-l1-random.quiz.explanation`]:
        '「文字をえらぶ」が、こうほの中から乱数で 1 つ選んでいます。こうほにたくさん入っている文字ほど選ばれやすいので、それらしい文になりやすくなります。',

    'gui.lessons.lesson.lm-l2.name': 'ことばを文字に分けよう',

    [`${C}lm-l2-letters.name`]: '1 文字ずつ言おう',
    [`${C}lm-l2-letters.task`]:
        'AI は文を 1 文字ずつ扱っています。\nロボットを押したら、AI が文を作って、その文を 1 文字ずつ 0.5 秒言うようにしよう。',
    [`${C}lm-l2-letters.step1`]:
        '「このスプライトが押されたとき」のスクリプトの「(文) と言う」を外して消そう。「文をつくる」の下に「変数」の「(何文字目) を (1) にする」をつなげよう（▼ で「何文字目」を選ぶ）。「何文字目」は、いま何文字めを言うかの番号です。',
    [`${C}lm-l2-letters.step2`]:
        'その下に「制御」の「( ) まで繰り返す」をつなげ、穴に「演算」の「( ) > ( )」を入れよう。左に「何文字目」、右に「演算」の「(りんご) の長さ」を入れ、「りんご」のところに「文」を入れよう。何文字目が文の長さより大きくなったら止まります。',
    [`${C}lm-l2-letters.step3`]:
        'くり返しの中に「見た目」の「(こんにちは！) と (0.5) 秒言う」と「変数」の「(何文字目) を (1) ずつ変える」を入れよう。「こんにちは！」のところに「演算」の「(りんご) の (1) 番目の文字」を入れ、「りんご」に「文」、「1」に「何文字目」を入れよう。',
    [`${C}lm-l2-letters.step4`]:
        'Ruby で読むと、こうなります。Ruby では文字の番号を 0 から数えるので、ブロックの「(文) の (何文字目) 番目の文字」は「@文[@何文字目 - 1]」と書きます。「の長さ」は「.length」、「まで繰り返す」は「until」です。',
    [`${C}lm-l2-letters.step5`]:
        '旗を押してから、ロボットを押そう。AI が作った文を、1 文字ずつ言います。「、」や「。」も 1 文字です。',
    [`${C}lm-l2-letters.debug1`]:
        '「(何文字目) を (1) ずつ変える」がくり返しの中にあるか見よう。無いと、ずっと 1 文字めを言います。',
    [`${C}lm-l2-letters.debug2`]:
        '「(何文字目) を (1) にする」がくり返しの前にあるか見よう。無いと、2 回めに押したとき、前の続きから数えます。',
    [`${C}lm-l2-letters.quiz.question`]: '「文」が「こんにちは。」のとき、「(文) の (3) 番目の文字」は、どれ？',
    [`${C}lm-l2-letters.quiz.choice1`]: '「ん」',
    [`${C}lm-l2-letters.quiz.choice2`]: '「に」',
    [`${C}lm-l2-letters.quiz.choice3`]: '「ち」',
    [`${C}lm-l2-letters.quiz.explanation`]:
        '1 番目が「こ」、2 番目が「ん」、3 番目が「に」です。ブロックでは 1 から数えます（Ruby では 0 から数えるので「@文[2]」です）。',

    [`${C}lm-l2-pairs.name`]: '1 つの文の組を作ろう',
    [`${C}lm-l2-pairs.task`]:
        '「学習する」の中身を作り直そう。\nいまの「学習する」は、教科書の 1 文めを 1 文字ずつ読むだけです。読みながら、「前の文字」と「いまの文字」の組を「まえ」「つぎ」に足すようにしよう。',
    [`${C}lm-l2-pairs.step1`]:
        '「学習する」の定義の中の「( ) まで繰り返す」の中に、「変数」の「(なにか) を (まえ) に追加する」を入れよう（「(何文字目) を (1) ずつ変える」の上に。▼ で「まえ」を選ぶ）。「なにか」のところに「前の文字」を入れよう。',
    [`${C}lm-l2-pairs.step2`]:
        'その下に「(なにか) を (つぎ) に追加する」をつなげ、「なにか」のところに「演算」の「(文) の (何文字目) 番目の文字」（いまの文字）を入れよう。「まえ」と「つぎ」の同じ行が 1 組になります。',
    [`${C}lm-l2-pairs.step3`]:
        'その下に「(前の文字) を ( ) にする」をつなげ、「(文) の (何文字目) 番目の文字」を入れよう。次の文字から見ると、いまの文字が「前の文字」になります。',
    [`${C}lm-l2-pairs.step4`]:
        'Ruby で読むと、こうなります。リストに足すのは「@まえ.push(@前の文字)」、いまの文字は「@文[@何文字目 - 1]」です。',
    [`${C}lm-l2-pairs.step5`]:
        '旗を押して、ステージの「まえ」「つぎ」を見よう。1 行めの「まえ」は空で、「つぎ」は文の 1 文字めです。ロボットを押すと、AI はこの 1 文しか知らないので、ほとんど同じ文を言います。',
    [`${C}lm-l2-pairs.debug1`]:
        '「(前の文字) を ( ) にする」が 2 つの「追加する」の下にあるか見よう。上にあると、「まえ」にもいまの文字が入ります。',
    [`${C}lm-l2-pairs.debug2`]: '3 つのブロックが「学習する」の中の、1 文字ずつ読むくり返しの中にあるか見よう。',
    [`${C}lm-l2-pairs.quiz.question`]: '「ねこです。」という 1 つの文を学習すると、「まえ」と「つぎ」に何組入る？',
    [`${C}lm-l2-pairs.quiz.choice1`]: '4 組',
    [`${C}lm-l2-pairs.quiz.choice2`]: '5 組',
    [`${C}lm-l2-pairs.quiz.choice3`]: '6 組',
    [`${C}lm-l2-pairs.quiz.explanation`]:
        '（空 → ね）（ね → こ）（こ → で）（で → す）（す → 。）の 5 組です。文の文字の数と同じだけ組ができます。1 つめの組の「まえ」が空なので、AI は何も言われなくても文を始められます。',

    [`${C}lm-l2-learn.name`]: '教科書を全部学習しよう',
    [`${C}lm-l2-learn.task`]:
        'いまの「学習する」は、教科書の 1 文めだけを学習します。\n「何文目」を 1 から教科書の長さまで変えながらくり返して、教科書の全部の文を学習するようにしよう。',
    [`${C}lm-l2-learn.step1`]:
        '「学習する」の定義の中の「(何文目) を (1) にする」の下に、「制御」の「( ) まで繰り返す」を置こう。穴に「演算」の「( ) > ( )」を入れ、左に「何文目」、右に「変数」の「(教科書) の長さ」を入れよう。',
    [`${C}lm-l2-learn.step2`]:
        '「(文) を (教科書 の (何文目) 番目) にする」から、1 文字ずつ読むくり返しの終わりまでをドラッグして、新しいくり返しの中に入れよう。',
    [`${C}lm-l2-learn.step3`]:
        '新しいくり返しの中の最後（1 文字ずつ読むくり返しの下）に、「(何文目) を (1) ずつ変える」を入れよう。',
    [`${C}lm-l2-learn.step4`]:
        'Ruby で読むと、こうなります。「until」の中に「until」が入っています。外のくり返しが文を 1 つずつ、中のくり返しが文字を 1 つずつ進めます。',
    [`${C}lm-l2-learn.step5`]:
        '旗を押してから、ロボットを何回か押そう。教科書の全部の文を学習したので、いろいろな文を作ります。',
    [`${C}lm-l2-learn.debug1`]:
        '「(何文目) を (1) ずつ変える」が外のくり返しの中にあるか見よう。無いと、ずっと 1 文めを学習し続けます。',
    [`${C}lm-l2-learn.debug2`]:
        '「(前の文字) を () にする」と「(何文字目) を (1) にする」が外のくり返しの中にあるか見よう。外にあると、2 文めからが正しく読めません。',
    [`${C}lm-l2-learn.quiz.question`]: '教科書の全部の文を学習したとき、「まえ」の行の数は、どれと同じ？',
    [`${C}lm-l2-learn.quiz.choice1`]: '教科書の文の数',
    [`${C}lm-l2-learn.quiz.choice2`]: '教科書の全部の文の文字の数を合わせた数',
    [`${C}lm-l2-learn.quiz.choice3`]: '「まえ」に入っている、ちがう文字の数',
    [`${C}lm-l2-learn.quiz.explanation`]:
        '1 文字ごとに 1 組足すので、全部の文の文字の数を合わせた数になります。AI は数を数えずに、出てきた回数だけ組を覚えています。',
};

export const jaHira = {
    'gui.lessons.course.kotoba-yosou-ai.name': 'ことばを よそうする AI を つくろう',
    'gui.lessons.course.kotoba-yosou-ai.description':
        'まえの もじから つぎの もじを よそうする ちいさな AI を リストと らんすうで つくり、せいせい AI が がくしゅうした データから つぎの ことばを えらんでいることを たしかめるよ。',
    'gui.lessons.lesson.lm-l1.name': 'AI と はなしてみよう',

    [`${C}lm-l1-make.name`]: 'AI に ぶんを つくらせよう',
    [`${C}lm-l1-make.task`]:
        'AI に ぶんを つくらせよう。\nロボットを おしたら、AI が ぶんを 1 つ つくって いうように しよう。\n（はたを おすと、AI が きょうかしょの ぶんを がくしゅうします）',
    [`${C}lm-l1-make.step1`]:
        'この プログラムには、AI の 4 つの ていぎブロック（がくしゅうする・こうほをあつめる・もじをえらぶ・ぶんをつくる）が、もう はいっています。まず「イベント」の「このスプライトが おされたとき」を おこう。',
    [`${C}lm-l1-make.step2`]:
        '「このスプライトが おされたとき」の したに、「ブロックていぎ」の「ぶんをつくる」を つなげよう。',
    [`${C}lm-l1-make.step3`]:
        '「ぶんをつくる」の したに「みため」の「(こんにちは！) と いう」を つなげ、「こんにちは！」の ところに「へんすう」の「ぶん」を いれよう。',
    [`${C}lm-l1-make.step4`]:
        'Ruby で よむと、こう なります。「when_clicked do」から「end」までが「このスプライトが おされたとき」の スクリプトです。ていぎブロック「ぶんをつくる」は、なまえを かくだけで よべます。へんすうの なまえの まえには「@」が つきます。',
    [`${C}lm-l1-make.step5`]:
        'はたを おして AI に きょうかしょを がくしゅうさせてから、ステージの ロボットを おしてみよう。AI が ぶんを つくって いいます。',
    [`${C}lm-l1-make.debug1`]:
        'さきに はたを おしたか みよう。がくしゅうする まえの AI は なにも しらないので、ぶんを つくれません。',

    [`${C}lm-l1-teach.name`]: 'きょうかしょに ぶんを たそう',
    [`${C}lm-l1-teach.task`]:
        'AI に あたらしい ぶんを おしえよう。\n「a」キーを おしたら、おしえる ぶんを にゅうりょくして きょうかしょに たし、もういちど がくしゅうするように しよう。\nたした ぶんの ことばを AI が つかうか、ロボットを おして たしかめよう。',
    [`${C}lm-l1-teach.step1`]: '「イベント」の「(a) キーが おされたとき」を おこう。',
    [`${C}lm-l1-teach.step2`]:
        'その したに「しらべる」の「(おしえる ぶんを いれてね) と きいて まつ」を つなげよう。',
    [`${C}lm-l1-teach.step3`]:
        '「へんすう」の「(なにか) を (きょうかしょ) に ついかする」を つなげ、「なにか」の ところに「しらべる」の「こたえ」を いれよう（▼ で「きょうかしょ」を えらぶ）。にゅうりょくした ぶんが きょうかしょの さいごに はいります。',
    [`${C}lm-l1-teach.step4`]:
        'さいごに「ブロックていぎ」の「がくしゅうする」を つなげよう。きょうかしょが かわっても、がくしゅうしなおさないと AI は あたらしい ぶんを しりません。',
    [`${C}lm-l1-teach.step5`]:
        'Ruby で よむと、こう なります。「こたえ」は「answer」、リストに たすのは「@きょうかしょ.push(answer)」です。',
    [`${C}lm-l1-teach.step6`]:
        'はたを おしてから「a」キーを おし、「。」で おわる ぶんを いれよう（れい: 「ロボットは おしゃべりが すきです。」）。その あと ロボットを なんかいか おしてみよう。',
    [`${C}lm-l1-teach.debug1`]:
        '「がくしゅうする」が「ついかする」の あとに あるか みよう。まえに あると、たした ぶんを がくしゅうしません。',

    [`${C}lm-l1-look.name`]: '「こ」の つぎを かぞえよう',
    [`${C}lm-l1-look.task`]:
        'AI が おぼえた ことを みてみよう。\nステージの「まえ」と「つぎ」は、おなじ ぎょうどうしで「この もじの つぎに、この もじが きた」という くみです。\n「c」キーを おしたら、「こ」の つぎに きた もじを「こうほ」に あつめて みせよう。',
    [`${C}lm-l1-look.step1`]:
        'はたを おして、ステージの「まえ」と「つぎ」を みてみよう。「まえ」が からの ぎょうは、ぶんの 1 もじめです。ぎょうが たくさん あって「こ」の ぎょうを さがすのは たいへんなので、「こうほをあつめる」に あつめて もらいます。まず「(c) キーが おされたとき」を おこう。',
    [`${C}lm-l1-look.step2`]:
        'その したに「へんすう」の「(ぶん) を (こ) にする」を つなげよう（▼ で「ぶん」を えらぶ）。「こうほをあつめる」は、「ぶん」の さいごの もじの つぎに きた もじを あつめます。',
    [`${C}lm-l1-look.step3`]:
        '「ブロックていぎ」の「こうほをあつめる」と、「へんすう」の「リスト (こうほ) を ひょうじする」を つなげよう。',
    [`${C}lm-l1-look.step4`]:
        'Ruby で よむと、こう なります。「ぶん」に「こ」を いれるのは「@ぶん = "こ"」、リストを ひょうじするのは「show_list("@こうほ")」です。',
    [`${C}lm-l1-look.step5`]:
        'はたを おしてから「c」キーを おそう。ステージの「こうほ」に でた もじを かぞえてみよう。',
    [`${C}lm-l1-look.debug1`]:
        'さきに はたを おしたか みよう。がくしゅうする まえは「まえ」「つぎ」が からなので、こうほも からです。',
    [`${C}lm-l1-look.quiz.question`]: '「こうほ」に はいったのは、どれ？',
    [`${C}lm-l1-look.quiz.choice1`]: '「ん」が 1 つと「で」が 1 つ',
    [`${C}lm-l1-look.quiz.choice2`]: '「ん」が 3 つと、「う」「で」「し」が 1 つずつ',
    [`${C}lm-l1-look.quiz.choice3`]: '「ん」「に」「ち」「は」が 1 つずつ',
    [`${C}lm-l1-look.quiz.explanation`]:
        'きょうかしょには「こんにちは」が 2 かい、「こんばんは」が 1 かい、「こうえん」「ねこです」「すこし」が 1 かいずつ あるので、「こ」の つぎは「ん」が 3 かい、「う」「で」「し」が 1 かいずつです。AI は かぞえずに、でてきた かいすうだけ「まえ」「つぎ」に いれています。',

    [`${C}lm-l1-random.name`]: 'なんかいも つくらせよう',
    [`${C}lm-l1-random.task`]:
        'ロボットを 1 かい おしたら、AI が ぶんを 5 かい つくって、1 つずつ 2 びょう いうように しよう。\nまいかい ちがう ぶんに なるかな？',
    [`${C}lm-l1-random.step1`]:
        '「このスプライトが おされたとき」の したに ある 2 つの ブロックを はずして、「せいぎょ」の「(5) かい くりかえす」を つなげよう。',
    [`${C}lm-l1-random.step2`]:
        '「(5) かい くりかえす」の なかに「ぶんをつくる」と「みため」の「(こんにちは！) と (2) びょう いう」を いれ、「こんにちは！」の ところに「ぶん」を いれよう。はずした「(ぶん) と いう」は けして よい。',
    [`${C}lm-l1-random.step3`]:
        'Ruby で よむと、こう なります。「5.times do」から「end」までを 5 かい くりかえします。',
    [`${C}lm-l1-random.step4`]: 'はたを おしてから、ロボットを おそう。5 つの ぶんは ちがったかな？',
    [`${C}lm-l1-random.debug1`]:
        '「ぶんをつくる」が くりかえしの なかに あるか みよう。そとに あると、おなじ ぶんを 5 かい いいます。',
    [`${C}lm-l1-random.quiz.question`]: 'おなじ プログラムなのに、つくる ぶんが まいかい ちがうのは なぜ？',
    [`${C}lm-l1-random.quiz.choice1`]: 'おすたびに きょうかしょが かわるから',
    [`${C}lm-l1-random.quiz.choice2`]: 'おすたびに がくしゅうしなおしているから',
    [`${C}lm-l1-random.quiz.choice3`]: 'つぎの もじを「こうほ」から らんすうで えらんでいるから',
    [`${C}lm-l1-random.quiz.explanation`]:
        '「もじをえらぶ」が、こうほの なかから らんすうで 1 つ えらんでいます。こうほに たくさん はいっている もじほど えらばれやすいので、それらしい ぶんに なりやすく なります。',

    'gui.lessons.lesson.lm-l2.name': 'ことばを もじに わけよう',

    [`${C}lm-l2-letters.name`]: '1 もじずつ いおう',
    [`${C}lm-l2-letters.task`]:
        'AI は ぶんを 1 もじずつ あつかっています。\nロボットを おしたら、AI が ぶんを つくって、その ぶんを 1 もじずつ 0.5 びょう いうように しよう。',
    [`${C}lm-l2-letters.step1`]:
        '「このスプライトが おされたとき」の スクリプトの「(ぶん) と いう」を はずして けそう。「ぶんをつくる」の したに「へんすう」の「(なんもじめ) を (1) にする」を つなげよう（▼ で「なんもじめ」を えらぶ）。「なんもじめ」は、いま なんもじめを いうかの ばんごうです。',
    [`${C}lm-l2-letters.step2`]:
        'その したに「せいぎょ」の「( ) まで くりかえす」を つなげ、あなに「えんざん」の「( ) > ( )」を いれよう。ひだりに「なんもじめ」、みぎに「えんざん」の「(りんご) の ながさ」を いれ、「りんご」の ところに「ぶん」を いれよう。なんもじめが ぶんの ながさより おおきく なったら とまります。',
    [`${C}lm-l2-letters.step3`]:
        'くりかえしの なかに「みため」の「(こんにちは！) と (0.5) びょう いう」と「へんすう」の「(なんもじめ) を (1) ずつ かえる」を いれよう。「こんにちは！」の ところに「えんざん」の「(りんご) の (1) ばんめの もじ」を いれ、「りんご」に「ぶん」、「1」に「なんもじめ」を いれよう。',
    [`${C}lm-l2-letters.step4`]:
        'Ruby で よむと、こう なります。Ruby では もじの ばんごうを 0 から かぞえるので、ブロックの「(ぶん) の (なんもじめ) ばんめの もじ」は「@ぶん[@なんもじめ - 1]」と かきます。「の ながさ」は「.length」、「まで くりかえす」は「until」です。',
    [`${C}lm-l2-letters.step5`]:
        'はたを おしてから、ロボットを おそう。AI が つくった ぶんを、1 もじずつ いいます。「、」や「。」も 1 もじです。',
    [`${C}lm-l2-letters.debug1`]:
        '「(なんもじめ) を (1) ずつ かえる」が くりかえしの なかに あるか みよう。ないと、ずっと 1 もじめを いいます。',
    [`${C}lm-l2-letters.debug2`]:
        '「(なんもじめ) を (1) にする」が くりかえしの まえに あるか みよう。ないと、2 かいめに おしたとき、まえの つづきから かぞえます。',
    [`${C}lm-l2-letters.quiz.question`]:
        '「ぶん」が「こんにちは。」の とき、「(ぶん) の (3) ばんめの もじ」は、どれ？',
    [`${C}lm-l2-letters.quiz.choice1`]: '「ん」',
    [`${C}lm-l2-letters.quiz.choice2`]: '「に」',
    [`${C}lm-l2-letters.quiz.choice3`]: '「ち」',
    [`${C}lm-l2-letters.quiz.explanation`]:
        '1 ばんめが「こ」、2 ばんめが「ん」、3 ばんめが「に」です。ブロックでは 1 から かぞえます（Ruby では 0 から かぞえるので「@ぶん[2]」です）。',

    [`${C}lm-l2-pairs.name`]: '1 つの ぶんの くみを つくろう',
    [`${C}lm-l2-pairs.task`]:
        '「がくしゅうする」の なかみを つくりなおそう。\nいまの「がくしゅうする」は、きょうかしょの 1 ぶんめを 1 もじずつ よむだけです。よみながら、「まえのもじ」と「いまの もじ」の くみを「まえ」「つぎ」に たすように しよう。',
    [`${C}lm-l2-pairs.step1`]:
        '「がくしゅうする」の ていぎの なかの「( ) まで くりかえす」の なかに、「へんすう」の「(なにか) を (まえ) に ついかする」を いれよう（「(なんもじめ) を (1) ずつ かえる」の うえに。▼ で「まえ」を えらぶ）。「なにか」の ところに「まえのもじ」を いれよう。',
    [`${C}lm-l2-pairs.step2`]:
        'その したに「(なにか) を (つぎ) に ついかする」を つなげ、「なにか」の ところに「えんざん」の「(ぶん) の (なんもじめ) ばんめの もじ」（いまの もじ）を いれよう。「まえ」と「つぎ」の おなじ ぎょうが 1 くみに なります。',
    [`${C}lm-l2-pairs.step3`]:
        'その したに「(まえのもじ) を ( ) にする」を つなげ、「(ぶん) の (なんもじめ) ばんめの もじ」を いれよう。つぎの もじから みると、いまの もじが「まえのもじ」に なります。',
    [`${C}lm-l2-pairs.step4`]:
        'Ruby で よむと、こう なります。リストに たすのは「@まえ.push(@まえのもじ)」、いまの もじは「@ぶん[@なんもじめ - 1]」です。',
    [`${C}lm-l2-pairs.step5`]:
        'はたを おして、ステージの「まえ」「つぎ」を みよう。1 ぎょうめの「まえ」は からで、「つぎ」は ぶんの 1 もじめです。ロボットを おすと、AI は この 1 ぶんしか しらないので、ほとんど おなじ ぶんを いいます。',
    [`${C}lm-l2-pairs.debug1`]:
        '「(まえのもじ) を ( ) にする」が 2 つの「ついかする」の したに あるか みよう。うえに あると、「まえ」にも いまの もじが はいります。',
    [`${C}lm-l2-pairs.debug2`]:
        '3 つの ブロックが「がくしゅうする」の なかの、1 もじずつ よむ くりかえしの なかに あるか みよう。',
    [`${C}lm-l2-pairs.quiz.question`]:
        '「ねこです。」と いう 1 つの ぶんを がくしゅうすると、「まえ」と「つぎ」に なんくみ はいる？',
    [`${C}lm-l2-pairs.quiz.choice1`]: '4 くみ',
    [`${C}lm-l2-pairs.quiz.choice2`]: '5 くみ',
    [`${C}lm-l2-pairs.quiz.choice3`]: '6 くみ',
    [`${C}lm-l2-pairs.quiz.explanation`]:
        '（から → ね）（ね → こ）（こ → で）（で → す）（す → 。）の 5 くみです。ぶんの もじの かずと おなじだけ くみが できます。1 つめの くみの「まえ」が からなので、AI は なにも いわれなくても ぶんを はじめられます。',

    [`${C}lm-l2-learn.name`]: 'きょうかしょを ぜんぶ がくしゅうしよう',
    [`${C}lm-l2-learn.task`]:
        'いまの「がくしゅうする」は、きょうかしょの 1 ぶんめだけを がくしゅうします。\n「なんぶんめ」を 1 から きょうかしょの ながさまで かえながら くりかえして、きょうかしょの ぜんぶの ぶんを がくしゅうするように しよう。',
    [`${C}lm-l2-learn.step1`]:
        '「がくしゅうする」の ていぎの なかの「(なんぶんめ) を (1) にする」の したに、「せいぎょ」の「( ) まで くりかえす」を おこう。あなに「えんざん」の「( ) > ( )」を いれ、ひだりに「なんぶんめ」、みぎに「へんすう」の「(きょうかしょ) の ながさ」を いれよう。',
    [`${C}lm-l2-learn.step2`]:
        '「(ぶん) を (きょうかしょ の (なんぶんめ) ばんめ) にする」から、1 もじずつ よむ くりかえしの おわりまでを ドラッグして、あたらしい くりかえしの なかに いれよう。',
    [`${C}lm-l2-learn.step3`]:
        'あたらしい くりかえしの なかの さいご（1 もじずつ よむ くりかえしの した）に、「(なんぶんめ) を (1) ずつ かえる」を いれよう。',
    [`${C}lm-l2-learn.step4`]:
        'Ruby で よむと、こう なります。「until」の なかに「until」が はいっています。そとの くりかえしが ぶんを 1 つずつ、なかの くりかえしが もじを 1 つずつ すすめます。',
    [`${C}lm-l2-learn.step5`]:
        'はたを おしてから、ロボットを なんかいか おそう。きょうかしょの ぜんぶの ぶんを がくしゅうしたので、いろいろな ぶんを つくります。',
    [`${C}lm-l2-learn.debug1`]:
        '「(なんぶんめ) を (1) ずつ かえる」が そとの くりかえしの なかに あるか みよう。ないと、ずっと 1 ぶんめを がくしゅうしつづけます。',
    [`${C}lm-l2-learn.debug2`]:
        '「(まえのもじ) を () にする」と「(なんもじめ) を (1) にする」が そとの くりかえしの なかに あるか みよう。そとに あると、2 ぶんめからが ただしく よめません。',
    [`${C}lm-l2-learn.quiz.question`]:
        'きょうかしょの ぜんぶの ぶんを がくしゅうした とき、「まえ」の ぎょうの かずは、どれと おなじ？',
    [`${C}lm-l2-learn.quiz.choice1`]: 'きょうかしょの ぶんの かず',
    [`${C}lm-l2-learn.quiz.choice2`]: 'きょうかしょの ぜんぶの ぶんの もじの かずを あわせた かず',
    [`${C}lm-l2-learn.quiz.choice3`]: '「まえ」に はいっている、ちがう もじの かず',
    [`${C}lm-l2-learn.quiz.explanation`]:
        '1 もじごとに 1 くみ たすので、ぜんぶの ぶんの もじの かずを あわせた かずに なります。AI は かずを かぞえずに、でてきた かいすうだけ くみを おぼえています。',
};

export const en = {
    'gui.lessons.course.kotoba-yosou-ai.name': 'Make an AI That Predicts Words',
    'gui.lessons.course.kotoba-yosou-ai.description':
        'Build a small AI with lists and random numbers that predicts the next letter from the letter before it, and see how generative AI picks the next word from the data it learned.',
    'gui.lessons.lesson.lm-l1.name': 'Talk with the AI',

    [`${C}lm-l1-make.name`]: 'Let the AI make a sentence',
    [`${C}lm-l1-make.task`]:
        'Let the AI make a sentence.\nWhen you click the robot, make the AI make one sentence and say it.\n(When you click the green flag, the AI learns the sentences in the textbook.)',
    [`${C}lm-l1-make.step1`]:
        'This program already has the 4 blocks of the AI (learn, collect_candidates, pick_letter, make_sentence) in My Blocks. First, put "when this sprite clicked" from Events.',
    [`${C}lm-l1-make.step2`]: 'Under "when this sprite clicked", attach "make_sentence" from My Blocks.',
    [`${C}lm-l1-make.step3`]:
        'Under "make_sentence", attach "say (Hello!)" from Looks, and put the variable "sentence" in place of "Hello!".',
    [`${C}lm-l1-make.step4`]:
        'This is how it reads in Ruby. "when_clicked do" to "end" is the script of "when this sprite clicked". You call the block "make_sentence" just by writing its name. The names of the variables start with "@".',
    [`${C}lm-l1-make.step5`]:
        'Click the green flag so that the AI learns the textbook, and then click the robot on the stage. The AI makes a sentence and says it.',
    [`${C}lm-l1-make.debug1`]:
        'Check that you clicked the green flag first. Before it learns, the AI knows nothing and cannot make a sentence.',

    [`${C}lm-l1-teach.name`]: 'Add a sentence to the textbook',
    [`${C}lm-l1-teach.task`]:
        'Teach the AI a new sentence.\nWhen you press the "a" key, enter a sentence to teach, add it to the textbook and learn again.\nClick the robot to see if the AI uses the words of the sentence you added.',
    [`${C}lm-l1-teach.step1`]: 'Put "when (a) key pressed" from Events.',
    [`${C}lm-l1-teach.step2`]: 'Under it, attach "ask (Enter a sentence to teach) and wait" from Sensing.',
    [`${C}lm-l1-teach.step3`]:
        'Attach "add (thing) to (textbook)" from Variables, and put "answer" from Sensing in place of "thing" (choose "textbook" with ▼). The sentence you enter goes to the end of the textbook.',
    [`${C}lm-l1-teach.step4`]:
        'At the end, attach "learn" from My Blocks. When the textbook changes, the AI does not know the new sentence until it learns again.',
    [`${C}lm-l1-teach.step5`]:
        'This is how it reads in Ruby. "answer" is answer, and adding to the list is "@textbook.push(answer)".',
    [`${C}lm-l1-teach.step6`]:
        'Click the green flag, press the "a" key and enter a sentence that ends with "." (for example "The robot likes to talk."). Then click the robot a few times.',
    [`${C}lm-l1-teach.debug1`]:
        'Check that "learn" comes after "add". If it comes before, the AI does not learn the sentence you added.',

    [`${C}lm-l1-look.name`]: 'Count the letters after "v"',
    [`${C}lm-l1-look.task`]:
        'See what the AI learned.\n"before" and "after" on the stage are pairs in the same row: "this letter came after that letter".\nWhen you press the "c" key, collect the letters that came after "v" into "candidates" and show them.',
    [`${C}lm-l1-look.step1`]:
        'Click the green flag and look at "before" and "after" on the stage. A row with an empty "before" is the first letter of a sentence. There are many rows and it is hard to find the rows of "v", so let "collect_candidates" collect them. First, put "when (c) key pressed".',
    [`${C}lm-l1-look.step2`]:
        'Under it, attach "set (sentence) to (v)" from Variables (choose "sentence" with ▼). "collect_candidates" collects the letters that came after the last letter of "sentence".',
    [`${C}lm-l1-look.step3`]:
        'Attach "collect_candidates" from My Blocks and "show list (candidates)" from Variables.',
    [`${C}lm-l1-look.step4`]:
        'This is how it reads in Ruby. Putting "v" into "sentence" is "@sentence = "v"", and showing the list is "show_list("@candidates")".',
    [`${C}lm-l1-look.step5`]:
        'Click the green flag and press the "c" key. Count the letters in "candidates" on the stage.',
    [`${C}lm-l1-look.debug1`]:
        'Check that you clicked the green flag first. Before it learns, "before" and "after" are empty, so "candidates" is empty too.',
    [`${C}lm-l1-look.quiz.question`]: 'Which letters are in "candidates"?',
    [`${C}lm-l1-look.quiz.choice1`]: '"e" once and "o" once',
    [`${C}lm-l1-look.quiz.choice2`]: '"e" twice and "o" twice',
    [`${C}lm-l1-look.quiz.choice3`]: '"e", "r" and "y" once each',
    [`${C}lm-l1-look.quiz.explanation`]:
        'In the textbook, "v" is followed by "e" 2 times ("evening", "have") and by "o" 2 times ("favorite" twice). The AI does not count. It puts a pair into "before" and "after" each time the pair appears.',

    [`${C}lm-l1-random.name`]: 'Make many sentences',
    [`${C}lm-l1-random.task`]:
        'When you click the robot once, make the AI make a sentence 5 times and say each one for 2 seconds.\nIs the sentence different each time?',
    [`${C}lm-l1-random.step1`]:
        'Take off the 2 blocks under "when this sprite clicked", and attach "repeat (5)" from Control.',
    [`${C}lm-l1-random.step2`]:
        'Put "make_sentence" and "say (Hello!) for (2) seconds" from Looks inside "repeat (5)", and put "sentence" in place of "Hello!". You can delete the "say (sentence)" you took off.',
    [`${C}lm-l1-random.step3`]: 'This is how it reads in Ruby. "5.times do" to "end" repeats 5 times.',
    [`${C}lm-l1-random.step4`]: 'Click the green flag, and then click the robot. Were the 5 sentences different?',
    [`${C}lm-l1-random.debug1`]:
        'Check that "make_sentence" is inside the repeat. If it is outside, the AI says the same sentence 5 times.',
    [`${C}lm-l1-random.quiz.question`]: 'Why is the sentence different each time with the same program?',
    [`${C}lm-l1-random.quiz.choice1`]: 'Because the textbook changes each time you click',
    [`${C}lm-l1-random.quiz.choice2`]: 'Because the AI learns again each time you click',
    [`${C}lm-l1-random.quiz.choice3`]: 'Because it picks the next letter from "candidates" with a random number',
    [`${C}lm-l1-random.quiz.explanation`]:
        '"pick_letter" picks one of the candidates with a random number. A letter that is in the candidates many times is picked more often, so the sentence tends to look natural.',

    'gui.lessons.lesson.lm-l2.name': 'Split words into letters',

    [`${C}lm-l2-letters.name`]: 'Say it letter by letter',
    [`${C}lm-l2-letters.task`]:
        'The AI handles a sentence one letter at a time.\nWhen you click the robot, make the AI make a sentence and say it one letter at a time for 0.5 seconds each.',
    [`${C}lm-l2-letters.step1`]:
        'In the script of "when this sprite clicked", take out "say (sentence)" and delete it. Under "make_sentence", attach "set (letter_no) to (1)" from Variables (choose "letter_no" with ▼). "letter_no" is the number of the letter to say now.',
    [`${C}lm-l2-letters.step2`]:
        'Under it, attach "repeat until ( )" from Control, and put "( ) > ( )" from Operators in the hole. Put "letter_no" on the left and "length of (apple)" from Operators on the right, and put "sentence" in place of "apple". It stops when letter_no is larger than the length of the sentence.',
    [`${C}lm-l2-letters.step3`]:
        'In the loop, put "say (Hello!) for (0.5) seconds" from Looks and "change (letter_no) by (1)" from Variables. Put "letter (1) of (apple)" from Operators in place of "Hello!", and put "letter_no" in place of "1" and "sentence" in place of "apple".',
    [`${C}lm-l2-letters.step4`]:
        'This is how it reads in Ruby. Ruby counts the letters from 0, so the block "letter (letter_no) of (sentence)" is "@sentence[@letter_no - 1]". "length of" is ".length" and "repeat until" is "until".',
    [`${C}lm-l2-letters.step5`]:
        'Click the green flag, and then click the robot. The AI says the sentence it made one letter at a time. A space and "." are letters too.',
    [`${C}lm-l2-letters.debug1`]:
        'Check that "change (letter_no) by (1)" is in the loop. Without it, the AI keeps saying the first letter.',
    [`${C}lm-l2-letters.debug2`]:
        'Check that "set (letter_no) to (1)" is before the loop. Without it, the second click counts on from where it stopped.',
    [`${C}lm-l2-letters.quiz.question`]: 'When "sentence" is "Hello.", what is "letter (3) of (sentence)"?',
    [`${C}lm-l2-letters.quiz.choice1`]: '"e"',
    [`${C}lm-l2-letters.quiz.choice2`]: '"l"',
    [`${C}lm-l2-letters.quiz.choice3`]: '"o"',
    [`${C}lm-l2-letters.quiz.explanation`]:
        'Letter 1 is "H", letter 2 is "e" and letter 3 is "l". Blocks count from 1 (Ruby counts from 0, so it is "@sentence[2]").',

    [`${C}lm-l2-pairs.name`]: 'Make the pairs of one sentence',
    [`${C}lm-l2-pairs.task`]:
        'Make the inside of "learn" again.\nNow "learn" only reads the first sentence of the textbook one letter at a time. While it reads, make it add the pair of "prev_letter" and the letter now to "before" and "after".',
    [`${C}lm-l2-pairs.step1`]:
        'In the "repeat until ( )" in the definition of "learn", put "add (thing) to (before)" from Variables (above "change (letter_no) by (1)". Choose "before" with ▼). Put "prev_letter" in place of "thing".',
    [`${C}lm-l2-pairs.step2`]:
        'Under it, attach "add (thing) to (after)", and put "letter (letter_no) of (sentence)" from Operators (the letter now) in place of "thing". The same row of "before" and "after" is one pair.',
    [`${C}lm-l2-pairs.step3`]:
        'Under it, attach "set (prev_letter) to ( )" and put "letter (letter_no) of (sentence)" in it. For the next letter, the letter now is the "prev_letter".',
    [`${C}lm-l2-pairs.step4`]:
        'This is how it reads in Ruby. Adding to a list is "@before.push(@prev_letter)", and the letter now is "@sentence[@letter_no - 1]".',
    [`${C}lm-l2-pairs.step5`]:
        'Click the green flag and look at "before" and "after" on the stage. "before" of the first row is empty, and "after" is the first letter of the sentence. When you click the robot, the AI knows only this sentence, so it says almost the same sentence.',
    [`${C}lm-l2-pairs.debug1`]:
        'Check that "set (prev_letter) to ( )" is under the 2 "add" blocks. If it is above them, "before" also gets the letter now.',
    [`${C}lm-l2-pairs.debug2`]:
        'Check that the 3 blocks are in the loop that reads one letter at a time, in the definition of "learn".',
    [`${C}lm-l2-pairs.quiz.question`]:
        'When the AI learns only the sentence "Good.", how many pairs go into "before" and "after"?',
    [`${C}lm-l2-pairs.quiz.choice1`]: '4 pairs',
    [`${C}lm-l2-pairs.quiz.choice2`]: '5 pairs',
    [`${C}lm-l2-pairs.quiz.choice3`]: '6 pairs',
    [`${C}lm-l2-pairs.quiz.explanation`]:
        '(empty → G) (G → o) (o → o) (o → d) (d → .) are the 5 pairs. There are as many pairs as letters in the sentence. "before" of the first pair is empty, so the AI can start a sentence even when nobody says anything.',

    [`${C}lm-l2-learn.name`]: 'Learn the whole textbook',
    [`${C}lm-l2-learn.task`]:
        'Now "learn" learns only the first sentence of the textbook.\nRepeat while changing "sentence_no" from 1 to the length of the textbook, so that it learns all the sentences of the textbook.',
    [`${C}lm-l2-learn.step1`]:
        'In the definition of "learn", put "repeat until ( )" from Control under "set (sentence_no) to (1)". Put "( ) > ( )" from Operators in the hole, with "sentence_no" on the left and "length of (textbook)" from Variables on the right.',
    [`${C}lm-l2-learn.step2`]:
        'Drag the blocks from "set (sentence) to (item (sentence_no) of (textbook))" to the end of the loop that reads one letter at a time, and put them in the new loop.',
    [`${C}lm-l2-learn.step3`]:
        'At the end of the new loop (under the loop that reads one letter at a time), put "change (sentence_no) by (1)".',
    [`${C}lm-l2-learn.step4`]:
        'This is how it reads in Ruby. There is an "until" in an "until". The outer loop moves one sentence at a time, and the inner loop moves one letter at a time.',
    [`${C}lm-l2-learn.step5`]:
        'Click the green flag, and then click the robot a few times. The AI learned all the sentences of the textbook, so it makes many kinds of sentences.',
    [`${C}lm-l2-learn.debug1`]:
        'Check that "change (sentence_no) by (1)" is in the outer loop. Without it, the AI keeps learning the first sentence.',
    [`${C}lm-l2-learn.debug2`]:
        'Check that "set (prev_letter) to ()" and "set (letter_no) to (1)" are in the outer loop. If they are outside, the sentences from the second one are not read right.',
    [`${C}lm-l2-learn.quiz.question`]:
        'When the AI has learned all the sentences of the textbook, the number of rows of "before" is the same as which?',
    [`${C}lm-l2-learn.quiz.choice1`]: 'The number of the sentences in the textbook',
    [`${C}lm-l2-learn.quiz.choice2`]: 'The number of all the letters of all the sentences in the textbook',
    [`${C}lm-l2-learn.quiz.choice3`]: 'The number of different letters in "before"',
    [`${C}lm-l2-learn.quiz.explanation`]:
        'It adds one pair for each letter, so it is the number of all the letters of all the sentences. The AI does not count. It remembers the pairs as many times as they appear.',
};
