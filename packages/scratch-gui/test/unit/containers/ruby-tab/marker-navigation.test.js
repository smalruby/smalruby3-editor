import { MARKER_CONTROLLER_ID, closeMarkerNavigation } from '../../../../src/containers/ruby-tab/marker-navigation';

const fakeEditor = (controller) => ({
    getContribution: jest.fn((id) => (id === MARKER_CONTROLLER_ID ? controller : null)),
    trigger: jest.fn(),
});

describe('closeMarkerNavigation', () => {
    test('closes the widget without moving the focus to the editor when asked', () => {
        const controller = { close: jest.fn() };
        const editor = fakeEditor(controller);
        closeMarkerNavigation(editor, { focusEditor: false });
        expect(controller.close).toHaveBeenCalledWith(false);
        expect(editor.trigger).not.toHaveBeenCalled();
    });

    test('closes the widget with the focus in the editor by default, as the command does', () => {
        const controller = { close: jest.fn() };
        const editor = fakeEditor(controller);
        closeMarkerNavigation(editor);
        expect(controller.close).toHaveBeenCalledWith(true);
    });

    test('falls back to the command when the editor has no marker controller', () => {
        const editor = fakeEditor(null);
        closeMarkerNavigation(editor, { focusEditor: false });
        expect(editor.trigger).toHaveBeenCalledWith('source', 'closeMarkersNavigation');
    });
});
