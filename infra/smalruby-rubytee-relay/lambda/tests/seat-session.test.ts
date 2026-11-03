import { isSessionTokenFormat, seatIdentityFromMembership } from '../seat-session';

describe('isSessionTokenFormat', () => {
  test('クラス管理の sessionToken（UUID）だけを通す', () => {
    expect(isSessionTokenFormat('3b241101-e2bb-4255-8caf-4136c566a962')).toBe(true);
  });

  test('UUID でない値・文字列でない値は通さない（表を引かない）', () => {
    expect(isSessionTokenFormat(undefined)).toBe(false);
    expect(isSessionTokenFormat('')).toBe(false);
    expect(isSessionTokenFormat('not-a-token')).toBe(false);
    expect(isSessionTokenFormat('3b241101-e2bb-4255-8caf-4136c566a962x')).toBe(false);
    expect(isSessionTokenFormat(123)).toBe(false);
    expect(isSessionTokenFormat({ token: 'x' })).toBe(false);
  });
});

describe('seatIdentityFromMembership', () => {
  test('memberId（seat-03）から出席番号の数字を取り出す', () => {
    expect(seatIdentityFromMembership({ classroomId: 'c1', memberId: 'seat-03', sessionToken: 't' }))
      .toEqual({ classroom: 'c1', seat: '3' });
  });

  test('kicked の行は席として認めない', () => {
    expect(seatIdentityFromMembership({ classroomId: 'c1', memberId: 'seat-03', kicked: true })).toBeNull();
  });

  test('行が無い・形が違う行は認めない', () => {
    expect(seatIdentityFromMembership(undefined)).toBeNull();
    expect(seatIdentityFromMembership({ classroomId: 'c1' })).toBeNull();
    expect(seatIdentityFromMembership({ classroomId: 'c1', memberId: 'teacher' })).toBeNull();
    expect(seatIdentityFromMembership({ classroomId: 5, memberId: 'seat-01' })).toBeNull();
  });

  test('席のキーが 2 通りに読める classroomId（: を含む）は認めない', () => {
    expect(seatIdentityFromMembership({ classroomId: 'a:b', memberId: 'seat-01' })).toBeNull();
  });
});
