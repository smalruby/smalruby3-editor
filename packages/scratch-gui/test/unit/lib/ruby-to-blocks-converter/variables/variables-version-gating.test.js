// === Smalruby: This file is Smalruby-specific (version gating for array vs list syntax) ===
import RubyToBlocksConverter from '../../../../../src/lib/ruby-to-blocks-converter';

describe('RubyToBlocksConverter/Variables/VersionGating', () => {
    let target;

    beforeEach(() => {
        target = null;
    });

    describe('v1: array syntax is rejected', () => {
        let v1Converter;

        beforeEach(() => {
            v1Converter = new RubyToBlocksConverter(null, {version: '1'});
        });

        test('$a.push("thing") is rejected in v1', async () => {
            const res = await v1Converter.targetCodeToBlocks(target, '$a.push("thing")');
            expect(res).toBeFalsy();
            expect(v1Converter.errors).toHaveLength(1);
            expect(v1Converter.errors[0].text).toContain('version 2');
        });

        test('$a << "thing" is rejected in v1', async () => {
            const res = await v1Converter.targetCodeToBlocks(target, '$a << "thing"');
            expect(res).toBeFalsy();
            expect(v1Converter.errors).toHaveLength(1);
            expect(v1Converter.errors[0].text).toContain('version 2');
        });

        test('$a.delete_at(0) is rejected in v1', async () => {
            const res = await v1Converter.targetCodeToBlocks(target, '$a.delete_at(0)');
            expect(res).toBeFalsy();
            expect(v1Converter.errors).toHaveLength(1);
            expect(v1Converter.errors[0].text).toContain('version 2');
        });

        test('$a.clear is rejected in v1', async () => {
            const res = await v1Converter.targetCodeToBlocks(target, '$a.clear');
            expect(res).toBeFalsy();
            expect(v1Converter.errors).toHaveLength(1);
            expect(v1Converter.errors[0].text).toContain('version 2');
        });

        test('$a.insert(0, "thing") is rejected in v1', async () => {
            const res = await v1Converter.targetCodeToBlocks(target, '$a.insert(0, "thing")');
            expect(res).toBeFalsy();
            expect(v1Converter.errors).toHaveLength(1);
            expect(v1Converter.errors[0].text).toContain('version 2');
        });

        test('$a[0] = "thing" is rejected in v1', async () => {
            const res = await v1Converter.targetCodeToBlocks(target, '$a[0] = "thing"');
            expect(res).toBeFalsy();
            expect(v1Converter.errors).toHaveLength(1);
            expect(v1Converter.errors[0].text).toContain('version 2');
        });

        test('$a[0] is rejected in v1', async () => {
            const res = await v1Converter.targetCodeToBlocks(target, '$a[0]');
            expect(res).toBeFalsy();
            expect(v1Converter.errors).toHaveLength(1);
            expect(v1Converter.errors[0].text).toContain('version 2');
        });

        test('$a.index("thing") is rejected in v1', async () => {
            const res = await v1Converter.targetCodeToBlocks(target, '$a.index("thing")');
            expect(res).toBeFalsy();
            expect(v1Converter.errors).toHaveLength(1);
            expect(v1Converter.errors[0].text).toContain('version 2');
        });

        test('$a.length is rejected in v1', async () => {
            const res = await v1Converter.targetCodeToBlocks(target, '$a.length');
            expect(res).toBeFalsy();
            expect(v1Converter.errors).toHaveLength(1);
            expect(v1Converter.errors[0].text).toContain('version 2');
        });

        test('$a.include?("thing") is rejected in v1', async () => {
            const res = await v1Converter.targetCodeToBlocks(target, '$a.include?("thing")');
            expect(res).toBeFalsy();
            expect(v1Converter.errors).toHaveLength(1);
            expect(v1Converter.errors[0].text).toContain('version 2');
        });

        test('$a = [1, 2, 3] is rejected in v1', async () => {
            const res = await v1Converter.targetCodeToBlocks(target, '$a = [1, 2, 3]');
            expect(res).toBeFalsy();
            expect(v1Converter.errors).toHaveLength(1);
            expect(v1Converter.errors[0].text).toContain('version 2');
        });

        test('list("$a").push("thing") still works in v1', async () => {
            const res = await v1Converter.targetCodeToBlocks(target, 'list("$a").push("thing")');
            expect(res).toBeTruthy();
            expect(v1Converter.errors).toHaveLength(0);
        });
    });

    describe('v2: list() syntax is rejected', () => {
        let v2Converter;

        beforeEach(() => {
            v2Converter = new RubyToBlocksConverter(null, {version: '2'});
        });

        test('list("$a") is rejected in v2', async () => {
            const res = await v2Converter.targetCodeToBlocks(target, 'list("$a")');
            expect(res).toBeFalsy();
            expect(v2Converter.errors).toHaveLength(1);
            expect(v2Converter.errors[0].text).toContain('version 1');
        });

        test('list("$a").push("thing") is rejected in v2', async () => {
            const res = await v2Converter.targetCodeToBlocks(target, 'list("$a").push("thing")');
            expect(res).toBeFalsy();
            expect(v2Converter.errors).toHaveLength(1);
            expect(v2Converter.errors[0].text).toContain('version 1');
        });

        test('list("@a").clear is rejected in v2', async () => {
            const res = await v2Converter.targetCodeToBlocks(target, 'list("@a").clear');
            expect(res).toBeFalsy();
            expect(v2Converter.errors).toHaveLength(1);
            expect(v2Converter.errors[0].text).toContain('version 1');
        });

        test('$a.push("thing") still works in v2', async () => {
            const res = await v2Converter.targetCodeToBlocks(target, '$a.push("thing")');
            expect(res).toBeTruthy();
            expect(v2Converter.errors).toHaveLength(0);
        });
    });
});
