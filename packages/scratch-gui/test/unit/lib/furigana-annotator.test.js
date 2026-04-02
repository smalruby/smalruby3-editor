import FuriganaAnnotator from '../../../src/lib/furigana-annotator';
import { loadPrism } from '../../../src/lib/prism-parser';

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
        test('def initialize: def annotates as メソッド作成, name as 初期設定', () => {
            const anns = annotate('def initialize\n  @x = 0\nend');
            expect(labelsAt(anns, 1)).toContain('メソッド作成');
            expect(labelsAt(anns, 1)).toContain('初期設定');
        });
        test('end of def initialize annotates as 作成終了', () => {
            const anns = annotate('def initialize\n  @x = 0\nend');
            expect(labelsAt(anns, 3)).toContain('作成終了');
        });
        test('def initialize with parameters still annotates 引数N', () => {
            const anns = annotate('def initialize(a)\n  @x = a\nend');
            expect(labelsAt(anns, 1)).toContain('初期設定');
            expect(labelsAt(anns, 1)).toContain('引数a');
        });
    });

    describe('return', () => {
        test('return annotates as 呼び出し元に返す', () => {
            const anns = annotate('def double(x)\n  return x * 2\nend');
            expect(labelsAt(anns, 2)).toContain('呼び出し元に返す');
        });
    });

    describe('module definition and include', () => {
        test('module keyword annotates as モジュール作成', () => {
            const anns = annotate('module Utils\nend');
            expect(labelsAt(anns, 1)).toContain('モジュール作成');
        });
        test('end of module annotates as 作成終了', () => {
            const anns = annotate('module Utils\nend');
            expect(labelsAt(anns, 2)).toContain('作成終了');
        });
        test('include annotates as 取り込む', () => {
            const anns = annotate('class Sprite1\n  include Utils\nend');
            expect(labelsAt(anns, 2)).toContain('取り込む');
        });
        test('module with def annotates both', () => {
            const anns = annotate('module Utils\n  def add(a, b)\n    a + b\n  end\nend');
            expect(labelsAt(anns, 1)).toContain('モジュール作成');
            expect(labelsAt(anns, 2)).toContain('メソッド作成');
            expect(labelsAt(anns, 4)).toContain('作成終了');
            expect(labelsAt(anns, 5)).toContain('作成終了');
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
        test('set_current_backdrop annotates as 現在の背景を設定', () => {
            const anns = annotate('class Stage\n  set_current_backdrop 1\nend');
            expect(labelsAt(anns, 2)).toContain('現在の背景を設定');
        });
        test('set_backdrops annotates as 背景を設定', () => {
            const anns = annotate('class Stage\n  set_backdrops ["Arctic"]\nend');
            expect(labelsAt(anns, 2)).toContain('背景を設定');
        });
        test('set_current_costume annotates as コスチュームを設定', () => {
            const anns = annotate('class Sprite1\n  set_current_costume 2\nend');
            expect(labelsAt(anns, 2)).toContain('コスチュームを設定');
        });
        test('set_name annotates as 名前を設定', () => {
            const anns = annotate('class Stage\n  set_name "ステージ"\nend');
            expect(labelsAt(anns, 2)).toContain('名前を設定');
        });
        test('set_sounds annotates as 音を設定', () => {
            const anns = annotate('class Stage\n  set_sounds ["Dog1"]\nend');
            expect(labelsAt(anns, 2)).toContain('音を設定');
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
        test('turn_right annotates as 時計回りに回す', () => {
            expect(labelsAt(annotate('turn_right(15)'), 1)).toContain('時計回りに回す');
        });
        test('turn_left annotates as 反時計回りに回す', () => {
            expect(labelsAt(annotate('turn_left(15)'), 1)).toContain('反時計回りに回す');
        });
        test('go_to annotates as 移動する', () => {
            expect(labelsAt(annotate('go_to("_mouse_")'), 1)).toContain('移動する');
        });
        test('point_towards annotates as 向く', () => {
            expect(labelsAt(annotate('point_towards("_mouse_")'), 1)).toContain('向く');
        });
        test('bounce_if_on_edge annotates as もし端に着いたら、跳ね返る', () => {
            expect(labelsAt(annotate('bounce_if_on_edge'), 1)).toContain('もし端に着いたら、跳ね返る');
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
        test('when_flag_clicked annotates as ⚑が押されたとき', () => {
            const anns = annotate('when_flag_clicked do\nend');
            expect(labelsAt(anns, 1)).toContain('⚑が押されたとき');
        });
        test('when_key_pressed annotates as キーが押されたとき', () => {
            const anns = annotate('when_key_pressed("space") do\nend');
            expect(labelsAt(anns, 1)).toContain('キーが押されたとき');
        });
        test('when_clicked annotates as このスプライトが押されたとき', () => {
            const anns = annotate('when_clicked do\nend');
            expect(labelsAt(anns, 1)).toContain('このスプライトが押されたとき');
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
        test('sleep annotates as 待つ', () => {
            expect(labelsAt(annotate('sleep(1)'), 1)).toContain('待つ');
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
            expect(labelsAt(annotate('color_is_touching_color?("#ff0000", "#00ff00")'), 1)).toContain(
                '色が色に触れているか',
            );
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
        test('self.direction += n annotates as 時計回りに回す', () => {
            expect(labelsAt(annotate('self.direction += 180'), 1)).toContain('時計回りに回す');
        });
        test('self.direction -= n annotates as 反時計回りに回す', () => {
            expect(labelsAt(annotate('self.direction -= 90'), 1)).toContain('反時計回りに回す');
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

    describe('face_sensing methods (predefined extension receiver)', () => {
        test('face_sensing.go_to("nose") annotates face_sensing as 顔認識, go_to as 行く, "nose" as 鼻', () => {
            const labels = labelsAt(annotate('face_sensing.go_to("nose")'), 1);
            expect(labels).toContain('顔認識');
            expect(labels).toContain('行く');
            expect(labels).toContain('鼻');
        });
        test('face_sensing.go_to("left_eye") annotates "left_eye" as 左目', () => {
            const labels = labelsAt(annotate('face_sensing.go_to("left_eye")'), 1);
            expect(labels).toContain('左目');
        });
        test('face_sensing.go_to("top_of_head") annotates "top_of_head" as 頭のてっぺん', () => {
            const labels = labelsAt(annotate('face_sensing.go_to("top_of_head")'), 1);
            expect(labels).toContain('頭のてっぺん');
        });
        test('face_sensing.point_in_direction_of_face_tilt annotates as 顔の傾きの方向を向く', () => {
            const labels = labelsAt(annotate('face_sensing.point_in_direction_of_face_tilt'), 1);
            expect(labels).toContain('顔認識');
            expect(labels).toContain('顔の傾きの方向を向く');
        });
        test('face_sensing.set_size_to_face_size annotates as 大きさを顔の大きさにする', () => {
            const labels = labelsAt(annotate('face_sensing.set_size_to_face_size'), 1);
            expect(labels).toContain('顔認識');
            expect(labels).toContain('大きさを顔の大きさにする');
        });
        test('face_sensing.when_face_tilted("left") annotates as 顔が傾いたとき with 左', () => {
            const labels = labelsAt(annotate('face_sensing.when_face_tilted("left") do; end'), 1);
            expect(labels).toContain('顔認識');
            expect(labels).toContain('顔が傾いたとき');
            expect(labels).toContain('左');
        });
        test('face_sensing.when_face_tilted("right") annotates "right" as 右', () => {
            const labels = labelsAt(annotate('face_sensing.when_face_tilted("right") do; end'), 1);
            expect(labels).toContain('右');
        });
        test('face_sensing.when_this_sprite_touch("nose") annotates as 触れたとき with 鼻', () => {
            const labels = labelsAt(annotate('face_sensing.when_this_sprite_touch("nose") do; end'), 1);
            expect(labels).toContain('顔認識');
            expect(labels).toContain('触れたとき');
            expect(labels).toContain('鼻');
        });
        test('face_sensing.when_face_detected annotates as 顔が見つかったとき', () => {
            const labels = labelsAt(annotate('face_sensing.when_face_detected do; end'), 1);
            expect(labels).toContain('顔認識');
            expect(labels).toContain('顔が見つかったとき');
        });
        test('face_sensing.face_detected? annotates as 顔が見つかった', () => {
            const labels = labelsAt(annotate('face_sensing.face_detected?'), 1);
            expect(labels).toContain('顔認識');
            expect(labels).toContain('顔が見つかった');
        });
        test('face_sensing.face_tilt annotates as 顔の傾き', () => {
            const labels = labelsAt(annotate('face_sensing.face_tilt'), 1);
            expect(labels).toContain('顔認識');
            expect(labels).toContain('顔の傾き');
        });
        test('face_sensing.face_size annotates as 顔の大きさ', () => {
            const labels = labelsAt(annotate('face_sensing.face_size'), 1);
            expect(labels).toContain('顔認識');
            expect(labels).toContain('顔の大きさ');
        });
        test('PART string labels do not leak to non-face_sensing context', () => {
            const labels = labelsAt(annotate('go_to("nose")'), 1);
            expect(labels).not.toContain('鼻');
            expect(labels).toContain('文字列「nose」');
        });
    });

    describe('pen methods (predefined extension receiver)', () => {
        test('pen.stamp annotates pen as ペン, stamp as スタンプ', () => {
            const labels = labelsAt(annotate('pen.stamp'), 1);
            expect(labels).toContain('ペン');
            expect(labels).toContain('スタンプ');
        });
        test('pen.down annotates as ペンを下ろす', () => {
            const labels = labelsAt(annotate('pen.down'), 1);
            expect(labels).toContain('ペン');
            expect(labels).toContain('ペンを下ろす');
        });
        test('pen.up annotates as ペンを上げる', () => {
            const labels = labelsAt(annotate('pen.up'), 1);
            expect(labels).toContain('ペン');
            expect(labels).toContain('ペンを上げる');
        });
        test('pen.size = n annotates as ペンの太さを設定', () => {
            const labels = labelsAt(annotate('pen.size = 3'), 1);
            expect(labels).toContain('ペン');
            expect(labels).toContain('ペンの太さを設定');
        });
        test('pen.color = n annotates as ペンの色を設定', () => {
            const labels = labelsAt(annotate('pen.color = "#ff0000"'), 1);
            expect(labels).toContain('ペン');
            expect(labels).toContain('ペンの色を設定');
        });
        test('pen.saturation = n annotates as 彩度を設定', () => {
            const labels = labelsAt(annotate('pen.saturation = 100'), 1);
            expect(labels).toContain('ペン');
            expect(labels).toContain('彩度を設定');
        });
        test('pen.brightness = n annotates as 明るさを設定', () => {
            const labels = labelsAt(annotate('pen.brightness = 100'), 1);
            expect(labels).toContain('ペン');
            expect(labels).toContain('明るさを設定');
        });
        test('pen.transparency = n annotates as 透明度を設定', () => {
            const labels = labelsAt(annotate('pen.transparency = 50'), 1);
            expect(labels).toContain('ペン');
            expect(labels).toContain('透明度を設定');
        });
    });

    describe('pen operator writes (pen.size += n)', () => {
        test('pen.size += n annotates pen as ペン', () => {
            const labels = labelsAt(annotate('pen.size += 1'), 1);
            expect(labels).toContain('ペン');
            expect(labels).toContain('ペンの太さを変える');
        });
        test('pen.color += n annotates pen as ペン', () => {
            const labels = labelsAt(annotate('pen.color += 10'), 1);
            expect(labels).toContain('ペン');
            expect(labels).toContain('ペンの色を変える');
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

    describe('do...end block annotations', () => {
        test('loop do...end: do → 以下の処理, end → 繰り返し終了', () => {
            const anns = annotate('loop do\n  puts 1\nend');
            expect(labelsAt(anns, 1)).toContain('ずっと繰り返す');
            expect(labelsAt(anns, 1)).toContain('以下の処理');
            expect(labelsAt(anns, 3)).toContain('繰り返し終了');
        });
        test('N.times do...end: do → 以下の処理, end → 繰り返し終了', () => {
            const anns = annotate('10.times do\n  puts 1\nend');
            expect(labelsAt(anns, 1)).toContain('回繰り返す');
            expect(labelsAt(anns, 1)).toContain('以下の処理');
            expect(labelsAt(anns, 3)).toContain('繰り返し終了');
        });
        test('when_clicked do...end: do → 以下の処理, end → ブロック終了', () => {
            const anns = annotate('when_clicked do\n  move(10)\nend');
            expect(labelsAt(anns, 1)).toContain('以下の処理');
            expect(labelsAt(anns, 3)).toContain('ブロック終了');
        });
        test('when_flag_clicked do...end: do → 以下の処理, end → ブロック終了', () => {
            const anns = annotate('when_flag_clicked do\n  move(10)\nend');
            expect(labelsAt(anns, 1)).toContain('以下の処理');
            expect(labelsAt(anns, 3)).toContain('ブロック終了');
        });
        test('when_key_pressed do...end: do → 以下の処理, end → ブロック終了', () => {
            const anns = annotate('when_key_pressed("space") do\n  move(10)\nend');
            expect(labelsAt(anns, 1)).toContain('以下の処理');
            expect(labelsAt(anns, 3)).toContain('ブロック終了');
        });
        test('when_start_as_a_clone do...end: do → 以下の処理, end → ブロック終了', () => {
            const anns = annotate('when_start_as_a_clone do\n  move(10)\nend');
            expect(labelsAt(anns, 1)).toContain('以下の処理');
            expect(labelsAt(anns, 3)).toContain('ブロック終了');
        });
    });

    describe('literal argument unit suffixes', () => {
        test('move(10) → 10 annotates as 10歩 (not 数値10)', () => {
            const anns = annotate('move(10)');
            expect(labelsAt(anns, 1)).toContain('10歩');
            expect(labelsAt(anns, 1)).not.toContain('数値10');
        });
        test('move(0.5) → 0.5 annotates as 0.5歩', () => {
            const anns = annotate('move(0.5)');
            expect(labelsAt(anns, 1)).toContain('0.5歩');
        });
        test('move(x) → variable x gets no unit', () => {
            const anns = annotate('x = 10\nmove(x)');
            expect(labelsAt(anns, 2)).toContain('変数x');
            expect(labelsAt(anns, 2)).not.toContain('x歩');
        });
        test('turn_right(15) → 15 annotates as 15度', () => {
            const anns = annotate('turn_right(15)');
            expect(labelsAt(anns, 1)).toContain('15度');
            expect(labelsAt(anns, 1)).not.toContain('数値15');
        });
        test('turn_left(90) → 90 annotates as 90度', () => {
            const anns = annotate('turn_left(90)');
            expect(labelsAt(anns, 1)).toContain('90度');
        });
        test('self.direction += 180 → 180 annotates as 180度', () => {
            const anns = annotate('self.direction += 180');
            expect(labelsAt(anns, 1)).toContain('180度');
            expect(labelsAt(anns, 1)).not.toContain('数値180');
        });
        test('self.direction -= 45 → 45 annotates as 45度', () => {
            const anns = annotate('self.direction -= 45');
            expect(labelsAt(anns, 1)).toContain('45度');
        });
        test('sleep(1) → 1 annotates as 1秒', () => {
            const anns = annotate('sleep(1)');
            expect(labelsAt(anns, 1)).toContain('1秒');
            expect(labelsAt(anns, 1)).not.toContain('数値1');
        });
        test('sleep(0.5) → 0.5 annotates as 0.5秒', () => {
            const anns = annotate('sleep(0.5)');
            expect(labelsAt(anns, 1)).toContain('0.5秒');
        });
    });

    describe('multiline program from book examples', () => {
        test('kakaku example', () => {
            const code = ['kakaku = 100', 'urine = kakaku * 0.7', 'puts urine'].join('\n');
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
                expect(labelsAt(annotate('stop("other scripts in sprite")'), 1)).toContain(
                    'スプライトの他のスクリプト',
                );
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
                expect(labelsAt(annotate('self.rotation_style = "don\'t rotate"'), 1)).toContain('回転しない');
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

    // ---- Extension furigana tests ----

    describe('translate extension', () => {
        test('translate("hello", "ja") → 翻訳する', () => {
            expect(labelsAt(annotate('translate("hello", "ja")'), 1)).toContain('翻訳する');
        });
        test('language → 言語', () => {
            expect(labelsAt(annotate('language'), 1)).toContain('言語');
        });
    });

    describe('video_sensing extension (predefined receiver)', () => {
        test('video_sensing receiver → ビデオ', () => {
            expect(labelsAt(annotate('video_sensing.video_turn("on")'), 1)).toContain('ビデオ');
        });
        test('video_sensing.video_turn("on") → ビデオを切り替える + オン', () => {
            const labels = labelsAt(annotate('video_sensing.video_turn("on")'), 1);
            expect(labels).toContain('ビデオを切り替える');
            expect(labels).toContain('オン');
        });
        test('video_sensing.video_turn("off") → オフ', () => {
            expect(labelsAt(annotate('video_sensing.video_turn("off")'), 1)).toContain('オフ');
        });
        test('video_sensing.video_turn("on-flipped") → 左右反転', () => {
            expect(labelsAt(annotate('video_sensing.video_turn("on-flipped")'), 1)).toContain('左右反転');
        });
        test('video_sensing.video_transparency = 50 → ビデオの透明度を設定', () => {
            expect(labelsAt(annotate('video_sensing.video_transparency = 50'), 1)).toContain('ビデオの透明度を設定');
        });
        test('video_sensing.video_on("motion", "this sprite") → ビデオの値 + 動き + このスプライト', () => {
            const labels = labelsAt(annotate('video_sensing.video_on("motion", "this sprite")'), 1);
            expect(labels).toContain('ビデオの値');
            expect(labels).toContain('動き');
            expect(labels).toContain('このスプライト');
        });
        test('video_sensing.when_video_motion_greater_than(10) do; end → ビデオモーション ＞ のとき', () => {
            const labels = labelsAt(annotate('video_sensing.when_video_motion_greater_than(10) do; end'), 1);
            expect(labels).toContain('ビデオ');
            expect(labels).toContain('ビデオモーション ＞ のとき');
        });
    });

    describe('text2speech extension (predefined receiver)', () => {
        test('text2speech receiver → 音声合成', () => {
            expect(labelsAt(annotate('text2speech.speak("hello")'), 1)).toContain('音声合成');
        });
        test('text2speech.speak("hello") → 話す', () => {
            expect(labelsAt(annotate('text2speech.speak("hello")'), 1)).toContain('話す');
        });
        test('text2speech.voice = "ALTO" → 声を設定', () => {
            expect(labelsAt(annotate('text2speech.voice = "ALTO"'), 1)).toContain('声を設定');
        });
        test('text2speech.language = "ja" → 言語を設定', () => {
            expect(labelsAt(annotate('text2speech.language = "ja"'), 1)).toContain('言語を設定');
        });
    });

    describe('microbit extension (predefined receiver)', () => {
        test('microbit receiver → マイクロビット', () => {
            expect(labelsAt(annotate('microbit.temperature'), 1)).toContain('マイクロビット');
        });
        test('microbit.temperature → 温度', () => {
            expect(labelsAt(annotate('microbit.temperature'), 1)).toContain('温度');
        });
        test('microbit.light_intensity → 明るさ', () => {
            expect(labelsAt(annotate('microbit.light_intensity'), 1)).toContain('明るさ');
        });
        test('microbit.button_pressed?("A") → ボタンが押されたか + A', () => {
            const labels = labelsAt(annotate('microbit.button_pressed?("A")'), 1);
            expect(labels).toContain('ボタンが押されたか');
            expect(labels).toContain('A');
        });
        test('microbit.when_tilted("LEFT") do; end → 傾いたとき + 左', () => {
            const labels = labelsAt(annotate('microbit.when_tilted("LEFT") do; end'), 1);
            expect(labels).toContain('傾いたとき');
            expect(labels).toContain('左');
        });
        test('microbit.display_text("Hello!") → テキスト表示', () => {
            expect(labelsAt(annotate('microbit.display_text("Hello!")'), 1)).toContain('テキスト表示');
        });
        test('microbit.clear_display → LED消去', () => {
            expect(labelsAt(annotate('microbit.clear_display'), 1)).toContain('LED消去');
        });
        test('microbit.acceleration("x") → 加速度 + x', () => {
            const labels = labelsAt(annotate('microbit.acceleration("x")'), 1);
            expect(labels).toContain('加速度');
            expect(labels).toContain('x');
        });
        test('microbit.play_tone(440, 100) → 音を鳴らす', () => {
            expect(labelsAt(annotate('microbit.play_tone(440, 100)'), 1)).toContain('音を鳴らす');
        });
        test('microbit.send_data_to_microbit("data", "label") → データ送信', () => {
            expect(labelsAt(annotate('microbit.send_data_to_microbit("data", "label")'), 1)).toContain('データ送信');
        });
    });

    describe('mesh extensions (predefined receiver)', () => {
        test('mesh_v1.sensor_value("x") → メッシュ(従来) + センサーの値', () => {
            const labels = labelsAt(annotate('mesh_v1.sensor_value("x")'), 1);
            expect(labels).toContain('メッシュ(従来)');
            expect(labels).toContain('センサーの値');
        });
        test('mesh.sensor_value("x") → メッシュ + センサーの値', () => {
            const labels = labelsAt(annotate('mesh.sensor_value("x")'), 1);
            expect(labels).toContain('メッシュ');
            expect(labels).toContain('センサーの値');
        });
    });

    describe('smalrubot_s1 extension (predefined receiver)', () => {
        test('smalrubot_s1 receiver → スモウルボットS1', () => {
            expect(labelsAt(annotate('smalrubot_s1.action("forward")'), 1)).toContain('スモウルボットS1');
        });
        test('smalrubot_s1.action("forward") → 動作する + 進める', () => {
            const labels = labelsAt(annotate('smalrubot_s1.action("forward")'), 1);
            expect(labels).toContain('動作する');
            expect(labels).toContain('進める');
        });
        test('smalrubot_s1.action("backward") → バックさせる', () => {
            expect(labelsAt(annotate('smalrubot_s1.action("backward")'), 1)).toContain('バックさせる');
        });
        test('smalrubot_s1.sensor_value("left") → センサーの値', () => {
            expect(labelsAt(annotate('smalrubot_s1.sensor_value("left")'), 1)).toContain('センサーの値');
        });
        test('smalrubot_s1.bend_arm(90, 1) → アームを曲げる', () => {
            expect(labelsAt(annotate('smalrubot_s1.bend_arm(90, 1)'), 1)).toContain('アームを曲げる');
        });
        test('smalrubot_s1.get_motor_speed("left") → モーター速度', () => {
            expect(labelsAt(annotate('smalrubot_s1.get_motor_speed("left")'), 1)).toContain('モーター速度');
        });
    });

    describe('koshien extension (predefined receiver)', () => {
        test('koshien receiver → スモウルビー甲子園', () => {
            expect(labelsAt(annotate('koshien.turn_over'), 1)).toContain('スモウルビー甲子園');
        });
        test('koshien.connect_game(name: "player1") → ゲームに接続', () => {
            expect(labelsAt(annotate('koshien.connect_game(name: "player1")'), 1)).toContain('ゲームに接続');
        });
        test('koshien.move_to("0:0") → 移動する + x:0,y:0', () => {
            const labels = labelsAt(annotate('koshien.move_to("0:0")'), 1);
            expect(labels).toContain('移動する');
            expect(labels).toContain('x:0,y:0');
        });
        test('koshien.turn_over → ターン終了', () => {
            expect(labelsAt(annotate('koshien.turn_over'), 1)).toContain('ターン終了');
        });
        test('koshien.map("1:2") → マップ + x:1,y:2', () => {
            const labels = labelsAt(annotate('koshien.map("1:2")'), 1);
            expect(labels).toContain('マップ');
            expect(labels).toContain('x:1,y:2');
        });
        test('koshien.position(0, 0) → 座標', () => {
            expect(labelsAt(annotate('koshien.position(0, 0)'), 1)).toContain('座標');
        });
        test('koshien.set_message("hello") → メッセージ設定', () => {
            expect(labelsAt(annotate('koshien.set_message("hello")'), 1)).toContain('メッセージ設定');
        });
        test('koshien.get_map_area("-1:3") → マップエリア + x:-1,y:3', () => {
            const labels = labelsAt(annotate('koshien.get_map_area("-1:3")'), 1);
            expect(labels).toContain('マップエリア');
            expect(labels).toContain('x:-1,y:3');
        });
    });

    describe('symbol literals', () => {
        test(':foo annotates as シンボル「foo」', () => {
            const anns = annotate('x = :foo');
            expect(labelsAt(anns, 1)).toContain('シンボル「foo」');
        });
        test(':bar_baz annotates as シンボル「bar_baz」', () => {
            const anns = annotate('x = :bar_baz');
            expect(labelsAt(anns, 1)).toContain('シンボル「bar_baz」');
        });
    });

    // === Smalruby: Start of regex furigana tests ===
    describe('regex literals', () => {
        test('/^he/ annotates as 正規表現/^he/', () => {
            const anns = annotate('r = /^he/');
            expect(labelsAt(anns, 1)).toContain('正規表現/^he/');
        });
        test('/hello/i annotates with flags', () => {
            const anns = annotate('r = /hello/i');
            expect(labelsAt(anns, 1)).toContain('正規表現/hello/i');
        });
        test('regex variable assignment has 紐付ける', () => {
            const anns = annotate('r = /^he/');
            expect(labelsAt(anns, 1)).toEqual(['変数r', '紐付ける', '正規表現/^he/']);
        });
    });

    describe('=~ and !~ operators', () => {
        test('=~ annotates as 正規表現マッチ', () => {
            const anns = annotate('"hello" =~ /^he/');
            expect(labelsAt(anns, 1)).toContain('正規表現マッチ');
        });
        test('!~ annotates as 正規表現マッチしない', () => {
            const anns = annotate('"hello" !~ /world/');
            expect(labelsAt(anns, 1)).toContain('正規表現マッチしない');
        });
        test('=~ with variable and regex in if', () => {
            const anns = annotate('r = /^he/\nif "hello" =~ r');
            expect(labelsAt(anns, 2)).toContain('正規表現マッチ');
            expect(labelsAt(anns, 2)).toContain('もし');
        });
    });
    // === Smalruby: End of regex furigana tests ===

    // === Smalruby: Start of array/hash/super furigana tests ===
    describe('array literals', () => {
        test('[1, 2, 3] annotates array with 配列', () => {
            const anns = annotate('[1, 2, 3]');
            expect(labelsAt(anns, 1)).toContain('配列');
        });
        test('array elements get their own annotations', () => {
            const anns = annotate('[1, 2]');
            expect(labelsAt(anns, 1)).toContain('配列');
            expect(labelsAt(anns, 1)).toContain('数値1');
            expect(labelsAt(anns, 1)).toContain('数値2');
        });
        test('empty array [] annotates as 配列', () => {
            const anns = annotate('[]');
            expect(labelsAt(anns, 1)).toContain('配列');
        });
        test('array in variable assignment', () => {
            const anns = annotate('a = [1, 2]');
            expect(labelsAt(anns, 1)).toContain('変数a');
            expect(labelsAt(anns, 1)).toContain('紐付ける');
            expect(labelsAt(anns, 1)).toContain('配列');
        });
    });

    describe('hash literals', () => {
        test('{a: 1} annotates hash with ハッシュ', () => {
            const anns = annotate('{a: 1}');
            expect(labelsAt(anns, 1)).toContain('ハッシュ');
        });
        test('hash elements get their own annotations', () => {
            const anns = annotate('{a: 1, b: 2}');
            expect(labelsAt(anns, 1)).toContain('ハッシュ');
            expect(labelsAt(anns, 1)).toContain('数値1');
            expect(labelsAt(anns, 1)).toContain('数値2');
        });
        test('empty hash {} annotates as ハッシュ', () => {
            const anns = annotate('{}');
            expect(labelsAt(anns, 1)).toContain('ハッシュ');
        });
        test('hash in variable assignment', () => {
            const anns = annotate('h = {x: 10}');
            expect(labelsAt(anns, 1)).toContain('変数h');
            expect(labelsAt(anns, 1)).toContain('紐付ける');
            expect(labelsAt(anns, 1)).toContain('ハッシュ');
        });
    });

    describe('super keyword', () => {
        test('bare super annotates as オーバーライドしているメソッドを呼ぶ', () => {
            const anns = annotate('def greet\n  super\nend');
            expect(labelsAt(anns, 2)).toContain('オーバーライドしているメソッドを呼ぶ');
        });
        test('super(a, b) annotates as オーバーライドしているメソッドを呼ぶ', () => {
            const anns = annotate('def add(a, b)\n  super(a, b)\nend');
            expect(labelsAt(anns, 2)).toContain('オーバーライドしているメソッドを呼ぶ');
        });
    });
    // === Smalruby: End of array/hash/super furigana tests ===

    // === Smalruby: Start of tm2scratch furigana tests ===
    describe('tm methods (Teachable Machine extension)', () => {
        test('tm.classify_video_image annotates receiver and method', () => {
            const labels = labelsAt(annotate('tm.classify_video_image'), 1);
            expect(labels).toContain('機械学習');
            expect(labels).toContain('画像を分類する');
        });

        test('tm.image_label annotates receiver and method', () => {
            const labels = labelsAt(annotate('tm.image_label'), 1);
            expect(labels).toContain('機械学習');
            expect(labels).toContain('画像ラベル');
        });

        test('tm.sound_label annotates receiver and method', () => {
            const labels = labelsAt(annotate('tm.sound_label'), 1);
            expect(labels).toContain('機械学習');
            expect(labels).toContain('音声ラベル');
        });

        test('tm.when_image_label_received("cat") annotates hat block', () => {
            const labels = labelsAt(annotate('tm.when_image_label_received("cat") do; end'), 1);
            expect(labels).toContain('機械学習');
            expect(labels).toContain('画像ラベルを受け取ったとき');
        });

        test('tm.when_sound_label_received("clap") annotates hat block', () => {
            const labels = labelsAt(annotate('tm.when_sound_label_received("clap") do; end'), 1);
            expect(labels).toContain('機械学習');
            expect(labels).toContain('音声ラベルを受け取ったとき');
        });

        test('tm.image_label_detected?("dog") annotates boolean', () => {
            const labels = labelsAt(annotate('tm.image_label_detected?("dog")'), 1);
            expect(labels).toContain('機械学習');
            expect(labels).toContain('画像ラベル？');
        });

        test('tm.set_image_classification_model_url("url") annotates command', () => {
            const labels = labelsAt(annotate('tm.set_image_classification_model_url("https://example.com/")'), 1);
            expect(labels).toContain('機械学習');
            expect(labels).toContain('画像分類モデルURLを設定');
        });

        test('tm.toggle_classification("on") annotates with menu label', () => {
            const labels = labelsAt(annotate('tm.toggle_classification("on")'), 1);
            expect(labels).toContain('機械学習');
            expect(labels).toContain('分類を切り替え');
            expect(labels).toContain('オン');
        });

        test('tm.video_toggle("on-flipped") annotates with video state label', () => {
            const labels = labelsAt(annotate('tm.video_toggle("on-flipped")'), 1);
            expect(labels).toContain('機械学習');
            expect(labels).toContain('ビデオを切り替え');
            expect(labels).toContain('オン（左右反転）');
        });

        test('tm.confidence_threshold annotates getter', () => {
            const labels = labelsAt(annotate('tm.confidence_threshold'), 1);
            expect(labels).toContain('機械学習');
            expect(labels).toContain('確信度のしきい値');
        });

        test('tm.confidence_threshold = 0.8 annotates setter', () => {
            const labels = labelsAt(annotate('tm.confidence_threshold = 0.8'), 1);
            expect(labels).toContain('機械学習');
            expect(labels).toContain('確信度のしきい値を設定');
        });

        test('tm.classification_interval = "0.5" annotates setter', () => {
            const labels = labelsAt(annotate('tm.classification_interval = "0.5"'), 1);
            expect(labels).toContain('機械学習');
            expect(labels).toContain('分類間隔を設定');
        });

        test('tm menu labels do not leak to other contexts', () => {
            const labels = labelsAt(annotate('toggle_classification("on")'), 1);
            expect(labels).not.toContain('オン');
        });
    });
    // === Smalruby: End of tm2scratch furigana tests ===

    // === Smalruby: Start of g2s furigana tests ===
    describe('akadako methods (AkaDako extension)', () => {
        test('akadako.connect_board annotates receiver and method', () => {
            const labels = labelsAt(annotate('akadako.connect_board'), 1);
            expect(labels).toContain('AkaDako');
            expect(labels).toContain('ボードを接続');
        });

        test('akadako.connected? annotates boolean', () => {
            const labels = labelsAt(annotate('akadako.connected?'), 1);
            expect(labels).toContain('AkaDako');
            expect(labels).toContain('接続している');
        });

        test('akadako.when_board_state_changed("connected") annotates with menu label', () => {
            const labels = labelsAt(annotate('akadako.when_board_state_changed("connected") do; end'), 1);
            expect(labels).toContain('AkaDako');
            expect(labels).toContain('ボードが変わったとき');
            expect(labels).toContain('接続された');
        });

        test('akadako.analog_level_a1 annotates sensor', () => {
            const labels = labelsAt(annotate('akadako.analog_level_a1'), 1);
            expect(labels).toContain('AkaDako');
            expect(labels).toContain('アナログA(A1)の値');
        });

        test('akadako.when_shaken annotates hat block', () => {
            const labels = labelsAt(annotate('akadako.when_shaken do; end'), 1);
            expect(labels).toContain('AkaDako');
            expect(labels).toContain('ゆさぶられたとき');
        });

        test('akadako.temperature annotates sensor', () => {
            const labels = labelsAt(annotate('akadako.temperature'), 1);
            expect(labels).toContain('AkaDako');
            expect(labels).toContain('温度(°C)');
        });

        test('akadako.neopixel_fill_color("10", "red", 100) annotates with color label', () => {
            const labels = labelsAt(annotate('akadako.neopixel_fill_color("10", "red", 100)'), 1);
            expect(labels).toContain('AkaDako');
            expect(labels).toContain('カラーLEDの全色を設定');
            expect(labels).toContain('赤');
        });

        test('akadako.neopixel_shift_color("10", 1, "true") annotates with loop label', () => {
            const labels = labelsAt(annotate('akadako.neopixel_shift_color("10", 1, "true")'), 1);
            expect(labels).toContain('AkaDako');
            expect(labels).toContain('カラーLEDをずらす');
            expect(labels).toContain('回転する');
        });

        test('akadako.set_input_bias("10", "pullUp") annotates with bias label', () => {
            const labels = labelsAt(annotate('akadako.set_input_bias("10", "pullUp")'), 1);
            expect(labels).toContain('AkaDako');
            expect(labels).toContain('入力バイアス設定');
            expect(labels).toContain('プルアップする');
        });

        test('akadako.i2c_write("0x10", "0x01", "0xAB") annotates command', () => {
            const labels = labelsAt(annotate('akadako.i2c_write("0x10", "0x01", "0xAB")'), 1);
            expect(labels).toContain('AkaDako');
            expect(labels).toContain('I2C書き込み');
        });

        test('akadako.bit_not("0x01") annotates bitwise op', () => {
            const labels = labelsAt(annotate('akadako.bit_not("0x01")'), 1);
            expect(labels).toContain('AkaDako');
            expect(labels).toContain('ビットNOT');
        });

        test('akadako menu labels do not leak to other contexts', () => {
            const labels = labelsAt(annotate('set_input_bias("pullUp")'), 1);
            expect(labels).not.toContain('プルアップする');
        });
    });
    // === Smalruby: End of g2s furigana tests ===
});
