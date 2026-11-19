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
};
