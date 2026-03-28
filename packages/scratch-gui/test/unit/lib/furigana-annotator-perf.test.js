/**
 * Performance benchmark for FuriganaAnnotator.
 * Measures annotation time before/after the smalruby method expansion.
 *
 * Run with:
 *   npm exec jest --no-coverage test/unit/lib/furigana-annotator-perf.test.js --verbose
 */
import FuriganaAnnotator from '../../../src/lib/furigana-annotator';
import { loadPrism } from '../../../src/lib/prism-parser';

// A representative 100-line smalruby program covering many method types
const SAMPLE_100_LINES = `
when_flag_clicked do
  self.x = 0
  self.y = 0
  self.direction = 90
  self.size = 100
  self.volume = 80
  @score = 0
  $high_score = 0
  loop do
    move(10)
    if touching?("_edge_")
      bounce_if_on_edge
    end
    if Keyboard.pressed?("space")
      say("スペースキーが押された", 1)
      @score += 1
    end
    if Mouse.down?
      go_to([Mouse.x, Mouse.y])
    end
    if Timer.value > 10
      stop("all")
    end
  end
end

when_key_pressed("up arrow") do
  self.y += 10
end

when_key_pressed("down arrow") do
  self.y += -10
end

when_key_pressed("left arrow") do
  self.x += -10
end

when_key_pressed("right arrow") do
  self.x += 10
end

when_receive("reset") do
  @score = 0
  self.x = 0
  self.y = 0
  Timer.reset
end

def move_to_random
  go_to("_random_")
  sleep(0.5)
end

def check_score
  if @score >= 10
    say("クリア!", 2)
    broadcast("clear")
  elsif @score >= 5
    say("いいね!", 1)
  else
    think("がんばれ")
  end
end

def calculate(a, b)
  result = a + b
  result2 = a * b
  result3 = a - b
  result4 = a / b
  result5 = a % b
  return result
end

10.times do
  turn_right(36)
  move(20)
end

until touching?("_edge_")
  move(5)
  turn_left(2)
end

switch_costume("costume2")
next_costume
switch_backdrop("space")
set_effect("color", 25)
change_effect_by("brightness", 10)
clear_graphic_effects
show
hide
go_to_layer("front")
go_layers(2, "forward")

play("ニャー")
stop_all_sounds
set_sound_effect("PITCH", 100)
clear_sound_effects

show_variable("@score")
hide_variable("@score")
show_list("@items")

rand(1..10)
Math.sqrt(9)
Math.sin(90)
Math.cos(0)
Math.log(10)
`.trim();

describe('FuriganaAnnotator performance benchmark', () => {
    let prism;
    let annotator;

    beforeAll(async () => {
        prism = await loadPrism();
        annotator = new FuriganaAnnotator();
    });

    const measure = (label, code, iterations) => {
        const parsed = prism.parse(code);
        // Warm up
        for (let i = 0; i < 3; i++) {
            annotator.annotate(code, parsed);
        }
        const times = [];
        for (let i = 0; i < iterations; i++) {
            const start = performance.now();
            annotator.annotate(code, parsed);
            times.push(performance.now() - start);
        }
        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        const max = Math.max(...times);
        const min = Math.min(...times);
        console.log(
            `[PERF] ${label}: avg=${avg.toFixed(2)}ms min=${min.toFixed(2)}ms max=${max.toFixed(2)}ms (n=${iterations})`,
        );
        return { avg, max, min };
    };

    test('100-line program: avg annotation time < 50ms', () => {
        const { avg } = measure('100-line program', SAMPLE_100_LINES, 50);
        // 50ms budget per annotation — should be well within adaptive debounce tolerance
        expect(avg).toBeLessThan(50);
    });

    test('repeated annotation is stable (no memory leak pattern)', () => {
        const parsed = prism.parse(SAMPLE_100_LINES);
        const first = [];
        const last = [];
        for (let i = 0; i < 100; i++) {
            const start = performance.now();
            annotator.annotate(SAMPLE_100_LINES, parsed);
            const elapsed = performance.now() - start;
            if (i < 10) first.push(elapsed);
            if (i >= 90) last.push(elapsed);
        }
        const avgFirst = first.reduce((a, b) => a + b, 0) / first.length;
        const avgLast = last.reduce((a, b) => a + b, 0) / last.length;
        console.log(`[PERF] Stability: first10_avg=${avgFirst.toFixed(2)}ms last10_avg=${avgLast.toFixed(2)}ms`);
        // Last 10 should not be more than 3x slower than first 10 (no degradation)
        expect(avgLast).toBeLessThan(avgFirst * 3 + 10);
    });
});
