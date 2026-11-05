/**
 * A small drawing of the students' screen next to the class AI settings
 * (issue #1290): which AI buttons they will see, following the unsaved choices.
 * Drawn with CSS only (no screenshots), so it is cheap to keep in step when the
 * real buttons change — the "Consult AI" face of genai-concierge and the AI
 * button of the Ruby toolbar.
 */
import PropTypes from 'prop-types';
import React from 'react';
import { FormattedMessage } from 'react-intl';

import styles from './class-ai-student-preview.css';

const BLOCKS = ['hat', 'motion', 'motion', 'looks'];
const CODE_LINES = [70, 55, 80, 40];

const ClassAiStudentPreview = ({ genai, rubytee }) => (
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
                    <span className={styles.consult} data-testid="classroom-class-ai-preview-consult">
                        <span className={styles.face}>{'AI'}</span>
                        <FormattedMessage
                            defaultMessage="Consult AI"
                            description="The button students see on the Code screen when the class uses a generative AI"
                            id="gui.classroom.classAi.previewConsult"
                        />
                    </span>
                ) : null}
            </div>
        </div>
        {genai ? null : (
            <p className={styles.off} data-testid="classroom-class-ai-preview-consult-off">
                <FormattedMessage
                    defaultMessage="Generative AI is not used, so the “Consult AI” button doesn't appear."
                    description="Preview note when the class doesn't use a generative AI"
                    id="gui.classroom.classAi.previewConsultOff"
                />
            </p>
        )}

        <div className={styles.screen}>
            <span className={styles.tab}>{'Ruby'}</span>
            <div className={styles.editor}>
                <span
                    className={rubytee ? styles.aiButton : styles.aiButtonOff}
                    data-on={rubytee ? 'true' : 'false'}
                    data-testid="classroom-class-ai-preview-rubytee"
                >
                    {'AI'}
                </span>
                {CODE_LINES.map((width, i) => (
                    <span
                        key={i}
                        className={styles.line}
                        style={{ width: `${width}%` }}
                    />
                ))}
            </div>
        </div>
        {rubytee ? null : (
            <p className={styles.off} data-testid="classroom-class-ai-preview-rubytee-off">
                <FormattedMessage
                    defaultMessage="Rubytee is off, so the AI button in the Ruby tab doesn't appear."
                    description="Preview note when Rubytee is off for the class"
                    id="gui.classroom.classAi.previewRubyteeOff"
                />
            </p>
        )}
    </aside>
);

ClassAiStudentPreview.propTypes = {
    genai: PropTypes.bool.isRequired,
    rubytee: PropTypes.bool.isRequired,
};

export default ClassAiStudentPreview;
