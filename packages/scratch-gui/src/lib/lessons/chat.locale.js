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
};
