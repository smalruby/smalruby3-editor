const test = require('tap').test;
const VirtualMachine = require('../../src/index');
const sb3 = require('../../src/serialization/sb3');

// Issue #707: the Mesh v2 self-inclusive behavior is gated by a per-project
// flag persisted in project meta (`meta.smalruby.meshSelfInclusive`). Absent or
// false = legacy behavior, true = self-inclusive (new) behavior.

test('serialize writes meta.smalruby.meshSelfInclusive only when enabled', (t) => {
    const vm = new VirtualMachine();
    vm.runtime.meshSelfInclusive = true;
    const enabled = sb3.serialize(vm.runtime);
    t.equal(enabled.meta.smalruby.meshSelfInclusive, true, 'flag is persisted when enabled');

    vm.runtime.meshSelfInclusive = false;
    const disabled = sb3.serialize(vm.runtime);
    t.equal(disabled.meta.smalruby, undefined, 'no smalruby meta when disabled (default)');

    t.end();
});

test('deserialize restores meshSelfInclusive from meta', (t) => {
    const vm = new VirtualMachine();
    sb3.deserialize({ meta: { smalruby: { meshSelfInclusive: true } } }, vm.runtime).then(() => {
        t.equal(vm.runtime.meshSelfInclusive, true, 'enabled project sets the flag');

        // Loading a project without the flag must reset it (mirrors origin handling).
        return sb3.deserialize({ meta: {} }, vm.runtime).then(() => {
            t.equal(vm.runtime.meshSelfInclusive, false, 'absent flag resets to legacy behavior');
            t.end();
        });
    });
});

test('serialize -> deserialize roundtrip preserves the flag', (t) => {
    const vm = new VirtualMachine();
    vm.runtime.meshSelfInclusive = true;
    const serialized = sb3.serialize(vm.runtime);

    const vm2 = new VirtualMachine();
    sb3.deserialize(serialized, vm2.runtime).then(() => {
        t.equal(vm2.runtime.meshSelfInclusive, true, 'roundtrip preserves enabled flag');
        t.end();
    });
});
