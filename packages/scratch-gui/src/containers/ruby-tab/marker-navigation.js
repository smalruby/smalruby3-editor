// === Smalruby: This file is Smalruby-specific (closes the error widget of Monaco) ===

/** The ID of the contribution of Monaco that shows the error widget (`editor.action.marker.next`). */
const MARKER_CONTROLLER_ID = 'editor.contrib.markerController';

/**
 * Close the error widget that `editor.action.marker.next` opened.
 *
 * The command `closeMarkersNavigation` of Monaco always moves the focus to the
 * editor, even when no widget is open. Clearing the errors at the run button
 * then takes the focus back from the button: in the Japanese mode the editor
 * is in the write mode again while it runs, and the program written back
 * after the run keeps it there (Issue #2553). The controller itself can close
 * the widget and leave the focus where it is.
 * @param {object} editor - The Monaco editor.
 * @param {object} [options] - Options.
 * @param {boolean} [options.focusEditor] - Whether to move the focus to the
 *   editor, as the command does.
 */
const closeMarkerNavigation = (editor, { focusEditor = true } = {}) => {
    const controller = typeof editor.getContribution === 'function' && editor.getContribution(MARKER_CONTROLLER_ID);
    if (controller && typeof controller.close === 'function') {
        controller.close(focusEditor);
        return;
    }
    editor.trigger('source', 'closeMarkersNavigation');
};

export { MARKER_CONTROLLER_ID, closeMarkerNavigation };
