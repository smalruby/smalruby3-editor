// Temporary: fails on purpose to check the CI annotations (#2506). Removed before merge.
describe('annotation check', () => {
    for (let i = 1; i <= 12; i++) {
        test(`fails on purpose ${i}`, () => {
            expect({value: i}).toEqual({value: i + 100});
        });
    }
});
