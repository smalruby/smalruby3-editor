/* eslint-env jest */
/**
 * 共有推奨バナー CTA のグループ選択 (#1106)。共有ステップはボード内
 * サブビュー (= selectedGroup 必須) なので、未グループの課題や
 * selectedGroup が無い経路でも必ずグループを拾えることを pin する
 * (#1110 レビューと同型の「phase を戻さず無反応」欠陥の回帰テスト)。
 */
import { pickShareSuggestionGroup } from '../../../src/components/classroom-teacher-modal/classroom-teacher-modal.jsx';

const g = (groupId, over = {}) => ({ groupId, name: groupId, year: 2026, status: 'active', ...over });

describe('pickShareSuggestionGroup (#1106)', () => {
    test('prefers the classroom-owning group even when another group is selected', () => {
        const groups = [g('g1'), g('g2')];
        expect(pickShareSuggestionGroup({ groupId: 'g2' }, groups[0], groups)).toBe(groups[1]);
    });

    test('falls back to the selected group for ungrouped classrooms', () => {
        const groups = [g('g1')];
        expect(pickShareSuggestionGroup({ groupId: null }, groups[0], groups)).toBe(groups[0]);
    });

    test('falls back to the first active group when nothing is selected (class-list path)', () => {
        const groups = [g('g0', { status: 'archived' }), g('g1')];
        expect(pickShareSuggestionGroup({ groupId: 'unknown' }, null, groups)).toBe(groups[1]);
    });

    test('returns null when the teacher has no usable group', () => {
        expect(pickShareSuggestionGroup({ groupId: null }, null, [])).toBeNull();
        expect(pickShareSuggestionGroup({ groupId: null }, null, [g('g0', { status: 'archived' })])).toBeNull();
    });
});
