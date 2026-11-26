// === Smalruby: This file is Smalruby-specific (save the Japanese program as a text file) ===

/**
 * The name of the file the Japanese program is saved to (Issue #2453). Same
 * shape as the screenshots of the Ruby tab (`<作品>_<スプライト>_ruby.png`).
 * @param {string} projectTitle - The title of the project.
 * @param {string} spriteName - The name of the sprite (or the stage) the program is of.
 * @returns {string} The name of the file.
 */
const dnclTextFilename = (projectTitle, spriteName) =>
    `${projectTitle || 'project'}_${spriteName || 'sprite'}_japanese.txt`;

/**
 * The Japanese program as a text file in UTF-8, as the editor shows it
 * without the line numbers and the rules, so that it can be loaded again.
 * @param {string} text - The text of the editor.
 * @returns {Blob} The text file.
 */
const dnclTextBlob = (text) => new Blob([text || ''], { type: 'text/plain;charset=utf-8' });

export { dnclTextBlob, dnclTextFilename };
