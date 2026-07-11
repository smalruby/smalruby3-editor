import { ASSIGNMENT_TEMPLATES, getAssignmentTemplate } from '../../../src/lib/classroom-assignment-templates/index';
import {
    MAX_ASSIGNMENT_PAGES,
    MAX_ASSIGNMENT_PAGE_TEXT_LENGTH,
    validateEditorPages,
} from '../../../src/lib/classroom-assignment-utils';

describe('ASSIGNMENT_TEMPLATES', () => {
    test('every template fits the assignment editor limits', () => {
        for (const template of ASSIGNMENT_TEMPLATES) {
            expect(template.id).toMatch(/^[a-z0-9-]+$/);
            expect(template.title.length).toBeGreaterThan(0);
            expect(template.pages.length).toBeGreaterThan(0);
            expect(template.pages.length).toBeLessThanOrEqual(MAX_ASSIGNMENT_PAGES);
            for (const page of template.pages) {
                expect(page.text.length).toBeLessThanOrEqual(MAX_ASSIGNMENT_PAGE_TEXT_LENGTH);
            }
            // The pages must pass the same validation the editor applies
            expect(validateEditorPages(template.pages.map((p) => ({ text: p.text })))).toBeNull();
        }
    });

    test('template ids are unique', () => {
        const ids = ASSIGNMENT_TEMPLATES.map((t) => t.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    test('every template carries recommended rubric axes (1-6)', () => {
        for (const template of ASSIGNMENT_TEMPLATES) {
            expect(template.rubricAxes.length).toBeGreaterThanOrEqual(1);
            expect(template.rubricAxes.length).toBeLessThanOrEqual(6);
            for (const axis of template.rubricAxes) {
                expect(axis.name.length).toBeGreaterThan(0);
                expect(axis.name.length).toBeLessThanOrEqual(50);
            }
        }
    });
});

describe('getAssignmentTemplate', () => {
    test('finds by id and returns null for unknown', () => {
        expect(getAssignmentTemplate('programming-tanoshimou')?.title).toBe('プログラミングを楽しもう');
        expect(getAssignmentTemplate('no-such')).toBeNull();
    });
});
