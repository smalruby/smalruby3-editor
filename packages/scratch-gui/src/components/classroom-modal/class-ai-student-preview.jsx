/**
 * A small drawing of the students' screen next to the class AI settings
 * (issue #1290): which AI the students will see, following the unsaved choices.
 * Drawn with CSS only (no screenshots), so it is cheap to keep in step when the
 * real screen changes: the "Ask AI" face of genai-concierge at the bottom left of
 * both the Code tab and the Ruby tab, and 「ルビティーにまかせる」 in its panel (#1417).
 */
import PropTypes from 'prop-types';
import React from 'react';
import { FormattedMessage } from 'react-intl';

import styles from './class-ai-student-preview.css';

const BLOCKS = ['hat', 'motion', 'motion', 'looks'];
const CODE_LINES = [70, 55, 80, 40];

const Face = ({ testId }) => (
    <span className={styles.consult} data-testid={testId}>
        <span className={styles.face}>{'AI'}</span>
        <FormattedMessage
            defaultMessage="Ask AI"
            description="Label of the face students see on the Code and Ruby screens when the class uses a generative AI"
            id="gui.classroom.classAi.previewConsult"
        />
    </span>
);

Face.propTypes = {
    testId: PropTypes.string.isRequired,
};

const ClassAiStudentPreview = ({ genai, rubytee }) => {
    let note = null;
    if (!genai) {
        note = (
            <p className={styles.off} data-testid="classroom-class-ai-preview-consult-off">
                <FormattedMessage
                    defaultMessage="Generative AI is not used, so the “Ask AI” face appears in neither the Code tab nor the Ruby tab."
                    description="Preview note when the class doesn't use a generative AI"
                    id="gui.classroom.classAi.previewConsultOff"
                />
            </p>
        );
    }
    // Rubytee has no button of its own: it is only in the face's panel.
    let rubyteeNote = null;
    if (genai && !rubytee) {
        rubyteeNote = (
            <p className={styles.off} data-testid="classroom-class-ai-preview-rubytee-off">
                <FormattedMessage
                    defaultMessage="Rubytee is off, so “Leave it to Rubytee” doesn't appear in the face's panel."
                    description="Preview note when the class uses a generative AI but Rubytee is off"
                    id="gui.classroom.classAi.previewRubyteeOff"
                />
            </p>
        );
    } else if (!genai && rubytee) {
        rubyteeNote = (
            <p className={styles.off} data-testid="classroom-class-ai-preview-rubytee-no-genai">
                <FormattedMessage
                    defaultMessage="Rubytee is used from the “Ask AI” panel, so it doesn't appear without a generative AI."
                    description="Preview note when Rubytee is on but the class doesn't use a generative AI"
                    id="gui.classroom.classAi.previewRubyteeNoGenai"
                />
            </p>
        );
    }

    return (
        <aside className={styles.preview} data-testid="classroom-class-ai-preview">
            <p className={styles.title}>
                <FormattedMessage
                    defaultMessage="Students' screen will look like this"
                    description="Heading of the preview of the students' screen in the class AI settings"
                    id="gui.classroom.classAi.previewTitle"
                />
            </p>

            <div className={styles.screen}>
                <span className={styles.tab}>
                    <FormattedMessage
                        defaultMessage="Code"
                        description="Name of the Code tab in the preview of the students' screen"
                        id="gui.classroom.classAi.previewCode"
                    />
                </span>
                <div className={styles.canvas}>
                    {BLOCKS.map((kind, i) => (
                        <span
                            key={i}
                            className={styles[kind]}
                        />
                    ))}
                    {genai ? (
                        <span className={styles.panel}>
                            <span
                                className={rubytee ? styles.takeover : styles.takeoverOff}
                                data-on={rubytee ? 'true' : 'false'}
                                data-testid="classroom-class-ai-preview-rubytee"
                            >
                                <FormattedMessage
                                    defaultMessage="Leave it to Rubytee"
                                    description="The Rubytee button in the face's panel, drawn in the preview of the students' screen"
                                    id="gui.classroom.classAi.previewTakeover"
                                />
                            </span>
                        </span>
                    ) : null}
                    {genai ? <Face testId="classroom-class-ai-preview-consult" /> : null}
                </div>
            </div>

            <div className={styles.screen}>
                <span className={styles.tab}>{'Ruby'}</span>
                <div className={styles.editor}>
                    {CODE_LINES.map((width, i) => (
                        <span
                            key={i}
                            className={styles.line}
                            style={{ width: `${width}%` }}
                        />
                    ))}
                    {genai ? <Face testId="classroom-class-ai-preview-consult-ruby" /> : null}
                </div>
            </div>
            {note}
            {rubyteeNote}
        </aside>
    );
};

ClassAiStudentPreview.propTypes = {
    genai: PropTypes.bool.isRequired,
    rubytee: PropTypes.bool.isRequired,
};

export default ClassAiStudentPreview;
