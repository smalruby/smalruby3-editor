import { formatClassLabel, formatStudentClassName } from '../../../src/lib/classroom-class-label.js';

describe('formatClassLabel', () => {
    test('should format name + year, appending the section only when set', () => {
        expect(formatClassLabel({ name: '技術', year: 2026 })).toBe('技術 2026年度');
        expect(formatClassLabel({ name: '技術', year: 2026, section: '2年1組' })).toBe('技術 2026年度 / 2年1組');
        expect(formatClassLabel(null)).toBe('');
    });
});

describe('formatStudentClassName', () => {
    test('should append the year for v2 sessions and stay unchanged for develop data', () => {
        expect(formatStudentClassName('技術', 2026)).toBe('技術 2026年度');
        expect(formatStudentClassName('2年1組', null)).toBe('2年1組');
        expect(formatStudentClassName('2年1組', undefined)).toBe('2年1組');
    });
});
