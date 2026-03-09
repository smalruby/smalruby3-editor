// === Smalruby: This file is Smalruby-specific (Quick fix provider for Ruby-to-blocks conversion errors) ===

/**
 * Monaco CodeActionProvider that provides quick fixes for Ruby-to-blocks conversion errors.
 */
class QuickFixProvider {
    constructor () {
        this._vm = null;
    }

    setVM (vm) {
        this._vm = vm;
    }

    /**
     * Provide code actions for the given marker (error).
     * @param {object} model - Monaco editor model
     * @param {object} range - Range of the marker
     * @param {object} context - Context including markers and trigger
     * @param {object} _token - Cancellation token
     * @returns {object} List of code actions
     */
    provideCodeActions (model, range, context, _token) {
        const actions = [];
        for (const marker of context.markers) {
            if (marker.owner !== 'smalruby') continue;
            actions.push(...this._getActionsForMarker(model, marker));
        }
        return {actions, dispose: () => {}};
    }

    _getActionsForMarker (model, marker) {
        const msg = marker.message;
        const actions = [];

        // Variable scope error: suggest changing prefix
        const scopeMatch = msg.match(/^"([@$])([^"]+)",.*can't change variable scope/);
        if (scopeMatch) {
            const prefix = scopeMatch[1];
            const varName = scopeMatch[2];
            const newPrefix = prefix === '@' ? '$' : '@';
            const oldText = `${prefix}${varName}`;
            const newText = `${newPrefix}${varName}`;
            actions.push(this._createReplaceAction(
                model, marker,
                `Change to ${newText}`,
                oldText, newText
            ));
        }

        // Costume does not exist
        const costumeMatch = msg.match(/^costume "([^"]+)" does not exist/);
        if (costumeMatch) {
            const wrongName = costumeMatch[1];
            const costumes = this._getCostumeNames();
            for (const name of costumes) {
                if (name === wrongName) continue;
                actions.push(this._createReplaceAction(
                    model, marker,
                    `Change to "${name}"`,
                    `"${wrongName}"`, `"${name}"`
                ));
            }
        }

        // Backdrop does not exist
        const backdropMatch = msg.match(/^backdrop "([^"]+)" does not exist/);
        if (backdropMatch) {
            const wrongName = backdropMatch[1];
            const backdrops = this._getBackdropNames();
            for (const name of backdrops) {
                if (name === wrongName) continue;
                actions.push(this._createReplaceAction(
                    model, marker,
                    `Change to "${name}"`,
                    `"${wrongName}"`, `"${name}"`
                ));
            }
        }

        // Sound does not exist
        const soundMatch = msg.match(/^sound "([^"]+)" does not exist/);
        if (soundMatch) {
            const wrongName = soundMatch[1];
            const sounds = this._getSoundNames();
            for (const name of sounds) {
                if (name === wrongName) continue;
                actions.push(this._createReplaceAction(
                    model, marker,
                    `Change to "${name}"`,
                    `"${wrongName}"`, `"${name}"`
                ));
            }
        }

        return actions;
    }

    _createReplaceAction (model, marker, title, oldText, newText) {
        // Find the exact position of oldText in the marker's line
        const lineContent = model.getLineContent(marker.startLineNumber);
        const startIdx = lineContent.indexOf(oldText, marker.startColumn - 1);
        const range = startIdx >= 0 ?
            {
                startLineNumber: marker.startLineNumber,
                startColumn: startIdx + 1,
                endLineNumber: marker.startLineNumber,
                endColumn: startIdx + oldText.length + 1
            } :
            {
                startLineNumber: marker.startLineNumber,
                startColumn: marker.startColumn,
                endLineNumber: marker.endLineNumber,
                endColumn: marker.endColumn
            };

        return {
            title,
            diagnostics: [marker],
            kind: 'quickfix',
            edit: {
                edits: [{
                    resource: model.uri,
                    textEdit: {
                        range,
                        text: newText
                    },
                    versionId: model.getVersionId()
                }]
            }
        };
    }

    _getCostumeNames () {
        if (!this._vm || !this._vm.editingTarget) return [];
        const costumes = this._vm.editingTarget.getCostumes();
        return costumes ? costumes.map(c => c.name) : [];
    }

    _getBackdropNames () {
        if (!this._vm || !this._vm.runtime) return [];
        const stage = this._vm.runtime.getTargetForStage();
        if (!stage) return [];
        const backdrops = stage.getCostumes();
        return backdrops ? backdrops.map(b => b.name) : [];
    }

    _getSoundNames () {
        if (!this._vm || !this._vm.editingTarget) return [];
        const sounds = this._vm.editingTarget.getSounds();
        return sounds ? sounds.map(s => s.name) : [];
    }
}

export default QuickFixProvider;
