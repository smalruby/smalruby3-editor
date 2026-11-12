import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';

// private / protected / public have no block, so they are rejected wherever they are written (#1561).
describe('RubyToBlocksConverter: private / protected / public', () => {
    const convert = async code => {
        const converter = new RubyToBlocksConverter(null, {version: 2});
        await converter.targetCodeToBlocks(null, code);
        return converter;
    };

    const plainNotSupported = (name, source) =>
        `"${name}" is not supported in Smalruby.\nDelete "${source}".`;

    describe.each(['private', 'protected', 'public'])('%s', name => {
        test('directly inside a class', async () => {
            const converter = await convert(
                ['class Sprite1', `  ${name}`, '  def foo', '    move(10)', '  end', 'end'].join('\n'),
            );
            expect(converter.errors).toHaveLength(1);
            expect(converter.errors[0].row).toBe(1);
            expect(converter.errors[0].text).toBe(plainNotSupported(name, name));
        });

        test('with a method name directly inside a class', async () => {
            const converter = await convert(
                ['class Sprite1', '  def foo', '    move(10)', '  end', `  ${name} :foo`, 'end'].join('\n'),
            );
            expect(converter.errors).toHaveLength(1);
            expect(converter.errors[0].row).toBe(4);
            expect(converter.errors[0].text).toBe(plainNotSupported(name, `${name} :foo`));
        });

        test('with a method definition directly inside a class', async () => {
            const converter = await convert(
                ['class Sprite1', `  ${name} def foo`, '    move(10)', '  end', 'end'].join('\n'),
            );
            expect(converter.errors).toHaveLength(1);
            expect(converter.errors[0].row).toBe(1);
            expect(converter.errors[0].text).toBe(
                `"${name}" is not supported in Smalruby.` +
                    `\nDelete "${name}". Then the method from "def foo" to its "end" can be used.`,
            );
        });

        test('at the top level', async () => {
            const converter = await convert(`${name}\nmove(10)`);
            expect(converter.errors).toHaveLength(1);
            expect(converter.errors[0].row).toBe(0);
            expect(converter.errors[0].text).toBe(plainNotSupported(name, name));
        });

        test('inside an event block', async () => {
            const converter = await convert(
                ['class Sprite1', '  when_flag_clicked do', '    move(10)', `    ${name}`, '  end', 'end'].join(
                    '\n',
                ),
            );
            expect(converter.errors).toHaveLength(1);
            expect(converter.errors[0].row).toBe(3);
            expect(converter.errors[0].text).toBe(plainNotSupported(name, name));
        });

        test('inside a method definition', async () => {
            const converter = await convert(
                ['class Sprite1', '  def foo', `    ${name}`, '    move(10)', '  end', 'end'].join('\n'),
            );
            expect(converter.errors).toHaveLength(1);
            expect(converter.errors[0].row).toBe(2);
            expect(converter.errors[0].text).toBe(plainNotSupported(name, name));
        });

        test('inside a module', async () => {
            const converter = await convert(
                ['module Walk', `  ${name}`, '  def walk', '    move(10)', '  end', 'end'].join('\n'),
            );
            expect(converter.errors).toHaveLength(1);
            expect(converter.errors[0].row).toBe(1);
            expect(converter.errors[0].text).toBe(plainNotSupported(name, name));
        });

        test('with a method definition inside a module', async () => {
            const converter = await convert(
                ['module Walk', `  ${name} def walk`, '    move(10)', '  end', 'end'].join('\n'),
            );
            expect(converter.errors).toHaveLength(1);
            expect(converter.errors[0].row).toBe(1);
            expect(converter.errors[0].text).toMatch(/Then the method from "def walk" to its "end" can be used/);
        });
    });

    test('a method called private on a receiver is not rejected as a visibility modifier', async () => {
        const converter = await convert('when_flag_clicked do\n  self.private\nend');
        expect(converter.errors.length).toBeGreaterThan(0);
        expect(converter.errors[0].text).not.toMatch(/is not supported in Smalruby/);
    });

    describe.each(['private', 'protected', 'public'])('a custom block named %s', name => {
        test('is called without an error', async () => {
            const converter = await convert(
                ['class Sprite1', `  def ${name}`, '    move(10)', '  end', '  when_flag_clicked do', `    ${name}`,
                    '  end', 'end'].join('\n'),
            );
            expect(converter.errors).toHaveLength(0);
        });

        test('is used as a value without an error', async () => {
            const converter = await convert(
                ['class Sprite1', `  def ${name}`, '    10', '  end', '  when_flag_clicked do', `    say(${name})`,
                    '  end', 'end'].join('\n'),
            );
            expect(converter.errors).toHaveLength(0);
        });
    });

    test('a local variable named private is not rejected', async () => {
        const converter = await convert(
            ['class Sprite1', '  when_flag_clicked do', '    private = 1', '    say(private)', '  end', 'end'].join('\n'),
        );
        expect(converter.errors).toHaveLength(0);
    });

    test('the same class without private is converted', async () => {
        const converter = await convert(['class Sprite1', '  def foo', '    move(10)', '  end', 'end'].join('\n'));
        expect(converter.errors).toHaveLength(0);
    });
});
