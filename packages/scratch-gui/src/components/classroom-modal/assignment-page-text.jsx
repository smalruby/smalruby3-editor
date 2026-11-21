/**
 * An assignment page's text with the light formatting of parseAssignmentText (heading,
 * highlights, lists, labels, paragraphs). Rendered as React elements only — never as HTML — so
 * whatever the teacher types stays text. Used by the student's assignment panel and by every
 * place the teacher sees the pages (the student-view preview, shared assignments).
 */
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { useMemo } from 'react';
import { parseAssignmentText } from '../../lib/classroom-assignment-text.js';
import styles from './classroom-modal.css';

/**
 * @param {object} props - component props
 * @param {Array<{type: string, text: string}>} props.pieces - parseInline pieces
 * @returns {React.ReactElement} the pieces
 */
const Pieces = ({ pieces }) => (
    <>
        {pieces.map((piece, index) => {
            if (piece.type === 'highlight') {
                return (
                    <mark className={styles.assignmentTextHighlight} key={index}>
                        {piece.text}
                    </mark>
                );
            }
            if (piece.type === 'label') {
                return (
                    <span className={styles.assignmentTextLabel} key={index}>
                        {piece.text}
                    </span>
                );
            }
            return <React.Fragment key={index}>{piece.text}</React.Fragment>;
        })}
    </>
);

Pieces.propTypes = {
    pieces: PropTypes.arrayOf(PropTypes.shape({ type: PropTypes.string, text: PropTypes.string })).isRequired,
};

const AssignmentPageText = ({ className, dataTestId, text }) => {
    const { heading, blocks } = useMemo(() => parseAssignmentText(text), [text]);
    return (
        <div className={classNames(styles.assignmentText, className)} data-testid={dataTestId}>
            {heading && (
                <p className={styles.assignmentTextHeading} data-testid="classroom-assignment-text-heading">
                    <Pieces pieces={heading} />
                </p>
            )}
            {blocks.map((block, index) => {
                if (block.type === 'list') {
                    const List = block.ordered ? 'ol' : 'ul';
                    return (
                        <List className={styles.assignmentTextList} key={index}>
                            {block.items.map((item, i) => (
                                <li key={i} value={block.ordered ? item.number : null}>
                                    <Pieces pieces={item.pieces} />
                                </li>
                            ))}
                        </List>
                    );
                }
                return (
                    <p className={styles.assignmentTextParagraph} key={index}>
                        {block.lines.map((line, i) => (
                            <React.Fragment key={i}>
                                {i > 0 && <br />}
                                <Pieces pieces={line} />
                            </React.Fragment>
                        ))}
                    </p>
                );
            })}
        </div>
    );
};

AssignmentPageText.propTypes = {
    className: PropTypes.string,
    dataTestId: PropTypes.string,
    text: PropTypes.string,
};

export default AssignmentPageText;
