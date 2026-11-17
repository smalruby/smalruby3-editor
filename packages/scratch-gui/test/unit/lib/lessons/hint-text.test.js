import { hintStepTitle, isSeatedStudent, splitEmphasis } from '../../../../src/lib/lessons/hint-text';

describe('splitEmphasis', () => {
    test('marks the text between ** as strong', () => {
        expect(splitEmphasis('まず**シマラビをえらびなおして**、置こう。')).toEqual([
            { text: 'まず', strong: false },
            { text: 'シマラビをえらびなおして', strong: true },
            { text: '、置こう。', strong: false },
        ]);
    });

    test('works at the start and the end, and with several parts', () => {
        expect(splitEmphasis('**Select Shimaraby again** and **then** add it')).toEqual([
            { text: 'Select Shimaraby again', strong: true },
            { text: ' and ', strong: false },
            { text: 'then', strong: true },
            { text: ' add it', strong: false },
        ]);
    });

    test('text without ** is one plain part', () => {
        expect(splitEmphasis('ふつうの ぶん')).toEqual([{ text: 'ふつうの ぶん', strong: false }]);
    });

    test('an unclosed ** stays as it is', () => {
        expect(splitEmphasis('2 ** 3 は 8')).toEqual([{ text: '2 ** 3 は 8', strong: false }]);
    });

    test('markup in the text stays text (it is not HTML)', () => {
        expect(splitEmphasis('**<b>x</b>**')).toEqual([{ text: '<b>x</b>', strong: true }]);
    });

    test('empty or not a string gives no parts', () => {
        expect(splitEmphasis('')).toEqual([]);
        expect(splitEmphasis(null)).toEqual([]);
    });
});

describe('hintStepTitle', () => {
    const title = { id: 'a' };
    const classroomTitle = { id: 'b' };

    test('a student in a class gets the classroom text when the step has one', () => {
        expect(hintStepTitle({ title, classroomTitle }, { inClassroom: true })).toBe(classroomTitle);
    });

    test('outside a class (or without a classroom text) it is the usual text', () => {
        expect(hintStepTitle({ title, classroomTitle }, { inClassroom: false })).toBe(title);
        expect(hintStepTitle({ title, classroomTitle })).toBe(title);
        expect(hintStepTitle({ title }, { inClassroom: true })).toBe(title);
    });

    test('no step or no title gives null', () => {
        expect(hintStepTitle(null, { inClassroom: true })).toBeNull();
        expect(hintStepTitle({ target: 'stage' })).toBeNull();
    });
});

describe('isSeatedStudent', () => {
    test('a student who joined a class with a seat number', () => {
        expect(isSeatedStudent({ role: 'student', joinCode: 'ABC123', seatNumber: 3 })).toBe(true);
    });

    test('not a teacher, not outside a class, not a student without a seat number', () => {
        expect(isSeatedStudent({ teacherSelection: { joinCode: 'ABC123' } })).toBe(false);
        expect(isSeatedStudent({ role: null, joinCode: null })).toBe(false);
        expect(isSeatedStudent({ role: 'student', joinCode: 'ABC123', seatNumber: null })).toBe(false);
        expect(isSeatedStudent(null)).toBe(false);
    });
});
