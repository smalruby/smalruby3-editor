import {loadPrism} from '../../../src/lib/prism-parser';
import FuriganaAnnotator from '../../../src/lib/furigana-annotator';

describe('FuriganaAnnotator', () => {
    let prism;
    let annotator;

    beforeAll(async () => {
        prism = await loadPrism();
        annotator = new FuriganaAnnotator();
    });

    const parse = code => prism.parse(code);
    const annotate = code => annotator.annotate(code, parse(code));
    const labelsAt = (annotations, line) => (annotations.get(line) || []).map(a => a.label);

    describe('empty / invalid input', () => {
        test('empty code returns empty map', () => {
            expect(annotate('').size).toBe(0);
        });
        test('null parseResult returns empty map', () => {
            expect(annotator.annotate('x = 1', null).size).toBe(0);
        });
    });

    describe('variable assignment: answer = 10', () => {
        let annotations;
        beforeAll(() => {
            annotations = annotate('answer = 10');
        });

        test('line 1 has 変数answer, 紐付ける, 数値10 in order', () => {
            expect(labelsAt(annotations, 1)).toEqual(['変数answer', '紐付ける', '数値10']);
        });
        test('answer starts at column 0', () => {
            expect(annotations.get(1)[0].startColumn).toBe(0);
        });
        test('= starts at column 7', () => {
            expect(annotations.get(1)[1].startColumn).toBe(7);
        });
        test('10 starts at column 9', () => {
            expect(annotations.get(1)[2].startColumn).toBe(9);
        });
    });

    describe('numeric literals', () => {
        test('integer literal annotates as 数値N', () => {
            const anns = annotate('x = 42');
            expect(labelsAt(anns, 1)).toContain('数値42');
        });
        test('float literal annotates as 数値N', () => {
            const anns = annotate('x = 0.7');
            expect(labelsAt(anns, 1)).toContain('数値0.7');
        });
    });

    describe('string literals', () => {
        test('string literal annotates as 文字列「...」', () => {
            const anns = annotate('puts "hello"');
            const labels = labelsAt(anns, 1);
            expect(labels.some(l => l === '文字列「hello」')).toBe(true);
        });
    });

    describe('method calls', () => {
        test('puts annotates as 表示する', () => {
            expect(labelsAt(annotate('puts "text"'), 1)).toContain('表示する');
        });
        test('print annotates as 表示する', () => {
            expect(labelsAt(annotate('print "text"'), 1)).toContain('表示する');
        });
        test('gets annotates as 入力する', () => {
            expect(labelsAt(annotate('age = gets.to_i'), 1)).toContain('入力する');
        });
        test('to_i annotates as 整数化', () => {
            expect(labelsAt(annotate('age = gets.to_i'), 1)).toContain('整数化');
        });
        test('to_s annotates as 文字列化', () => {
            const anns = annotate('x = 42\ns = x.to_s');
            expect(labelsAt(anns, 2)).toContain('文字列化');
        });
    });

    describe('arithmetic operators', () => {
        test('+ (numeric) annotates as 足す', () => {
            const anns = annotate('x = 1\ny = 2\na = x + y');
            expect(labelsAt(anns, 3)).toContain('足す');
        });
        test('+ (string) annotates as 連結', () => {
            expect(labelsAt(annotate('"hello" + " world"'), 1)).toContain('連結');
        });
        test('- annotates as 引く', () => {
            const anns = annotate('x = 1\na = x - 1');
            expect(labelsAt(anns, 2)).toContain('引く');
        });
        test('* annotates as 掛ける', () => {
            const anns = annotate('x = 2\na = x * 3');
            expect(labelsAt(anns, 2)).toContain('掛ける');
        });
        test('/ annotates as 割る', () => {
            const anns = annotate('x = 6\na = x / 2');
            expect(labelsAt(anns, 2)).toContain('割る');
        });
        test('% annotates as 余り', () => {
            const anns = annotate('x = 7\na = x % 3');
            expect(labelsAt(anns, 2)).toContain('余り');
        });
    });

    describe('comparison operators', () => {
        test('<= annotates as 以下', () => {
            const anns = annotate('x = 5\nif x <= 10\nend');
            expect(labelsAt(anns, 2)).toContain('以下');
        });
        test('>= annotates as 以上', () => {
            const anns = annotate('x = 65\nif x >= 65\nend');
            expect(labelsAt(anns, 2)).toContain('以上');
        });
        test('< annotates as 小さい', () => {
            const anns = annotate('x = 3\nif x < 5\nend');
            expect(labelsAt(anns, 2)).toContain('小さい');
        });
        test('> annotates as 大きい', () => {
            const anns = annotate('x = 3\nif x > 5\nend');
            expect(labelsAt(anns, 2)).toContain('大きい');
        });
        test('== annotates as 等しい', () => {
            const anns = annotate('x = 3\nif x == 3\nend');
            expect(labelsAt(anns, 2)).toContain('等しい');
        });
        test('!= annotates as 等しくない', () => {
            const anns = annotate('x = 3\nif x != 3\nend');
            expect(labelsAt(anns, 2)).toContain('等しくない');
        });
    });

    describe('logical operators', () => {
        test('&& annotates as かつ', () => {
            const anns = annotate('x = 5\ny = 3\nif x > 0 && y > 0\nend');
            expect(labelsAt(anns, 3)).toContain('かつ');
        });
        test('|| annotates as または', () => {
            const anns = annotate('x = 5\ny = 65\nif x <= 5 || y >= 65\nend');
            expect(labelsAt(anns, 3)).toContain('または');
        });
    });

    describe('control flow: if / elsif / else / end', () => {
        test('if keyword annotates as もし', () => {
            const anns = annotate('x = 5\nif x <= 5\n  puts "ok"\nend');
            expect(labelsAt(anns, 2)).toContain('もし');
        });
        test('end of if annotates as 分岐終了', () => {
            const anns = annotate('x = 5\nif x <= 5\n  puts "ok"\nend');
            expect(labelsAt(anns, 4)).toContain('分岐終了');
        });
        test('else annotates as でなければ', () => {
            const anns = annotate('x = 5\nif x <= 5\n  puts "small"\nelse\n  puts "big"\nend');
            expect(labelsAt(anns, 4)).toContain('でなければ');
        });
        test('elsif annotates as ではなく', () => {
            const anns = annotate('x = 5\nif x <= 5\n  puts "small"\nelsif x >= 65\n  puts "big"\nend');
            expect(labelsAt(anns, 4)).toContain('ではなく');
        });
    });

    describe('control flow: while / end', () => {
        test('while keyword annotates as 真である限り繰り返す', () => {
            const anns = annotate('n = 3\nwhile n > 0\n  n = n - 1\nend');
            expect(labelsAt(anns, 2)).toContain('真である限り繰り返す');
        });
        test('end of while annotates as 繰り返し終了', () => {
            const anns = annotate('n = 3\nwhile n > 0\n  n = n - 1\nend');
            expect(labelsAt(anns, 4)).toContain('繰り返し終了');
        });
    });

    describe('def / end', () => {
        test('def keyword annotates as メソッド作成', () => {
            const anns = annotate('def greet\n  puts "hi"\nend');
            expect(labelsAt(anns, 1)).toContain('メソッド作成');
        });
        test('method name annotates as Nという名前', () => {
            const anns = annotate('def greet\n  puts "hi"\nend');
            expect(labelsAt(anns, 1)).toContain('greetという名前');
        });
        test('end of def annotates as 作成終了', () => {
            const anns = annotate('def greet\n  puts "hi"\nend');
            expect(labelsAt(anns, 3)).toContain('作成終了');
        });
        test('required parameter annotates as 引数N', () => {
            const anns = annotate('def add(a, b)\n  a + b\nend');
            expect(labelsAt(anns, 1)).toContain('引数a');
            expect(labelsAt(anns, 1)).toContain('引数b');
        });
    });

    describe('return', () => {
        test('return annotates as 呼び出し元に返す', () => {
            const anns = annotate('def double(x)\n  return x * 2\nend');
            expect(labelsAt(anns, 2)).toContain('呼び出し元に返す');
        });
    });

    describe('class definition', () => {
        test('class keyword annotates as クラス作成', () => {
            const anns = annotate('class Dog\nend');
            expect(labelsAt(anns, 1)).toContain('クラス作成');
        });
        test('end of class annotates as 作成終了', () => {
            const anns = annotate('class Dog\nend');
            expect(labelsAt(anns, 2)).toContain('作成終了');
        });
    });

    describe('case / when / end', () => {
        test('case keyword annotates as 状態分岐', () => {
            const anns = annotate('x = 1\ncase x\nwhen 1\n  puts "one"\nend');
            expect(labelsAt(anns, 2)).toContain('状態分岐');
        });
        test('when keyword annotates as のとき', () => {
            const anns = annotate('x = 1\ncase x\nwhen 1\n  puts "one"\nend');
            expect(labelsAt(anns, 3)).toContain('のとき');
        });
        test('end of case annotates as 分岐終了', () => {
            const anns = annotate('x = 1\ncase x\nwhen 1\n  puts "one"\nend');
            expect(labelsAt(anns, 5)).toContain('分岐終了');
        });
    });

    describe('global variables', () => {
        test('$x = ... annotates as グローバル変数x and 紐付ける', () => {
            const anns = annotate('$score = 0');
            expect(labelsAt(anns, 1)).toContain('グローバル変数score');
            expect(labelsAt(anns, 1)).toContain('紐付ける');
        });
        test('$x read annotates as グローバル変数x', () => {
            const anns = annotate('$score = 0\nputs $score');
            expect(labelsAt(anns, 2)).toContain('グローバル変数score');
        });
    });

    describe('instance variables', () => {
        test('@x = ... annotates as インスタンス変数x and 紐付ける', () => {
            const anns = annotate('@name = "Alice"');
            expect(labelsAt(anns, 1)).toContain('インスタンス変数name');
            expect(labelsAt(anns, 1)).toContain('紐付ける');
        });
        test('@x read annotates as インスタンス変数x', () => {
            const anns = annotate('@name = "Alice"\nputs @name');
            expect(labelsAt(anns, 2)).toContain('インスタンス変数name');
        });
    });

    describe('boolean literals', () => {
        test('true annotates as 真', () => {
            const anns = annotate('x = true');
            expect(labelsAt(anns, 1)).toContain('真');
        });
        test('false annotates as 偽', () => {
            const anns = annotate('x = false');
            expect(labelsAt(anns, 1)).toContain('偽');
        });
    });

    describe('operator assignment', () => {
        test('+= (numeric) annotates as ずつ増やす', () => {
            const anns = annotate('x = 1\nx += 1');
            expect(labelsAt(anns, 2)).toContain('ずつ増やす');
        });
        test('+= (string) annotates as と連結', () => {
            const anns = annotate('x = "hello"\nx += " world"');
            expect(labelsAt(anns, 2)).toContain('と連結');
        });
        test('-= annotates as ずつ減らす', () => {
            const anns = annotate('x = 5\nx -= 1');
            expect(labelsAt(anns, 2)).toContain('ずつ減らす');
        });
        test('*= annotates as 倍にする', () => {
            const anns = annotate('x = 2\nx *= 3');
            expect(labelsAt(anns, 2)).toContain('倍にする');
        });
        test('/= annotates as 分の1にする', () => {
            const anns = annotate('x = 6\nx /= 2');
            expect(labelsAt(anns, 2)).toContain('分の1にする');
        });
        test('%= annotates as 余りにする', () => {
            const anns = annotate('x = 7\nx %= 3');
            expect(labelsAt(anns, 2)).toContain('余りにする');
        });
        test('**= annotates as べき乗にする', () => {
            const anns = annotate('x = 2\nx **= 3');
            expect(labelsAt(anns, 2)).toContain('べき乗にする');
        });
    });

    describe('exponentiation and unary operators', () => {
        test('** annotates as べき乗', () => {
            const anns = annotate('x = 2\na = x ** 3');
            expect(labelsAt(anns, 2)).toContain('べき乗');
        });
    });

    describe('to_f conversion', () => {
        test('.to_f annotates as 浮動小数点数化', () => {
            const anns = annotate('x = "3"\ny = x.to_f');
            expect(labelsAt(anns, 2)).toContain('浮動小数点数化');
        });
    });

    describe('wait method', () => {
        test('wait annotates as 待つ', () => {
            const anns = annotate('wait(1)');
            expect(labelsAt(anns, 1)).toContain('待つ');
        });
    });

    describe('until loop', () => {
        test('until keyword annotates as まで繰り返す', () => {
            const anns = annotate('n = 0\nuntil n >= 3\n  n += 1\nend');
            expect(labelsAt(anns, 2)).toContain('まで繰り返す');
        });
        test('end of until annotates as 繰り返し終了', () => {
            const anns = annotate('n = 0\nuntil n >= 3\n  n += 1\nend');
            expect(labelsAt(anns, 4)).toContain('繰り返し終了');
        });
    });

    // ---- Phase 1: smalruby methods (no-receiver) ----

    describe('Motion methods', () => {
        test('move annotates as 動かす', () => {
            expect(labelsAt(annotate('move(10)'), 1)).toContain('動かす');
        });
        test('turn_right annotates as 右に回す', () => {
            expect(labelsAt(annotate('turn_right(15)'), 1)).toContain('右に回す');
        });
        test('turn_left annotates as 左に回す', () => {
            expect(labelsAt(annotate('turn_left(15)'), 1)).toContain('左に回す');
        });
        test('go_to annotates as 移動する', () => {
            expect(labelsAt(annotate('go_to("_mouse_")'), 1)).toContain('移動する');
        });
        test('point_towards annotates as 向く', () => {
            expect(labelsAt(annotate('point_towards("_mouse_")'), 1)).toContain('向く');
        });
        test('bounce_if_on_edge annotates as 端で跳ね返る', () => {
            expect(labelsAt(annotate('bounce_if_on_edge'), 1)).toContain('端で跳ね返る');
        });
    });

    describe('Motion property getters (no-receiver, no-arg method calls)', () => {
        test('x getter annotates as X座標', () => {
            expect(labelsAt(annotate('move(x)'), 1)).toContain('X座標');
        });
        test('y getter annotates as Y座標', () => {
            expect(labelsAt(annotate('move(y)'), 1)).toContain('Y座標');
        });
        test('direction getter annotates as 向き', () => {
            expect(labelsAt(annotate('say(direction)'), 1)).toContain('向き');
        });
    });

    describe('Looks methods', () => {
        test('say annotates as 言う', () => {
            expect(labelsAt(annotate('say("hello")'), 1)).toContain('言う');
        });
        test('think annotates as 考える', () => {
            expect(labelsAt(annotate('think("hmm")'), 1)).toContain('考える');
        });
        test('switch_costume annotates as コスチュームにする', () => {
            expect(labelsAt(annotate('switch_costume("costume2")'), 1)).toContain('コスチュームにする');
        });
        test('next_costume annotates as 次のコスチュームにする', () => {
            expect(labelsAt(annotate('next_costume'), 1)).toContain('次のコスチュームにする');
        });
        test('switch_backdrop annotates as 背景にする', () => {
            expect(labelsAt(annotate('switch_backdrop("backdrop2")'), 1)).toContain('背景にする');
        });
        test('switch_backdrop_and_wait annotates as 背景にして待つ', () => {
            expect(labelsAt(annotate('switch_backdrop_and_wait("backdrop2")'), 1)).toContain('背景にして待つ');
        });
        test('next_backdrop annotates as 次の背景にする', () => {
            expect(labelsAt(annotate('next_backdrop'), 1)).toContain('次の背景にする');
        });
        test('set_effect annotates as 画像効果を設定', () => {
            expect(labelsAt(annotate('set_effect("color", 25)'), 1)).toContain('画像効果を設定');
        });
        test('change_effect_by annotates as 画像効果を変える', () => {
            expect(labelsAt(annotate('change_effect_by("color", 10)'), 1)).toContain('画像効果を変える');
        });
        test('clear_graphic_effects annotates as 画像効果をなくす', () => {
            expect(labelsAt(annotate('clear_graphic_effects'), 1)).toContain('画像効果をなくす');
        });
        test('show annotates as 表示する', () => {
            expect(labelsAt(annotate('show'), 1)).toContain('表示する');
        });
        test('hide annotates as 隠す', () => {
            expect(labelsAt(annotate('hide'), 1)).toContain('隠す');
        });
    });

    describe('Looks property getters', () => {
        test('costume_number annotates as コスチューム番号', () => {
            expect(labelsAt(annotate('costume_number'), 1)).toContain('コスチューム番号');
        });
        test('costume_name annotates as コスチューム名', () => {
            expect(labelsAt(annotate('costume_name'), 1)).toContain('コスチューム名');
        });
        test('backdrop_number annotates as 背景番号', () => {
            expect(labelsAt(annotate('backdrop_number'), 1)).toContain('背景番号');
        });
        test('backdrop_name annotates as 背景名', () => {
            expect(labelsAt(annotate('backdrop_name'), 1)).toContain('背景名');
        });
        test('size getter annotates as 大きさ', () => {
            expect(labelsAt(annotate('say(size)'), 1)).toContain('大きさ');
        });
    });

    describe('Sound methods', () => {
        test('play annotates as 音を鳴らす', () => {
            expect(labelsAt(annotate('play("ニャー")'), 1)).toContain('音を鳴らす');
        });
        test('play_until_done annotates as 音が終わるまで鳴らす', () => {
            expect(labelsAt(annotate('play_until_done("ニャー")'), 1)).toContain('音が終わるまで鳴らす');
        });
        test('stop_all_sounds annotates as 音をすべて止める', () => {
            expect(labelsAt(annotate('stop_all_sounds'), 1)).toContain('音をすべて止める');
        });
        test('change_sound_effect_by annotates as 音の効果を変える', () => {
            expect(labelsAt(annotate('change_sound_effect_by("PITCH", 10)'), 1)).toContain('音の効果を変える');
        });
        test('set_sound_effect annotates as 音の効果を設定', () => {
            expect(labelsAt(annotate('set_sound_effect("PITCH", 100)'), 1)).toContain('音の効果を設定');
        });
        test('clear_sound_effects annotates as 音の効果をなくす', () => {
            expect(labelsAt(annotate('clear_sound_effects'), 1)).toContain('音の効果をなくす');
        });
        test('volume getter annotates as 音量', () => {
            expect(labelsAt(annotate('volume'), 1)).toContain('音量');
        });
    });

    describe('Events methods', () => {
        test('when_flag_clicked annotates as 旗が押されたとき', () => {
            const anns = annotate('when_flag_clicked do\nend');
            expect(labelsAt(anns, 1)).toContain('旗が押されたとき');
        });
        test('when_key_pressed annotates as キーが押されたとき', () => {
            const anns = annotate('when_key_pressed("space") do\nend');
            expect(labelsAt(anns, 1)).toContain('キーが押されたとき');
        });
        test('when_clicked annotates as クリックされたとき', () => {
            const anns = annotate('when_clicked do\nend');
            expect(labelsAt(anns, 1)).toContain('クリックされたとき');
        });
        test('when_backdrop_switches annotates as 背景が切り替わったとき', () => {
            const anns = annotate('when_backdrop_switches("backdrop2") do\nend');
            expect(labelsAt(anns, 1)).toContain('背景が切り替わったとき');
        });
        test('when_receive annotates as 受け取ったとき', () => {
            const anns = annotate('when_receive("start") do\nend');
            expect(labelsAt(anns, 1)).toContain('受け取ったとき');
        });
        test('broadcast annotates as 送る', () => {
            expect(labelsAt(annotate('broadcast("start")'), 1)).toContain('送る');
        });
        test('broadcast_and_wait annotates as 送って待つ', () => {
            expect(labelsAt(annotate('broadcast_and_wait("start")'), 1)).toContain('送って待つ');
        });
    });

    describe('Control methods', () => {
        test('sleep annotates as 秒待つ', () => {
            expect(labelsAt(annotate('sleep(1)'), 1)).toContain('秒待つ');
        });
        test('loop annotates as ずっと繰り返す', () => {
            const anns = annotate('loop do\nend');
            expect(labelsAt(anns, 1)).toContain('ずっと繰り返す');
        });
        test('stop annotates as 止める', () => {
            expect(labelsAt(annotate('stop("all")'), 1)).toContain('止める');
        });
        test('create_clone annotates as クローンを作る', () => {
            expect(labelsAt(annotate('create_clone("_myself_")'), 1)).toContain('クローンを作る');
        });
        test('delete_this_clone annotates as このクローンを削除', () => {
            expect(labelsAt(annotate('delete_this_clone'), 1)).toContain('このクローンを削除');
        });
        test('when_start_as_a_clone annotates as クローンされたとき', () => {
            const anns = annotate('when_start_as_a_clone do\nend');
            expect(labelsAt(anns, 1)).toContain('クローンされたとき');
        });
    });

    describe('Sensing methods', () => {
        test('touching? annotates as 触れているか', () => {
            expect(labelsAt(annotate('touching?("_edge_")'), 1)).toContain('触れているか');
        });
        test('touching_color? annotates as 色に触れているか', () => {
            expect(labelsAt(annotate('touching_color?("#ff0000")'), 1)).toContain('色に触れているか');
        });
        test('color_is_touching_color? annotates as 色が色に触れているか', () => {
            expect(labelsAt(annotate('color_is_touching_color?("#ff0000", "#00ff00")'), 1))
                .toContain('色が色に触れているか');
        });
        test('distance annotates as 距離', () => {
            expect(labelsAt(annotate('distance("_mouse_")'), 1)).toContain('距離');
        });
        test('ask annotates as 質問する', () => {
            expect(labelsAt(annotate('ask("名前は?")'), 1)).toContain('質問する');
        });
        test('answer annotates as 答え', () => {
            expect(labelsAt(annotate('answer'), 1)).toContain('答え');
        });
        test('loudness annotates as マイクの音量', () => {
            expect(labelsAt(annotate('loudness'), 1)).toContain('マイクの音量');
        });
        test('days_since_2000 annotates as 2000年からの日数', () => {
            expect(labelsAt(annotate('days_since_2000'), 1)).toContain('2000年からの日数');
        });
        test('user_name annotates as ユーザー名', () => {
            expect(labelsAt(annotate('user_name'), 1)).toContain('ユーザー名');
        });
    });

    describe('Data methods', () => {
        test('show_variable annotates as 変数を表示', () => {
            expect(labelsAt(annotate('show_variable("@score")'), 1)).toContain('変数を表示');
        });
        test('hide_variable annotates as 変数を隠す', () => {
            expect(labelsAt(annotate('hide_variable("@score")'), 1)).toContain('変数を隠す');
        });
        test('show_list annotates as リストを表示', () => {
            expect(labelsAt(annotate('show_list("@items")'), 1)).toContain('リストを表示');
        });
        test('hide_list annotates as リストを隠す', () => {
            expect(labelsAt(annotate('hide_list("@items")'), 1)).toContain('リストを隠す');
        });
    });

    describe('Music methods', () => {
        test('play_drum annotates as ドラムを鳴らす', () => {
            expect(labelsAt(annotate('play_drum(drum: 1, beats: 0.25)'), 1)).toContain('ドラムを鳴らす');
        });
        test('play_note annotates as 音符を鳴らす', () => {
            expect(labelsAt(annotate('play_note(note: 60, beats: 0.25)'), 1)).toContain('音符を鳴らす');
        });
        test('tempo getter annotates as テンポ', () => {
            expect(labelsAt(annotate('tempo'), 1)).toContain('テンポ');
        });
    });

    // ---- Phase 2: receiver-based methods ----

    describe('self attribute setters (self.x = n)', () => {
        test('self.x = n annotates as X座標を設定', () => {
            expect(labelsAt(annotate('self.x = 100'), 1)).toContain('X座標を設定');
        });
        test('self.y = n annotates as Y座標を設定', () => {
            expect(labelsAt(annotate('self.y = 50'), 1)).toContain('Y座標を設定');
        });
        test('self.direction = n annotates as 向きを設定', () => {
            expect(labelsAt(annotate('self.direction = 90'), 1)).toContain('向きを設定');
        });
        test('self.size = n annotates as 大きさを設定', () => {
            expect(labelsAt(annotate('self.size = 200'), 1)).toContain('大きさを設定');
        });
        test('self.volume = n annotates as 音量を設定', () => {
            expect(labelsAt(annotate('self.volume = 50'), 1)).toContain('音量を設定');
        });
        test('self.rotation_style = "..." annotates as 回転スタイルを設定', () => {
            expect(labelsAt(annotate('self.rotation_style = "left-right"'), 1)).toContain('回転スタイルを設定');
        });
        test('self.instrument = n annotates as 楽器を設定', () => {
            expect(labelsAt(annotate('self.instrument = 1'), 1)).toContain('楽器を設定');
        });
        test('self.tempo = n annotates as テンポを設定', () => {
            expect(labelsAt(annotate('self.tempo = 120'), 1)).toContain('テンポを設定');
        });
        test('self.drag_mode = "..." annotates as ドラッグモードを設定', () => {
            expect(labelsAt(annotate('self.drag_mode = "draggable"'), 1)).toContain('ドラッグモードを設定');
        });
    });

    describe('self attribute operator writes (self.x += n)', () => {
        test('self.x += n annotates as X座標を変える', () => {
            expect(labelsAt(annotate('self.x += 10'), 1)).toContain('X座標を変える');
        });
        test('self.y += n annotates as Y座標を変える', () => {
            expect(labelsAt(annotate('self.y += -10'), 1)).toContain('Y座標を変える');
        });
        test('self.size += n annotates as 大きさを変える', () => {
            expect(labelsAt(annotate('self.size += 10'), 1)).toContain('大きさを変える');
        });
        test('self.volume += n annotates as 音量を変える', () => {
            expect(labelsAt(annotate('self.volume += -10'), 1)).toContain('音量を変える');
        });
        test('self.tempo += n annotates as テンポを変える', () => {
            expect(labelsAt(annotate('self.tempo += 20'), 1)).toContain('テンポを変える');
        });
    });

    describe('Keyboard / Mouse / Timer class methods', () => {
        test('Keyboard.pressed? annotates as キーが押されているか', () => {
            expect(labelsAt(annotate('Keyboard.pressed?("space")'), 1)).toContain('キーが押されているか');
        });
        test('Mouse.down? annotates as マウスが押されているか', () => {
            expect(labelsAt(annotate('Mouse.down?'), 1)).toContain('マウスが押されているか');
        });
        test('Mouse.x annotates as マウスのX座標', () => {
            expect(labelsAt(annotate('Mouse.x'), 1)).toContain('マウスのX座標');
        });
        test('Mouse.y annotates as マウスのY座標', () => {
            expect(labelsAt(annotate('Mouse.y'), 1)).toContain('マウスのY座標');
        });
        test('Timer.value annotates as タイマー', () => {
            expect(labelsAt(annotate('Timer.value'), 1)).toContain('タイマー');
        });
        test('Timer.reset annotates as タイマーをリセット', () => {
            expect(labelsAt(annotate('Timer.reset'), 1)).toContain('タイマーをリセット');
        });
    });

    describe('Time.now.xxx chain methods', () => {
        test('Time.now.year annotates as 今の年', () => {
            expect(labelsAt(annotate('Time.now.year'), 1)).toContain('今の年');
        });
        test('Time.now.month annotates as 今の月', () => {
            expect(labelsAt(annotate('Time.now.month'), 1)).toContain('今の月');
        });
        test('Time.now.day annotates as 今の日', () => {
            expect(labelsAt(annotate('Time.now.day'), 1)).toContain('今の日');
        });
        test('Time.now.hour annotates as 今の時', () => {
            expect(labelsAt(annotate('Time.now.hour'), 1)).toContain('今の時');
        });
        test('Time.now.min annotates as 今の分', () => {
            expect(labelsAt(annotate('Time.now.min'), 1)).toContain('今の分');
        });
        test('Time.now.sec annotates as 今の秒', () => {
            expect(labelsAt(annotate('Time.now.sec'), 1)).toContain('今の秒');
        });
        test('Time.now.wday annotates as 今の曜日', () => {
            expect(labelsAt(annotate('Time.now.wday'), 1)).toContain('今の曜日');
        });
    });

    describe('Math class methods', () => {
        test('Math.sqrt annotates as 平方根', () => {
            expect(labelsAt(annotate('Math.sqrt(9)'), 1)).toContain('平方根');
        });
        test('Math.sin annotates as sin', () => {
            expect(labelsAt(annotate('Math.sin(90)'), 1)).toContain('sin');
        });
        test('Math.cos annotates as cos', () => {
            expect(labelsAt(annotate('Math.cos(0)'), 1)).toContain('cos');
        });
        test('Math.tan annotates as tan', () => {
            expect(labelsAt(annotate('Math.tan(45)'), 1)).toContain('tan');
        });
        test('Math.asin annotates as asin', () => {
            expect(labelsAt(annotate('Math.asin(1)'), 1)).toContain('asin');
        });
        test('Math.acos annotates as acos', () => {
            expect(labelsAt(annotate('Math.acos(0)'), 1)).toContain('acos');
        });
        test('Math.atan annotates as atan', () => {
            expect(labelsAt(annotate('Math.atan(1)'), 1)).toContain('atan');
        });
        test('Math.log annotates as ln', () => {
            expect(labelsAt(annotate('Math.log(10)'), 1)).toContain('ln');
        });
        test('Math.log10 annotates as log', () => {
            expect(labelsAt(annotate('Math.log10(100)'), 1)).toContain('log');
        });
    });

    describe('Numeric / String receiver methods', () => {
        test('.round annotates as 四捨五入', () => {
            expect(labelsAt(annotate('x = 3.7\nx.round'), 2)).toContain('四捨五入');
        });
        test('.abs annotates as 絶対値', () => {
            expect(labelsAt(annotate('x = -5\nx.abs'), 2)).toContain('絶対値');
        });
        test('.floor annotates as 切り捨て', () => {
            expect(labelsAt(annotate('x = 3.7\nx.floor'), 2)).toContain('切り捨て');
        });
        test('.ceil annotates as 切り上げ', () => {
            expect(labelsAt(annotate('x = 3.2\nx.ceil'), 2)).toContain('切り上げ');
        });
        test('.length annotates as 長さ', () => {
            expect(labelsAt(annotate('"hello".length'), 1)).toContain('長さ');
        });
        test('.include? annotates as 含むか', () => {
            expect(labelsAt(annotate('"hello".include?("ell")'), 1)).toContain('含むか');
        });
        test('N.times annotates as 回繰り返す', () => {
            const anns = annotate('10.times do\nend');
            expect(labelsAt(anns, 1)).toContain('回繰り返す');
        });
    });

    describe('pen methods (pen local variable receiver)', () => {
        test('pen.stamp annotates as スタンプ', () => {
            expect(labelsAt(annotate('pen = 1\npen.stamp'), 2)).toContain('スタンプ');
        });
        test('pen.down annotates as ペンを下ろす', () => {
            expect(labelsAt(annotate('pen = 1\npen.down'), 2)).toContain('ペンを下ろす');
        });
        test('pen.up annotates as ペンを上げる', () => {
            expect(labelsAt(annotate('pen = 1\npen.up'), 2)).toContain('ペンを上げる');
        });
        test('pen.size = n annotates as ペンの太さを設定', () => {
            expect(labelsAt(annotate('pen = 1\npen.size = 3'), 2)).toContain('ペンの太さを設定');
        });
        test('pen.color = n annotates as ペンの色を設定', () => {
            expect(labelsAt(annotate('pen = 1\npen.color = "#ff0000"'), 2)).toContain('ペンの色を設定');
        });
        test('pen.saturation = n annotates as 彩度を設定', () => {
            expect(labelsAt(annotate('pen = 1\npen.saturation = 100'), 2)).toContain('彩度を設定');
        });
        test('pen.brightness = n annotates as 明るさを設定', () => {
            expect(labelsAt(annotate('pen = 1\npen.brightness = 100'), 2)).toContain('明るさを設定');
        });
        test('pen.transparency = n annotates as 透明度を設定', () => {
            expect(labelsAt(annotate('pen = 1\npen.transparency = 50'), 2)).toContain('透明度を設定');
        });
    });

    describe('pen operator writes (pen.size += n)', () => {
        test('pen.size += n annotates as ペンの太さを変える', () => {
            expect(labelsAt(annotate('pen = 1\npen.size += 1'), 2)).toContain('ペンの太さを変える');
        });
        test('pen.color += n annotates as ペンの色を変える', () => {
            expect(labelsAt(annotate('pen = 1\npen.color += 10'), 2)).toContain('ペンの色を変える');
        });
    });

    describe('Pen class methods (Pen.clear)', () => {
        test('Pen.clear annotates as 全消去', () => {
            expect(labelsAt(annotate('Pen.clear'), 1)).toContain('全消去');
        });
    });

    // ---- Phase 3: list operations, dynamic labels ----

    describe('list operations (receiver-based)', () => {
        test('list().push annotates as 追加する', () => {
            expect(labelsAt(annotate('list("@items").push("apple")'), 1)).toContain('追加する');
        });
        test('list().delete_at annotates as 削除する', () => {
            expect(labelsAt(annotate('list("@items").delete_at(1)'), 1)).toContain('削除する');
        });
        test('list().clear annotates as 全削除する', () => {
            expect(labelsAt(annotate('list("@items").clear'), 1)).toContain('全削除する');
        });
        test('list().insert annotates as 挿入する', () => {
            expect(labelsAt(annotate('list("@items").insert(1, "banana")'), 1)).toContain('挿入する');
        });
        test('list().index annotates as 検索する', () => {
            expect(labelsAt(annotate('list("@items").index("apple")'), 1)).toContain('検索する');
        });
        test('list().length annotates as 長さ', () => {
            expect(labelsAt(annotate('list("@items").length'), 1)).toContain('長さ');
        });
        test('list().include? annotates as 含むか', () => {
            expect(labelsAt(annotate('list("@items").include?("apple")'), 1)).toContain('含むか');
        });
    });

    describe('glide dynamic label', () => {
        test('glide with array and secs produces dynamic label', () => {
            const labels = labelsAt(annotate('glide([100, 50], secs: 1)'), 1);
            expect(labels.some(l => l.includes('秒') && l.includes('x座標') && l.includes('y座標'))).toBe(true);
        });
        test('glide without parseable args falls back to default', () => {
            const labels = labelsAt(annotate('glide("_mouse_", secs: 2)'), 1);
            expect(labels.some(l => l.includes('移動') || l.includes('glide') || l.includes('秒'))).toBe(true);
        });
    });

    describe('go_to_layer dynamic label', () => {
        test('go_to_layer("front") annotates as 最前面へ移動する', () => {
            expect(labelsAt(annotate('go_to_layer("front")'), 1)).toContain('最前面へ移動する');
        });
        test('go_to_layer("back") annotates as 最背面へ移動する', () => {
            expect(labelsAt(annotate('go_to_layer("back")'), 1)).toContain('最背面へ移動する');
        });
    });

    describe('go_layers dynamic label', () => {
        test('go_layers forward embeds n', () => {
            const labels = labelsAt(annotate('go_layers(2, "forward")'), 1);
            expect(labels.some(l => l.includes('2') && l.includes('手前'))).toBe(true);
        });
        test('go_layers backward embeds n', () => {
            const labels = labelsAt(annotate('go_layers(3, "backward")'), 1);
            expect(labels.some(l => l.includes('3') && l.includes('奥'))).toBe(true);
        });
    });

    describe('when_greater_than dynamic label', () => {
        test('LOUDNESS version produces 音量 label', () => {
            const labels = labelsAt(annotate('when_greater_than("LOUDNESS", 10) do\nend'), 1);
            expect(labels.some(l => l.includes('音量') && l.includes('10'))).toBe(true);
        });
        test('TIMER version produces タイマー label', () => {
            const labels = labelsAt(annotate('when_greater_than("TIMER", 5) do\nend'), 1);
            expect(labels.some(l => l.includes('タイマー') && l.includes('5'))).toBe(true);
        });
    });

    describe('rest dynamic label', () => {
        test('rest(0.25) annotates as 0.25拍休む', () => {
            expect(labelsAt(annotate('rest(0.25)'), 1)).toContain('0.25拍休む');
        });
        test('rest(1) annotates as 1拍休む', () => {
            expect(labelsAt(annotate('rest(1)'), 1)).toContain('1拍休む');
        });
    });

    describe('multiline program from book examples', () => {
        test('kakaku example', () => {
            const code = [
                'kakaku = 100',
                'urine = kakaku * 0.7',
                'puts urine'
            ].join('\n');
            const anns = annotate(code);
            // line 1: kakaku = 100
            expect(labelsAt(anns, 1)).toContain('変数kakaku');
            expect(labelsAt(anns, 1)).toContain('紐付ける');
            expect(labelsAt(anns, 1)).toContain('数値100');
            // line 2: urine = kakaku * 0.7
            expect(labelsAt(anns, 2)).toContain('変数urine');
            expect(labelsAt(anns, 2)).toContain('掛ける');
            expect(labelsAt(anns, 2)).toContain('数値0.7');
            // line 3: puts urine
            expect(labelsAt(anns, 3)).toContain('表示する');
            expect(labelsAt(anns, 3)).toContain('変数urine');
        });
    });

    describe('special string literals', () => {
        test('_mouse_ annotates as マウスのポインター', () => {
            const anns = annotate('go_to("_mouse_")');
            expect(labelsAt(anns, 1)).toContain('マウスのポインター');
            expect(labelsAt(anns, 1)).not.toContain('文字列「_mouse_」');
        });
        test('_edge_ annotates as 端', () => {
            const anns = annotate('touching?("_edge_")');
            expect(labelsAt(anns, 1)).toContain('端');
            expect(labelsAt(anns, 1)).not.toContain('文字列「_edge_」');
        });
        test('_random_ annotates as ランダムな場所', () => {
            const anns = annotate('go_to("_random_")');
            expect(labelsAt(anns, 1)).toContain('ランダムな場所');
            expect(labelsAt(anns, 1)).not.toContain('文字列「_random_」');
        });
        test('_myself_ annotates as 自分自身', () => {
            const anns = annotate('create_clone("_myself_")');
            expect(labelsAt(anns, 1)).toContain('自分自身');
            expect(labelsAt(anns, 1)).not.toContain('文字列「_myself_」');
        });
        test('normal string still annotates as 文字列', () => {
            const anns = annotate('say("hello")');
            expect(labelsAt(anns, 1)).toContain('文字列「hello」');
        });
    });

    describe('dropdown menu string values', () => {
        describe('key names', () => {
            test('"space" → スペース', () => {
                expect(labelsAt(annotate('Keyboard.pressed?("space")'), 1)).toContain('スペース');
            });
            test('"up arrow" → 上向き矢印', () => {
                expect(labelsAt(annotate('when_key_pressed("up arrow") do\nend'), 1)).toContain('上向き矢印');
            });
            test('"down arrow" → 下向き矢印', () => {
                expect(labelsAt(annotate('Keyboard.pressed?("down arrow")'), 1)).toContain('下向き矢印');
            });
            test('"left arrow" → 左向き矢印', () => {
                expect(labelsAt(annotate('Keyboard.pressed?("left arrow")'), 1)).toContain('左向き矢印');
            });
            test('"right arrow" → 右向き矢印', () => {
                expect(labelsAt(annotate('Keyboard.pressed?("right arrow")'), 1)).toContain('右向き矢印');
            });
            test('"any" → どれかのキー', () => {
                expect(labelsAt(annotate('Keyboard.pressed?("any")'), 1)).toContain('どれかのキー');
            });
        });

        describe('stop options', () => {
            test('"all" → すべて', () => {
                expect(labelsAt(annotate('stop("all")'), 1)).toContain('すべて');
            });
            test('"this script" → このスクリプト', () => {
                expect(labelsAt(annotate('stop("this script")'), 1)).toContain('このスクリプト');
            });
            test('"other scripts in sprite" → スプライトの他のスクリプト', () => {
                expect(labelsAt(annotate('stop("other scripts in sprite")'), 1)).toContain('スプライトの他のスクリプト');
            });
        });

        describe('rotation styles', () => {
            test('"all around" → 自由に回転', () => {
                expect(labelsAt(annotate('self.rotation_style = "all around"'), 1)).toContain('自由に回転');
            });
            test('"left-right" → 左右のみ', () => {
                expect(labelsAt(annotate('self.rotation_style = "left-right"'), 1)).toContain('左右のみ');
            });
            test('"don\'t rotate" → 回転しない', () => {
                expect(labelsAt(annotate("self.rotation_style = \"don't rotate\""), 1)).toContain('回転しない');
            });
        });

        describe('drag modes', () => {
            test('"draggable" → できる', () => {
                expect(labelsAt(annotate('self.drag_mode = "draggable"'), 1)).toContain('できる');
            });
            test('"not draggable" → できない', () => {
                expect(labelsAt(annotate('self.drag_mode = "not draggable"'), 1)).toContain('できない');
            });
        });

        describe('sound effects', () => {
            test('"PITCH" → ピッチ', () => {
                expect(labelsAt(annotate('set_sound_effect("PITCH", 100)'), 1)).toContain('ピッチ');
            });
            test('"PAN" → 左右にパン', () => {
                expect(labelsAt(annotate('set_sound_effect("PAN", 50)'), 1)).toContain('左右にパン');
            });
        });

        describe('graphic effects', () => {
            test('"color" → 色', () => {
                expect(labelsAt(annotate('set_effect("color", 25)'), 1)).toContain('色');
            });
            test('"fisheye" → 魚眼レンズ', () => {
                expect(labelsAt(annotate('set_effect("fisheye", 50)'), 1)).toContain('魚眼レンズ');
            });
            test('"whirl" → 渦巻き', () => {
                expect(labelsAt(annotate('set_effect("whirl", 100)'), 1)).toContain('渦巻き');
            });
            test('"pixelate" → ピクセル化', () => {
                expect(labelsAt(annotate('set_effect("pixelate", 10)'), 1)).toContain('ピクセル化');
            });
            test('"mosaic" → モザイク', () => {
                expect(labelsAt(annotate('set_effect("mosaic", 25)'), 1)).toContain('モザイク');
            });
            test('"brightness" → 明るさ', () => {
                expect(labelsAt(annotate('change_effect_by("brightness", 10)'), 1)).toContain('明るさ');
            });
            test('"ghost" → 幽霊', () => {
                expect(labelsAt(annotate('set_effect("ghost", 50)'), 1)).toContain('幽霊');
            });
        });
    });
});
