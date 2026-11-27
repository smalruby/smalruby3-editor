// 標準課題（リポジトリの assignments/）の決まりごとを確かめる。
// assignments/ は smalruby.app/assignments/ に公開され、課題テンプレートが JSON を読むので、
// 形が崩れたり、最新（<id>/）と固定の版（<id>/<版>/）の中身がずれたりしないようにする。
import fs from 'fs';
import path from 'path';
import { COURSES, courseLessons } from '../../src/lib/lessons/courses.js';

const ROOT = path.resolve(__dirname, '../../../../assignments');
const readJson = (...p) => JSON.parse(fs.readFileSync(path.join(ROOT, ...p), 'utf8'));
const exists = (...p) => fs.existsSync(path.join(ROOT, ...p));
const sameBytes = (a, b) => fs.readFileSync(path.join(ROOT, ...a)).equals(fs.readFileSync(path.join(ROOT, ...b)));

const VERSION_RE = /^\d+\.\d+\.\d+$/;
const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const index = readJson('index.json');
const seriesList = index.series.map((s) => readJson(s.id, 'series.json'));
const assignmentIds = seriesList.flatMap((s) => s.assignments);
const assignments = assignmentIds.map((id) => readJson(id, 'assignment.json'));

const versionDirs = (id) =>
    fs
        .readdirSync(path.join(ROOT, id), { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);

const compareVersions = (a, b) => {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        if (pa[i] !== pb[i]) return pa[i] - pb[i];
    }
    return 0;
};

// 最新（<id>/）が一番新しい版と同じ中身であること
const expectLatestMatchesNewestVersion = (id, metaName, meta) => {
    const versions = versionDirs(id);
    expect(versions.length).toBeGreaterThan(0);
    versions.forEach((v) => expect(v).toMatch(VERSION_RE));
    const newest = [...versions].sort(compareVersions).pop();
    expect(meta.version).toBe(newest);
    expect(sameBytes([id, metaName], [id, newest, metaName])).toBe(true);
    meta.files.forEach((f) => {
        expect(exists(id, newest, f.file)).toBe(true);
        expect(sameBytes([id, f.file], [id, newest, f.file])).toBe(true);
    });
    // 固定の版の説明は、その版の番号を持つ
    versions.forEach((v) => {
        const metaFile = readJson(id, v, metaName);
        expect(metaFile.id).toBe(id);
        expect(metaFile.version).toBe(v);
    });
};

