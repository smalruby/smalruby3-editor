import sharedMessages from './shared-messages';
import { ProjectLoadError } from './url-loader';

/**
 * Best-effort restore of a previously-serialized project into the VM.
 *
 * `vm.loadProject()` disposes the current runtime *before* deserializing, so a
 * failed load leaves the editor empty (the reported "初期画面に戻る" bug, #972).
 * Reloading the pre-load snapshot puts the user back where they were. Restore
 * failures are swallowed so the original load error is the one surfaced.
 * @param {VirtualMachine} vm The VM instance.
 * @param {?string} previousProjectJSON Serialized project JSON, or null to skip.
 * @returns {Promise} Resolves when restore finishes (or is skipped).
 */
const restorePreviousProject = (vm, previousProjectJSON) => {
    if (!previousProjectJSON) {
        return Promise.resolve();
    }
    return vm.loadProject(previousProjectJSON).catch(() => {
        // Restore is best-effort; ignore restore failures.
    });
};

/**
 * Load a project into the VM with Smalruby-specific checks (Mesh V1 auto-migration).
 *
 * If the new project fails to load, the previously-loaded project is restored
 * so the editor is never stranded on an empty initial screen, and the original
 * error is rethrown wrapped in `ProjectLoadError` so callers can show a clearer
 * "this project may not be supported" message (#972).
 * @param {VirtualMachine} vm The VM instance.
 * @param {Intl} intl The intl instance for localized messages.
 * @param {string | object} projectData The project data to load.
 * @returns {Promise} A promise that resolves when the project is loaded.
 */
const loadProjectWithChecks = (vm, intl, projectData) => {
    // Snapshot the currently-loaded project *before* vm.loadProject() disposes
    // it, so we can restore it if the new project fails to load (#972).
    let previousProjectJSON = null;
    try {
        previousProjectJSON = vm.toJSON();
    } catch (_e) {
        // Nothing (safely) serializable to snapshot; proceed without restore.
        previousProjectJSON = null;
    }

    return vm.hasMeshV1Project(projectData).then((hasMeshV1) => {
        if (hasMeshV1) {
            // eslint-disable-next-line no-alert
            alert(intl.formatMessage(sharedMessages.meshV1AutoMigrated));
        }
        return vm.loadProject(projectData, { migrateMeshV1ToV2: hasMeshV1 }).catch((error) =>
            restorePreviousProject(vm, previousProjectJSON).then(() => {
                throw new ProjectLoadError(error);
            }),
        );
    });
};

export { loadProjectWithChecks };
