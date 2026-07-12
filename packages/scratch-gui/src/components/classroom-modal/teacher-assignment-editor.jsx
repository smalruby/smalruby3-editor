/**
 * Teacher assignment editor.
 *
 * Edits the assignment content of a classroom: pages of (short text +
 * optional image) plus one optional starter project. Kept deliberately
 * simple — a constrained format the teacher can fill in minutes.
 */
import PropTypes from 'prop-types';
import React, { useCallback, useRef } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';

import Spinner from '../spinner/spinner.jsx';
import ErrorDisplay from './error-display.jsx';

import { MAX_ASSIGNMENT_PAGES, MAX_ASSIGNMENT_PAGE_TEXT_LENGTH } from '../../lib/classroom-assignment-utils.js';

import styles from './classroom-modal.css';

const AssignmentPageEditor = ({
    index,
    page,
    pageCount,
    onAttachImage,
    onChangeText,
    onMove,
    onRemove,
    onRemoveImage,
}) => {
    const intl = useIntl();
    const fileInputRef = useRef(null);
    const imageUrl = page.previewUrl || page.imageUrl;

    const handleMoveUp = useCallback(() => onMove(index, -1), [onMove, index]);
    const handleMoveDown = useCallback(() => onMove(index, 1), [onMove, index]);
    const handleRemove = useCallback(() => onRemove(index), [onRemove, index]);
    const handleChangeText = useCallback((e) => onChangeText(index, e.target.value), [onChangeText, index]);
    const handleRemoveImage = useCallback(() => onRemoveImage(index), [onRemoveImage, index]);
    const handleAttachClick = useCallback(() => fileInputRef.current?.click(), []);
    const handleFileChange = useCallback(
        (e) => {
            onAttachImage(index, e.target.files?.[0]);
            e.target.value = '';
        },
        [onAttachImage, index],
    );

    return (
        <div className={styles.assignmentPage} data-testid={`classroom-assignment-page-${index}`}>
            <div className={styles.assignmentPageHeader}>
                <span className={styles.assignmentPageNumber}>
                    <FormattedMessage
                        defaultMessage="Page {number}"
                        description="Assignment editor page number label"
                        id="gui.classroom.assignmentEditor.pageNumber"
                        values={{ number: index + 1 }}
                    />
                </span>
                <span className={styles.assignmentPageActions}>
                    <button
                        className={styles.assignmentIconButton}
                        data-testid={`classroom-assignment-page-up-${index}`}
                        disabled={index === 0}
                        title={intl.formatMessage({
                            defaultMessage: 'Move up',
                            description: 'Assignment editor: move page up',
                            id: 'gui.classroom.assignmentEditor.moveUp',
                        })}
                        onClick={handleMoveUp}
                    >
                        {'↑'}
                    </button>
                    <button
                        className={styles.assignmentIconButton}
                        data-testid={`classroom-assignment-page-down-${index}`}
                        disabled={index === pageCount - 1}
                        title={intl.formatMessage({
                            defaultMessage: 'Move down',
                            description: 'Assignment editor: move page down',
                            id: 'gui.classroom.assignmentEditor.moveDown',
                        })}
                        onClick={handleMoveDown}
                    >
                        {'↓'}
                    </button>
                    <button
                        className={styles.assignmentIconButton}
                        data-testid={`classroom-assignment-page-remove-${index}`}
                        title={intl.formatMessage({
                            defaultMessage: 'Delete page',
                            description: 'Assignment editor: delete page',
                            id: 'gui.classroom.assignmentEditor.removePage',
                        })}
                        onClick={handleRemove}
                    >
                        {'×'}
                    </button>
                </span>
            </div>
            <div className={styles.assignmentPageImageRow}>
                {imageUrl ? (
                    <>
                        <img
                            alt=""
                            className={styles.assignmentPageImagePreview}
                            data-testid={`classroom-assignment-page-image-${index}`}
                            src={imageUrl}
                        />
                        <button
                            className={styles.secondaryButton}
                            data-testid={`classroom-assignment-page-image-remove-${index}`}
                            onClick={handleRemoveImage}
                        >
                            <FormattedMessage
                                defaultMessage="Remove Image"
                                description="Assignment editor: remove page image"
                                id="gui.classroom.assignmentEditor.removeImage"
                            />
                        </button>
                    </>
                ) : (
                    <button
                        className={styles.secondaryButton}
                        data-testid={`classroom-assignment-page-image-attach-${index}`}
                        onClick={handleAttachClick}
                    >
                        <FormattedMessage
                            defaultMessage="Add Image (1 per page)"
                            description="Assignment editor: attach page image"
                            id="gui.classroom.assignmentEditor.attachImage"
                        />
                    </button>
                )}
                <input
                    accept="image/png,image/jpeg"
                    hidden
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileChange}
                />
            </div>
            <textarea
                className={styles.assignmentPageTextarea}
                data-testid={`classroom-assignment-page-text-${index}`}
                maxLength={MAX_ASSIGNMENT_PAGE_TEXT_LENGTH}
                placeholder={intl.formatMessage({
                    defaultMessage: 'Write instructions for this page (a few lines)',
                    description: 'Assignment editor page text placeholder',
                    id: 'gui.classroom.assignmentEditor.pageTextPlaceholder',
                })}
                rows={4}
                value={page.text}
                onChange={handleChangeText}
            />
            <div className={styles.assignmentPageCharCount}>
                {`${(page.text || '').length} / ${MAX_ASSIGNMENT_PAGE_TEXT_LENGTH}`}
            </div>
        </div>
    );
};

