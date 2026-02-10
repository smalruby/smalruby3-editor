import sharedMessages from './shared-messages';

/**
 * Load a project into the VM with Smalruby-specific checks (Mesh V1, Koshien).
 * @param {VirtualMachine} vm The VM instance.
 * @param {Intl} intl The intl instance for localized messages.
 * @param {string | object} projectData The project data to load.
 * @param {string} currentRubyVersion The current Ruby version.
 * @param {Function} onSetRubyVersion Callback to set the Ruby version.
 * @returns {Promise} A promise that resolves when the project is loaded.
 */
const loadProjectWithChecks = (vm, intl, projectData, currentRubyVersion, onSetRubyVersion) =>
    vm.hasMeshV1Project(projectData)
        .then(hasMeshV1 => {
            let migrateMeshV1ToV2 = false;
            if (hasMeshV1) {
                migrateMeshV1ToV2 = !confirm( // eslint-disable-line no-alert
                    intl.formatMessage(sharedMessages.migrateMeshV1Warning)
                );
            }
            return vm.loadProject(projectData, {migrateMeshV1ToV2});
        })
        .then(() => vm.hasKoshienProject(projectData))
        .then(hasKoshien => {
            if (hasKoshien) {
                if (currentRubyVersion !== '1') {
                    alert(intl.formatMessage( // eslint-disable-line no-alert
                        sharedMessages.changedRubyVersionByKoshien
                    ));
                }
                onSetRubyVersion('1');
            }
        });

export {
    loadProjectWithChecks
};
