import { COURSES, challengeCodeFor, localizeCode } from '../../../../src/lib/lessons/courses';
import {
    DEFAULT_ROLE,
    ROLES,
    challengeForRole,
    formatRoleMessage,
    otherRole,
    roleOfChallenge,
    swapChallengeRoles,
    swapRoleText,
} from '../../../../src/lib/lessons/role-swap';

const allChallenges = () => COURSES.flatMap((c) => c.lessons.flatMap((l) => l.challenges));
const challenge = (id) => allChallenges().find((c) => c.id === id);
const LOCALES = ['ja', 'ja-Hira', 'en'];

describe('swapRoleText', () => {
    test('swaps Shimaraby and Shimacat in every locale, both ways', () => {
        expect(swapRoleText('シマラビのきぶん と シマネコのきぶん')).toBe('シマネコのきぶん と シマラビのきぶん');
        expect(swapRoleText('$shimaraby_message = answer\nbroadcast("shimacat_message")')).toBe(
            '$shimacat_message = answer\nbroadcast("shimaraby_message")',
        );
        expect(swapRoleText('Shimaraby says hi to Shimacat')).toBe('Shimacat says hi to Shimaraby');
        expect(swapRoleText('switch_costume("shimacat-b")')).toBe('switch_costume("shimaraby-b")');
        expect(swapRoleText('play("Meow")')).toBe('play("Chirp")');
    });

    test('does not change other names (ミミ, Mimi, なまえ)', () => {
        const text = 'ミミ：よろしくね / Mimi: hi / $なまえ / メッセージ';
        expect(swapRoleText(text)).toBe(text);
    });

    test('round-trips', () => {
        const text = 'シマラビがよんだ / shimacat_read / Shimaraby / Meow / Chirp / ミミ';
        expect(swapRoleText(swapRoleText(text))).toBe(text);
    });

    test('leaves non-strings as they are', () => {
        expect(swapRoleText(null)).toBeNull();
        expect(swapRoleText(3)).toBe(3);
    });
});

describe('roles', () => {
    test('the default role is Shimaraby, and the other role of each role', () => {
        expect(DEFAULT_ROLE).toBe(ROLES.SHIMARABY);
        expect(otherRole(ROLES.SHIMARABY)).toBe(ROLES.SHIMACAT);
        expect(otherRole(ROLES.SHIMACAT)).toBe(ROLES.SHIMARABY);
    });

    test('only the pair challenges where the names differ have roles (not 3-2, 4-4, 4-5)', () => {
        expect(
            allChallenges()
                .filter((c) => c.roles)
                .map((c) => c.id),
        ).toEqual([
            'chat-l3-mesh-variable',
            'chat-l4-send-once',
            'chat-l4-send-repeat',
            'chat-l4-both-ways',
            'chat-l5-read-receipt',
            'chat-l5-ng-word',
            'chat-l5-auto-reply',
            'chat-l5-password',
            'chat-l5-stamp',
        ]);
    });
});

describe('swapChallengeRoles', () => {
    const roleChallenges = allChallenges().filter((c) => c.roles);

    test.each(roleChallenges.map((c) => [c.id]))('%s round-trips', (id) => {
        const c = challenge(id);
        expect(swapChallengeRoles(swapChallengeRoles(c))).toEqual(c);
    });

    test.each(roleChallenges.map((c) => [c.id]))('%s swaps the answer, hints, setup and partner', (id) => {
        const c = challenge(id);
        const s = swapChallengeRoles(c);
        LOCALES.forEach((locale) => {
            const code = challengeCodeFor(c, locale);
            const swapped = challengeCodeFor(s, locale);
            expect(swapped.code).toBe(swapRoleText(code.code));
            expect(swapped.spriteCodes).toEqual(
                code.spriteCodes.map(({ sprite, code: ruby }) => ({
                    sprite: swapRoleText(sprite),
                    code: swapRoleText(ruby),
                })),
            );
            s.steps.forEach((step, i) =>
                expect(localizeCode(step.blocks, locale)).toBe(swapRoleText(localizeCode(c.steps[i].blocks, locale))),
            );
        });
        expect(s.setup.sprites).toEqual(['Shimacat', 'Shimaraby']);
        expect(s.partner.name.ja).toBe('シマラビ');
        // 判定・カード・名前・クイズは入れかえない
        expect(s.goal).toBe(c.goal);
        expect(s.name).toBe(c.name);
        expect(s.quiz).toBe(c.quiz);
        expect(s.id).toBe(c.id);
    });

    test('marks the swapped challenge, and roleOfChallenge reads it', () => {
        const c = challenge('chat-l3-mesh-variable');
        expect(swapChallengeRoles(c).roleSwapped).toBe(true);
        expect(roleOfChallenge(c)).toBe(ROLES.SHIMARABY);
        expect(roleOfChallenge(swapChallengeRoles(c))).toBe(ROLES.SHIMACAT);
        expect(roleOfChallenge(challenge('chat-l3-mesh-signal'))).toBeNull();
    });

    test('marks the messages so that they are swapped when shown', () => {
        const c = challenge('chat-l3-mesh-variable');
        const s = swapChallengeRoles(c);
        expect(s.task).toEqual({ ...c.task, roleSwapped: true });
        expect(s.steps[3].title).toEqual({ ...c.steps[3].title, roleSwapped: true });
    });
});

describe('challengeForRole', () => {
    const c = challenge('chat-l3-mesh-variable');

    test('the Shimaraby role and challenges without roles stay as they are', () => {
        expect(challengeForRole(c, ROLES.SHIMARABY)).toBe(c);
        expect(challengeForRole(c, null)).toBe(c);
        const noRoles = challenge('chat-l3-mesh-signal');
        expect(challengeForRole(noRoles, ROLES.SHIMACAT)).toBe(noRoles);
    });

    test('the Shimacat role gives the same swapped challenge every time', () => {
        const swapped = challengeForRole(c, ROLES.SHIMACAT);
        expect(swapped).not.toBe(c);
        expect(challengeForRole(c, ROLES.SHIMACAT)).toBe(swapped);
        expect(swapped.code.ja).toContain('$シマネコのきぶん');
    });
});

describe('formatRoleMessage', () => {
    const intl = { formatMessage: (d) => d.defaultMessage, messages: {} };

    test('formats and swaps the marked messages only', () => {
        expect(formatRoleMessage(intl, { id: 'x', defaultMessage: 'シマラビ' })).toBe('シマラビ');
        expect(formatRoleMessage(intl, { id: 'x', defaultMessage: 'シマラビ', roleSwapped: true })).toBe('シマネコ');
        expect(formatRoleMessage(intl, null)).toBe('');
    });

    test('uses a hand-written text for the Shimacat role from the shown locale (<id>.asShimacat)', () => {
        const withOverride = { formatMessage: (d) => d.defaultMessage, messages: { 'x.asShimacat': '手で書いた文' } };
        expect(formatRoleMessage(withOverride, { id: 'x', defaultMessage: 'シマラビ', roleSwapped: true })).toBe(
            '手で書いた文',
        );
        // シマラビの役（印なし）では使わない
        expect(formatRoleMessage(withOverride, { id: 'x', defaultMessage: 'シマラビ' })).toBe('シマラビ');
    });
});