AssignmentPageEditor.propTypes = {
    index: PropTypes.number.isRequired,
    page: PropTypes.shape({
        text: PropTypes.string,
        imageUrl: PropTypes.string,
        previewUrl: PropTypes.string,
    }).isRequired,
    pageCount: PropTypes.number.isRequired,
    onAttachImage: PropTypes.func.isRequired,
    onChangeText: PropTypes.func.isRequired,
    onMove: PropTypes.func.isRequired,
    onRemove: PropTypes.func.isRequired,
    onRemoveImage: PropTypes.func.isRequired,
};

const TeacherAssignmentEditor = ({
    editorPages,
    error,
    errorTitle,
    hasExistingStarter,
    isSaving,
    selectedClassroom,
    starterMode,
    starterSource,
    onAddPage,
    onAttachPageImage,
    embedded,
    onCancel,
    onChangePageText,
    onMovePage,
    onRemovePage,
    onRemovePageImage,
    onRemoveStarter,
    onSave,
    onUseCurrentProject,
    onUseFile,
}) => {
    const intl = useIntl();
    const starterFileInputRef = useRef(null);

    const handleStarterFileClick = useCallback(() => starterFileInputRef.current?.click(), []);
    const handleStarterFileChange = useCallback(
        (e) => {
            onUseFile(e.target.files?.[0]);
            e.target.value = '';
        },
        [onUseFile],
    );

    const renderStarterStatus = () => {
        if (starterMode === 'new' && starterSource?.source === 'file') {
            return (
                <FormattedMessage
                    defaultMessage="New starter: {name}"
                    description="Assignment editor: starter from file status"
                    id="gui.classroom.assignmentEditor.starterFromFile"
                    values={{ name: starterSource.name }}
                />
            );
        }
        if (starterMode === 'new') {
            return (
                <FormattedMessage
                    defaultMessage="New starter: the currently open project (saved when you save the assignment)"
                    description="Assignment editor: starter from open project status"
                    id="gui.classroom.assignmentEditor.starterFromProject"
                />
            );
        }
        if (starterMode === 'keep') {
            return (
                <FormattedMessage
                    defaultMessage="Starter project: set (kept as-is)"
                    description="Assignment editor: existing starter kept"
                    id="gui.classroom.assignmentEditor.starterKept"
                />
            );
        }
        return (
            <FormattedMessage
                defaultMessage="Starter project: none"
                description="Assignment editor: no starter"
                id="gui.classroom.assignmentEditor.starterNone"
            />
        );
    };

    return (
        <div
            className={styles.assignmentEditor}
            data-testid={embedded ? 'classroom-description-editor' : 'classroom-phase-teacher-assignment-edit'}
        >
            {!embedded && (
            <h2 className={styles.phaseTitle}>
                <FormattedMessage
                    defaultMessage="Edit Assignment"
                    description="Assignment editor title"
                    id="gui.classroom.assignmentEditor.title"
                />
                {selectedClassroom ? ` — ${selectedClassroom.className}` : ''}
            </h2>
            )}
            <p className={styles.assignmentEditorHint}>
                <FormattedMessage
                    defaultMessage="Students see these pages and the starter project opens automatically when they join with the class code."
                    description="Assignment editor explanation"
                    id="gui.classroom.assignmentEditor.hint"
                />
            </p>

            <ErrorDisplay error={error} errorTitle={errorTitle} />


            {editorPages.map((page, i) => (
                <AssignmentPageEditor
                    index={i}
                    key={i}
                    page={page}
                    pageCount={editorPages.length}
                    onAttachImage={onAttachPageImage}
                    onChangeText={onChangePageText}
                    onMove={onMovePage}
                    onRemove={onRemovePage}
                    onRemoveImage={onRemovePageImage}
                />
            ))}

            <div className={styles.buttonRow}>
                <button
                    className={styles.secondaryButton}
                    data-testid="classroom-assignment-add-page"
                    disabled={editorPages.length >= MAX_ASSIGNMENT_PAGES}
                    onClick={onAddPage}
                >
                    <FormattedMessage
                        defaultMessage="+ Add Page"
                        description="Assignment editor: add page"
                        id="gui.classroom.assignmentEditor.addPage"
                    />
                </button>
            </div>

            <div className={styles.assignmentStarterSection}>
                <h3 className={styles.assignmentStarterTitle}>
                    <FormattedMessage
                        defaultMessage="Starter Project"
                        description="Assignment editor: starter section title"
                        id="gui.classroom.assignmentEditor.starterTitle"
                    />
                </h3>
                <div className={styles.assignmentStarterStatus} data-testid="classroom-assignment-starter-status">
                    {renderStarterStatus()}
                </div>
                <div className={styles.buttonRow}>
                    <button
                        className={styles.secondaryButton}
                        data-testid="classroom-assignment-starter-current"
                        onClick={onUseCurrentProject}
                    >
                        <FormattedMessage
                            defaultMessage="Use the Open Project"
                            description="Assignment editor: set open project as starter"
                            id="gui.classroom.assignmentEditor.useCurrentProject"
                        />
                    </button>
                    <button
                        className={styles.secondaryButton}
                        data-testid="classroom-assignment-starter-file"
                        onClick={handleStarterFileClick}
                    >
                        <FormattedMessage
                            defaultMessage="Choose .sb3 File"
                            description="Assignment editor: set starter from file"
                            id="gui.classroom.assignmentEditor.useFile"
                        />
                    </button>
                    {starterMode !== 'none' && (
                        <button
                            className={styles.dangerButton}
                            data-testid="classroom-assignment-starter-remove"
                            onClick={onRemoveStarter}
                        >
                            <FormattedMessage
                                defaultMessage="Remove Starter"
                                description="Assignment editor: remove starter"
                                id="gui.classroom.assignmentEditor.removeStarter"
                            />
                        </button>
                    )}
                    <input
                        accept=".sb3"
                        hidden
                        ref={starterFileInputRef}
                        type="file"
                        onChange={handleStarterFileChange}
                    />
                </div>
                {hasExistingStarter && starterMode === 'none' && (
                    <p className={styles.assignmentStarterWarning}>
                        <FormattedMessage
                            defaultMessage="The existing starter project will be deleted when you save."
                            description="Assignment editor: warning that saving removes the existing starter"
                            id="gui.classroom.assignmentEditor.starterRemoveWarning"
                        />
                    </p>
                )}
            </div>

            <div className={styles.buttonRow}>
                {!embedded && (
                <button
                    className={styles.secondaryButton}
                    data-testid="classroom-assignment-cancel"
                    disabled={isSaving}
                    onClick={onCancel}
                >
                    <FormattedMessage
                        defaultMessage="Cancel"
                        description="Assignment editor: cancel"
                        id="gui.classroom.assignmentEditor.cancel"
                    />
                </button>
                )}
                <button
                    className={styles.primaryButton}
                    data-testid="classroom-assignment-save"
                    disabled={isSaving}
                    onClick={onSave}
                >
                    {isSaving ? (
                        <Spinner className={styles.buttonSpinner} small />
                    ) : (
                        <FormattedMessage
                            defaultMessage="Save Assignment"
                            description="Assignment editor: save"
                            id="gui.classroom.assignmentEditor.save"
                        />
                    )}
                </button>
            </div>
            <p className={styles.assignmentEditorHint}>
                <FormattedMessage
                    defaultMessage="Up to 10 pages, 500 characters and one image per page, one starter project."
                    description="Assignment editor limits note"
                    id="gui.classroom.assignmentEditor.limitsNote"
                />
            </p>
        </div>
    );
};

TeacherAssignmentEditor.propTypes = {
    editorPages: PropTypes.arrayOf(PropTypes.object).isRequired,
    error: PropTypes.string,
    errorTitle: PropTypes.string,
    hasExistingStarter: PropTypes.bool,
    isSaving: PropTypes.bool,
    selectedClassroom: PropTypes.object,
    starterMode: PropTypes.oneOf(['none', 'keep', 'new']).isRequired,
    starterSource: PropTypes.object,
    onAddPage: PropTypes.func.isRequired,
    onAttachPageImage: PropTypes.func.isRequired,
    embedded: PropTypes.bool,
    onCancel: PropTypes.func,
    onChangePageText: PropTypes.func.isRequired,
    onMovePage: PropTypes.func.isRequired,
    onRemovePage: PropTypes.func.isRequired,
    onRemovePageImage: PropTypes.func.isRequired,
    onRemoveStarter: PropTypes.func.isRequired,
    onSave: PropTypes.func.isRequired,
    onUseCurrentProject: PropTypes.func.isRequired,
    onUseFile: PropTypes.func.isRequired,
};

export default TeacherAssignmentEditor;
