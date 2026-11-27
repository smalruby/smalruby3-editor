// Temporary: fails to run on purpose to check the CI annotations (#2506). Removed before merge.
require('./this-module-does-not-exist');

test('never runs', () => {});
