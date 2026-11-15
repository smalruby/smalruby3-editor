// Issue #1844: whether the project uses the mesh extension and whether it is connected,
// kept up to date from VM events (the stage-top mesh button shows only with mesh).
import { useEffect, useState } from 'react';

const EVENTS = ['EXTENSION_ADDED', 'PROJECT_LOADED', 'PERIPHERAL_CONNECTED', 'PERIPHERAL_DISCONNECTED'];

/**
 * @param {?object} vm - the VM.
 * @returns {{loaded: boolean, connected: boolean}} the mesh presence.
 */
const readMeshV2Presence = (vm) => {
    const loaded = Boolean(vm && vm.extensionManager && vm.extensionManager.isExtensionLoaded('meshV2'));
    const extension =
        loaded && vm.runtime && vm.runtime.peripheralExtensions && vm.runtime.peripheralExtensions.meshV2;
    return { loaded, connected: Boolean(extension && extension.connectionState === 'connected') };
};

/**
 * @param {?object} vm - the VM.
 * @returns {{loaded: boolean, connected: boolean}} the mesh presence (re-rendered on change).
 */
const useMeshV2Presence = (vm) => {
    const [presence, setPresence] = useState(() => readMeshV2Presence(vm));
    useEffect(() => {
        if (!vm || typeof vm.on !== 'function') return () => {};
        const update = () => {
            const next = readMeshV2Presence(vm);
            setPresence((prev) => (prev.loaded === next.loaded && prev.connected === next.connected ? prev : next));
        };
        // EXTENSION_ADDED is emitted while the extension is being registered, before
        // isExtensionLoaded() turns true, so read again after the current task.
        const timers = new Set();
        const updateSoon = () => {
            update();
            const timer = setTimeout(() => {
                timers.delete(timer);
                update();
            }, 0);
            timers.add(timer);
        };
        EVENTS.forEach((name) => vm.on(name, updateSoon));
        update();
        return () => {
            EVENTS.forEach((name) => vm.removeListener(name, updateSoon));
            timers.forEach((timer) => clearTimeout(timer));
        };
    }, [vm]);
    return presence;
};

export { readMeshV2Presence, useMeshV2Presence };
