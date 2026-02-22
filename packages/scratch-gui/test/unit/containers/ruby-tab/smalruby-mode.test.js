import {smalrubyLanguageConfiguration} from '../../../../src/containers/ruby-tab/smalruby-mode';

describe('smalrubyLanguageConfiguration', () => {
    describe('indentationRules', () => {
        let increasePattern;
        let decreasePattern;

        beforeEach(() => {
            increasePattern = smalrubyLanguageConfiguration.indentationRules.increaseIndentPattern;
            decreasePattern = smalrubyLanguageConfiguration.indentationRules.decreaseIndentPattern;
        });

        describe('increaseIndentPattern', () => {
            const shouldIncrease = [
                'def foo',
                'class Foo',
                'module Foo',
                'if x > 0',
                'unless x > 0',
                'elsif x > 0',
                'else',
                'case x',
                'when 1',
                'while x > 0',
                'until x > 0',
                'for i in 1..10',
                'begin',
                'do',
                '3.times do',
                'loop do',
                'rescue',
                'ensure',
                '  if x > 0',
                '  def foo'
            ];

            shouldIncrease.forEach(line => {
                test(`should match: "${line}"`, () => {
                    expect(increasePattern.test(line)).toBe(true);
                });
            });

            const shouldNotIncrease = [
                'end',
                'x = 1',
                'move(10)',
                'puts "hello"',
                'if x > 0 then y end',
                '# if comment'
            ];

            shouldNotIncrease.forEach(line => {
                test(`should not match: "${line}"`, () => {
                    expect(increasePattern.test(line)).toBe(false);
                });
            });
        });

        describe('decreaseIndentPattern', () => {
            const shouldDecrease = [
                'end',
                'else',
                'elsif x > 0',
                'rescue',
                'rescue => e',
                'ensure',
                'when 1',
                'when "hello"',
                '  end',
                '  else',
                '  elsif x > 0',
                '  when 1'
            ];

            shouldDecrease.forEach(line => {
                test(`should match: "${line}"`, () => {
                    expect(decreasePattern.test(line)).toBe(true);
                });
            });

            const shouldNotDecrease = [
                'def foo',
                'if x > 0',
                'x = 1',
                'move(10)',
                'puts "hello"',
                'send',
                'blend',
                'render',
                // Smalruby API uses when as part of method names
                'when_key_pressed',
                'when_flag_clicked',
                'self.when(:flag_clicked)',
                'when_receive("message")',
                // "when" alone (without trailing space) should not
                // trigger dedent to avoid false positives while typing
                'when'
            ];

            shouldNotDecrease.forEach(line => {
                test(`should not match: "${line}"`, () => {
                    expect(decreasePattern.test(line)).toBe(false);
                });
            });
        });
    });
});