describe('standard assignments (assignments/)', () => {
    test('index.json lists every series with its assignments', () => {
        expect(index.schemaVersion).toBe(1);
        expect(index.license).toBe('CC0-1.0');
        expect(index.series.length).toBeGreaterThan(0);
        index.series.forEach((entry, i) => {
            const series = seriesList[i];
            expect(entry.version).toBe(series.version);
            expect(entry.title).toBe(series.title);
            expect(entry.assignments.map((a) => a.id)).toEqual(series.assignments);
            entry.assignments.forEach((a) => {
                const meta = readJson(a.id, 'assignment.json');
                expect(a.version).toBe(meta.version);
                expect(a.number).toBe(meta.number);
                expect(a.title).toBe(meta.title);
            });
        });
    });

    test('ids are unique, lowercase and start with the series id', () => {
        const all = [...seriesList.map((s) => s.id), ...assignmentIds];
        expect(new Set(all).size).toBe(all.length);
        all.forEach((id) => expect(id).toMatch(ID_RE));
        seriesList.forEach((s) => s.assignments.forEach((id) => expect(id.startsWith(`${s.id}-`)).toBe(true)));
    });

    test('each series: latest equals the newest fixed version', () => {
        seriesList.forEach((s) => {
            expect(s.schemaVersion).toBe(1);
            expect(s.license).toBe('CC0-1.0');
            expectLatestMatchesNewestVersion(s.id, 'series.json', s);
        });
    });

    test('each assignment: required fields, whole hours, no starter yet', () => {
        assignments.forEach((a, i) => {
            expect(a.schemaVersion).toBe(1);
            expect(a.id).toBe(assignmentIds[i]);
            expect(a.version).toMatch(VERSION_RE);
            expect(a.license).toBe('CC0-1.0');
            // ふつうは 1 時間 = 1 課題。問題解決のように何時間も同じものを作る課題だけ、2 時間以上にする（#2360）
            expect({ id: a.id, hours: Number.isInteger(a.hours) && a.hours >= 1 }).toEqual({ id: a.id, hours: true });
            expect(a.starter).toBeNull();
            expect(typeof a.title).toBe('string');
            expect(typeof a.goal).toBe('string');
            expect(seriesList.some((s) => s.id === a.series && s.assignments.includes(a.id))).toBe(true);
        });
    });

    // 2 時間以上の課題は、時間ごとの流れ（`schedule`。1 時間に 1 つ）を持つ。ワークシートのページは、流れのページを順に
    // 合わせたもの。1 時間の課題には `schedule` を書かない（#2360）
    test('an assignment of 2 hours or more has the flow of each hour', () => {
        assignments.forEach((a) => {
            if (a.hours === 1) {
                expect({ id: a.id, schedule: a.schedule }).toEqual({ id: a.id, schedule: undefined });
                return;
            }
            expect({ id: a.id, length: a.schedule.length }).toEqual({ id: a.id, length: a.hours });
            a.schedule.forEach((step) => {
                expect(typeof step.title).toBe('string');
                expect(typeof step.goal).toBe('string');
                expect(step.worksheetPages.length).toBeGreaterThan(0);
            });
            expect([...new Set(a.schedule.flatMap((step) => step.worksheetPages))]).toEqual(a.worksheetPages);
        });
    });

    test('a series takes as many hours as its assignments', () => {
        seriesList
            .filter((s) => s.hours !== undefined)
            .forEach((s) => {
                const sum = s.assignments.reduce((total, id) => total + readJson(id, 'assignment.json').hours, 0);
                expect({ id: s.id, hours: sum }).toEqual({ id: s.id, hours: s.hours });
            });
    });

    // 計測・制御の後半（ワークシート 8〜12 ページ: 課題発見 → 設計 → 制作とデバッグ → 発表 → 改修）は 1 つの課題（#2360）
    test('the control unit does its problem solving in one assignment of 5 hours', () => {
        const series = readJson('jhs-tech-d3-control', 'series.json');
        expect(series.hours).toBe(10);
        expect(series.assignments).toHaveLength(6);
        const a = readJson('jhs-tech-d3-control-06-problem-solving', 'assignment.json');
        expect(a.number).toBe(6);
        expect(a.hours).toBe(5);
        expect(a.worksheetPages).toEqual([8, 9, 10, 11, 12]);
        expect(a.schedule.map((step) => step.worksheetPages)).toEqual([[8], [9], [10], [10], [11, 12]]);
        expect(a.submit).toEqual({ project: '06_◯◯システム', worksheet: true });
    });

    test('each assignment: latest equals the newest fixed version', () => {
        assignments.forEach((a) => expectLatestMatchesNewestVersion(a.id, 'assignment.json', a));
    });

    test('each assignment numbers follow the series order', () => {
        seriesList.forEach((s) => {
            s.assignments.forEach((id, i) => expect(readJson(id, 'assignment.json').number).toBe(i + 1));
        });
    });

    test('lessons referenced by an assignment exist in the lesson courses', () => {
        assignments.forEach((a) => {
            a.lessons.forEach((ref) => {
                const course = COURSES.find((c) => c.id === ref.course);
                expect(course).toBeDefined();
                (ref.lessons || []).forEach((lessonId) => {
                    // レッスン 0（warmup。コースの数に入れない）も課題から指してよい
                    expect(courseLessons(course).map((l) => l.id)).toContain(lessonId);
                });
                const challengeIds = courseLessons(course).flatMap((l) => l.challenges.map((c) => c.id));
                (ref.challenges || []).forEach((challengeId) => {
                    expect(challengeIds).toContain(challengeId);
                });
            });
        });
    });

    test('the catalog page links every assignment and its files', () => {
        const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
        seriesList.forEach((s) => {
            s.files.forEach((f) => expect(html).toContain(`href="${s.id}/${f.file}"`));
        });
        assignments.forEach((a) => {
            a.files.forEach((f) => expect(html).toContain(`href="${a.id}/${f.file}"`));
        });
    });

    test('files have a known kind and audience', () => {
        const KINDS = ['worksheet', 'rubric', 'map', 'script'];
        [...seriesList, ...assignments].forEach((m) => {
            m.files.forEach((f) => {
                expect(KINDS).toContain(f.kind);
                expect(['student', 'teacher']).toContain(f.audience);
            });
        });
    });

    test('ids start with the school type', () => {
        [...seriesList, ...assignments].forEach((m) => {
            expect(['es', 'jhs']).toContain(m.schoolType);
            expect(m.id.startsWith(`${m.schoolType}-`)).toBe(true);
        });
    });

    test('the first step has the editor map and the teacher script', () => {
        const firstStep = readJson('es-pg-kyou-kara-programmer-01-first-step', 'assignment.json');
        expect(firstStep.files).toEqual([
            { file: 'map.pdf', kind: 'map', audience: 'student' },
            { file: 'script.pdf', kind: 'script', audience: 'teacher' },
        ]);
        expect(firstStep.lessons).toEqual([{ course: 'kyou-kara-programmer', lessons: ['blocks-l0', 'blocks-l1'] }]);
    });

    test('files stay small enough to ship with the editor', () => {
        const LIMIT = 3 * 1024 * 1024;
        [...seriesList, ...assignments].forEach((m) => {
            m.files.forEach((f) => {
                expect(fs.statSync(path.join(ROOT, m.id, f.file)).size).toBeLessThan(LIMIT);
            });
        });
    });
});
