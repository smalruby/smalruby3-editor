/**
 * Pure helpers for the teacher sidebar's group (組) hierarchy.
 *
 * Sections come in two kinds:
 *   {kind: 'group', groupId, name, year, classrooms}   — a real group (組)
 *   {kind: 'className', className, classrooms}         — legacy grouping by
 *       class-name string for classrooms not assigned to any group
 */

/**
 * Sort lessons within a section: assignment name, then newest first.
 * @param {Array<object>} classrooms - Classrooms of one section
 * @returns {Array<object>} Sorted copy
 */
const sortClassrooms = (classrooms) =>
    classrooms.slice().sort((a, b) => {
        const nameComp = (a.assignmentName || '').localeCompare(b.assignmentName || '', 'ja');
        if (nameComp !== 0) return nameComp;
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });

/**
 * Build the sidebar sections from classrooms and groups.
 * Active groups are always shown (even when empty, so a freshly created
 * group is visible); archived groups are hidden along with their classes
 * only if the classes are archived too — classes of an archived group fall
 * back to the className sections so nothing silently disappears.
 * @param {Array<object>} classrooms - Teacher's classrooms (non-expired)
 * @param {Array<object>} groups - Teacher's groups
 * @returns {Array<object>} Ordered sections
 */
const buildSidebarSections = (classrooms, groups) => {
    const activeGroups = (groups || [])
        .filter((g) => g.status === 'active')
        .sort((a, b) => {
            if ((b.year || 0) !== (a.year || 0)) return (b.year || 0) - (a.year || 0);
            return (a.name || '').localeCompare(b.name || '', 'ja');
        });
    const activeGroupIds = new Set(activeGroups.map((g) => g.groupId));

    const byGroup = new Map();
    const ungrouped = [];
    for (const c of classrooms || []) {
        if (c.groupId && activeGroupIds.has(c.groupId)) {
            if (!byGroup.has(c.groupId)) byGroup.set(c.groupId, []);
            byGroup.get(c.groupId).push(c);
        } else {
            ungrouped.push(c);
        }
    }

    const sections = activeGroups.map((g) => ({
        kind: 'group',
        groupId: g.groupId,
        name: g.name,
        year: g.year,
        classrooms: sortClassrooms(byGroup.get(g.groupId) || []),
    }));

    const byClassName = new Map();
    for (const c of ungrouped) {
        const name = c.className || '';
        if (!byClassName.has(name)) byClassName.set(name, []);
        byClassName.get(name).push(c);
    }
    const classNames = Array.from(byClassName.keys()).sort((a, b) => a.localeCompare(b, 'ja'));
    for (const name of classNames) {
        sections.push({
            kind: 'className',
            className: name,
            classrooms: sortClassrooms(byClassName.get(name)),
        });
    }
    return sections;
};

/**
 * Build the assignment board sections for one class (Google Classroom
 * style): assignments without a topic come first with no heading (topics
 * are opt-in — interview Q5), then one section per class topic, each
 * sorted by sortDate (fallback createdAt) descending. Topics that only
 * exist on assignments (stale after a class-list edit) are appended so
 * nothing disappears from the board.
 * @param {Array<object>} classrooms - assignments of the class
 * @param {Array<string>} topics - the class's topic list (order preserved)
 * @returns {Array<{topic: string|null, classrooms: Array<object>}>} sections
 */
const buildAssignmentSections = (classrooms, topics) => {
    const sortDesc = (a, b) =>
        String(b.sortDate || b.createdAt || '').localeCompare(String(a.sortDate || a.createdAt || ''));
    const sections = [];
    const untopiced = classrooms.filter((c) => !c.topic).sort(sortDesc);
    if (untopiced.length > 0) {
        sections.push({ topic: null, classrooms: untopiced });
    }
    for (const topic of topics || []) {
        sections.push({
            topic,
            classrooms: classrooms.filter((c) => c.topic === topic).sort(sortDesc),
        });
    }
    const known = new Set(topics || []);
    const strayTopics = [...new Set(classrooms.filter((c) => c.topic && !known.has(c.topic)).map((c) => c.topic))];
    for (const topic of strayTopics) {
        sections.push({
            topic,
            classrooms: classrooms.filter((c) => c.topic === topic).sort(sortDesc),
        });
    }
    return sections;
};

export { buildSidebarSections, buildAssignmentSections };
