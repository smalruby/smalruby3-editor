/**
 * Teacher assignment editor.
 *
 * Edits the assignment content of a classroom: pages of (short text +
 * optional image) plus one optional starter project, and how students start
 * (#1202: "start from the previous submission") and whether students may
 * see classmates' submission images (#1208: "peer view"), and the mesh
 * group size limit (#1257). Kept deliberately
 * simple — a constrained format the teacher can fill in minutes.
 */
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FormattedMessage, defineMessages, useIntl } from 'react-intl';

import Spinner from '../spinner/spinner.jsx';
import ErrorDisplay from './error-display.jsx';
import MeshGroupLimitField, { meshGroupLimitMessages } from './mesh-group-limit-field.jsx';

import {
    MAX_ASSIGNMENT_PAGES,
    MAX_ASSIGNMENT_PAGE_TEXT_LENGTH,
    normalizeMeshGroupLimit,
} from '../../lib/classroom-assignment-utils.js';

import styles from './classroom-modal.css';

const messages = defineMessages({
    peerViewNone: {
        defaultMessage: "Don't show",
        description: 'Assignment editor: peer view option — students cannot see classmates\' work',
        id: 'gui.classroom.assignmentEditor.peerViewNone',
    },
    peerViewAlways: {
        defaultMessage: 'Anytime',
        description: 'Assignment editor: peer view option — students can always see classmates\' work',
        id: 'gui.classroom.assignmentEditor.peerViewAlways',
    },
    peerViewAfterSubmit: {
        defaultMessage: 'After submitting their own',
        description: 'Assignment editor: peer view option — students see classmates\' work once they submit',
        id: 'gui.classroom.assignmentEditor.peerViewAfterSubmit',
    },
    advancedSummary: {
        defaultMessage: 'From last time: {previous} · Peer view: {peerView} · Mesh: {mesh}',
        description: 'Assignment editor: current values shown on the folded advanced settings',
        id: 'gui.classroom.assignmentEditor.advancedSummary',
    },
    summaryOn: {
        defaultMessage: 'Yes',
        description: 'Assignment editor: advanced settings summary — start from the previous submission is on',
        id: 'gui.classroom.assignmentEditor.summaryOn',
    },
    summaryOff: {
        defaultMessage: 'No',
        description: 'Assignment editor: advanced settings summary — start from the previous submission is off',
        id: 'gui.classroom.assignmentEditor.summaryOff',
    },
});

const PEER_VIEW_MESSAGES = {
    none: messages.peerViewNone,
    always: messages.peerViewAlways,
    afterSubmit: messages.peerViewAfterSubmit,
};

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
    savedSettings,
    starterMode,
    starterSource,
    startFromPrevious,
    peerView,
    meshGroupLimit,
    onAddPage,
    onAttachPageImage,
    onChangePageText,
    onChangeMeshGroupLimit,
    onChangePeerView,
    onChangeStartFromPrevious,
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
    // E2 (#1303): rarely changed settings are folded; the summary on the
    // toggle shows the current (unsaved included) values (R3).
    const [showAdvanced, setShowAdvanced] = useState(false);
    const advancedRef = useRef(null);
    const handleToggleAdvanced = useCallback(() => setShowAdvanced((v) => !v), []);
    // The open panel floats over the pages, so a click elsewhere or Escape
    // closes it. Escape is caught in the capture phase and stopped there:
    // otherwise the same key also reaches the modal and closes it.
    useEffect(() => {
        if (!showAdvanced) return () => {};
        const handleDown = (e) => {
            if (advancedRef.current && !advancedRef.current.contains(e.target)) setShowAdvanced(false);
        };
        const handleKey = (e) => {
            if (e.key !== 'Escape') return;
            e.stopPropagation();
            setShowAdvanced(false);
        };
        document.addEventListener('mousedown', handleDown);
        document.addEventListener('keydown', handleKey, true);
        return () => {
            document.removeEventListener('mousedown', handleDown);
            document.removeEventListener('keydown', handleKey, true);
        };
    }, [showAdvanced]);
    const hasAdvanced = Boolean(onChangeStartFromPrevious || onChangePeerView || onChangeMeshGroupLimit);
    // With many settings it is easy to lose track of which values are still
    // unsaved, so a value that differs from the saved one is coloured (in the
    // summary and in the panel) until［課題を保存］stores it (#1303 review Q1).
    const changed = savedSettings
        ? {
              previous: !!startFromPrevious !== !!savedSettings.startFromPrevious,
              peerView: (peerView || 'none') !== (savedSettings.peerView || 'none'),
              mesh: normalizeMeshGroupLimit(meshGroupLimit) !== normalizeMeshGroupLimit(savedSettings.meshGroupLimit),
          }
        : { previous: false, peerView: false, mesh: false };
    const hasUnsaved = changed.previous || changed.peerView || changed.mesh;
    const summaryValue = (key, text) => (
        <span
            className={changed[key] ? styles.assignmentAdvancedChanged : null}
            data-changed={changed[key] ? 'true' : null}
            data-testid={`classroom-assignment-advanced-summary-${key}`}
        >
            {text}
        </span>
    );
    const advancedSummary = (
        <FormattedMessage
            {...messages.advancedSummary}
            values={{
                previous: summaryValue(
                    'previous',
                    intl.formatMessage(startFromPrevious ? messages.summaryOn : messages.summaryOff),
                ),
                peerView: summaryValue(
                    'peerView',
                    intl.formatMessage(PEER_VIEW_MESSAGES[peerView] || messages.peerViewNone),
                ),
                mesh: summaryValue(
                    'mesh',
                    intl.formatMessage(
                        normalizeMeshGroupLimit(meshGroupLimit) === 0
                            ? meshGroupLimitMessages.noLimit
                            : meshGroupLimitMessages.upToSix,
                    ),
                ),
            }}
        />
    );
    const settingClass = (key) => (changed[key] ? styles.assignmentAdvancedSettingChanged : null);

    const handleStartFromPreviousChange = useCallback(
        (e) => onChangeStartFromPrevious && onChangeStartFromPrevious(e.target.checked),
        [onChangeStartFromPrevious],
    );

    const handlePeerViewChange = useCallback(
        (e) => onChangePeerView && onChangePeerView(e.target.value),
        [onChangePeerView],
    );

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
        <div className={styles.assignmentEditor} data-testid="classroom-description-editor">
            {/* E1 (#1303): the save button sits at the top (like Google
                Classroom's "Assign"), so it is visible without scrolling. */}
            <div className={styles.assignmentEditorHeader}>
                <p className={styles.assignmentEditorHint}>
                    <FormattedMessage
                        defaultMessage="Students see these pages when they join with the class code, and start from the starter project with a button."
                        description="Assignment editor explanation"
                        id="gui.classroom.assignmentEditor.hint"
                    />
                </p>
                <div className={styles.assignmentEditorActions}>
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
            </div>

            <ErrorDisplay error={error} errorTitle={errorTitle} />

            <div className={styles.assignmentEditorColumns}>
                {/* The pages are a list whose length the teacher decides (up
                    to 10), so only this frame scrolls (R6 exception). */}
                <div className={styles.assignmentEditorPages} data-testid="classroom-assignment-pages">
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
                    <p className={styles.assignmentEditorLimits}>
                        <FormattedMessage
                            defaultMessage="Up to 10 pages, 500 characters and one image per page, one starter project."
                            description="Assignment editor limits note"
                            id="gui.classroom.assignmentEditor.limitsNote"
                        />
                    </p>
                </div>

                <div className={styles.assignmentEditorSide}>
                    <div className={styles.assignmentStarterSection}>
                        <h3 className={styles.assignmentStarterTitle}>
                            <FormattedMessage
                                defaultMessage="Starter Project"
                                description="Assignment editor: starter section title"
                                id="gui.classroom.assignmentEditor.starterTitle"
                            />
                        </h3>
                        <div
                            className={styles.assignmentStarterStatus}
                            data-testid="classroom-assignment-starter-status"
                        >
                            {renderStarterStatus()}
                        </div>
                        <div className={styles.assignmentStarterButtons}>
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

                    {hasAdvanced && (
                        <div className={styles.assignmentAdvanced} ref={advancedRef}>
                            <button
                                aria-expanded={showAdvanced}
                                className={styles.assignmentAdvancedToggle}
                                data-testid="classroom-assignment-advanced-toggle"
                                type="button"
                                onClick={handleToggleAdvanced}
                            >
                                <span className={styles.assignmentAdvancedTitle}>
                                    {showAdvanced ? '▾ ' : '▸ '}
                                    <FormattedMessage
                                        defaultMessage="Advanced settings"
                                        description="Assignment editor: toggle of the folded advanced settings"
                                        id="gui.classroom.assignmentEditor.advanced"
                                    />
                                    {hasUnsaved && (
                                        <span
                                            className={styles.assignmentAdvancedUnsaved}
                                            data-testid="classroom-assignment-advanced-unsaved"
                                        >
                                            <FormattedMessage
                                                defaultMessage="Not saved yet"
                                                description="Assignment editor: mark on the advanced settings when a coloured value is not saved yet"
                                                id="gui.classroom.assignmentEditor.advancedUnsaved"
                                            />
                                        </span>
                                    )}
                                </span>
                                <span
                                    className={styles.assignmentAdvancedSummary}
                                    data-testid="classroom-assignment-advanced-summary"
                                >
                                    {advancedSummary}
                                </span>
                            </button>
                            {showAdvanced && (
                                <div
                                    className={styles.assignmentAdvancedPanel}
                                    data-testid="classroom-assignment-advanced-panel"
                                >
                                    {/* Follow-up lessons (#1202): students open last time's work by
                                        default instead of choosing (and mistaking) the starter. */}
                                    {onChangeStartFromPrevious && (
                                        <label
                                            className={classNames(
                                                styles.assignmentStartFromPrevious,
                                                settingClass('previous'),
                                            )}
                                        >
                                            <input
                                                checked={startFromPrevious}
                                                data-testid="classroom-assignment-start-from-previous"
                                                disabled={isSaving}
                                                type="checkbox"
                                                onChange={handleStartFromPreviousChange}
                                            />
                                            <span>
                                                <span className={styles.assignmentStartFromPreviousLabel}>
                                                    <FormattedMessage
                                                        defaultMessage="Start from the previous submission"
                                                        description="Assignment editor: setting that opens the previous submission when students join"
                                                        id="gui.classroom.assignmentEditor.startFromPrevious"
                                                    />
                                                </span>
                                                <span className={styles.assignmentStartFromPreviousHint}>
                                                    <FormattedMessage
                                                        defaultMessage="For follow-up lessons: when students join, continuing from the project they submitted last time in this class is recommended (the starter is not offered). Students without one are told to start from the starter."
                                                        description="Assignment editor: explanation of the start-from-previous setting"
                                                        id="gui.classroom.assignmentEditor.startFromPreviousHint"
                                                    />
                                                </span>
                                            </span>
                                        </label>
                                    )}
                                    {/* Peer view (#1208): students see classmates' submission
                                        images (never the .sb3) to learn from each other. */}
                                    {onChangePeerView && (
                                        <div className={classNames(styles.assignmentPeerView, settingClass('peerView'))}>
                                            <label className={styles.assignmentPeerViewRow}>
                                                <span className={styles.assignmentStartFromPreviousLabel}>
                                                    <FormattedMessage
                                                        defaultMessage="Let students see classmates' work"
                                                        description="Assignment editor: label of the peer view setting"
                                                        id="gui.classroom.assignmentEditor.peerView"
                                                    />
                                                </span>
                                                <select
                                                    className={styles.assignmentPeerViewSelect}
                                                    data-testid="classroom-assignment-peer-view"
                                                    disabled={isSaving}
                                                    value={peerView || 'none'}
                                                    onChange={handlePeerViewChange}
                                                >
                                                    <option value="none">
                                                        {intl.formatMessage(messages.peerViewNone)}
                                                    </option>
                                                    <option value="always">
                                                        {intl.formatMessage(messages.peerViewAlways)}
                                                    </option>
                                                    <option value="afterSubmit">
                                                        {intl.formatMessage(messages.peerViewAfterSubmit)}
                                                    </option>
                                                </select>
                                            </label>
                                            <span className={styles.assignmentStartFromPreviousHint}>
                                                <FormattedMessage
                                                    defaultMessage="Students see only the stage image and block images of classmates' submissions (not the project file, names or your comments). Choose after submitting to have them try on their own first."
                                                    description="Assignment editor: explanation of the peer view setting"
                                                    id="gui.classroom.assignmentEditor.peerViewHint"
                                                />
                                            </span>
                                        </div>
                                    )}
                                    {onChangeMeshGroupLimit && (
                                        <div className={settingClass('mesh')}>
                                            <MeshGroupLimitField
                                                disabled={isSaving}
                                                testId="classroom-assignment-mesh-group-limit"
                                                value={meshGroupLimit}
                                                onChange={onChangeMeshGroupLimit}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

TeacherAssignmentEditor.propTypes = {
    editorPages: PropTypes.arrayOf(PropTypes.object).isRequired,
    error: PropTypes.string,
    errorTitle: PropTypes.string,
    hasExistingStarter: PropTypes.bool,
    isSaving: PropTypes.bool,
    // The stored values of the advanced settings; a different current value
    // is shown as unsaved. Omit to show no unsaved marks.
    savedSettings: PropTypes.shape({
        startFromPrevious: PropTypes.bool,
        peerView: PropTypes.oneOf(['none', 'always', 'afterSubmit']),
        meshGroupLimit: PropTypes.number,
    }),
    starterMode: PropTypes.oneOf(['none', 'keep', 'new']).isRequired,
    starterSource: PropTypes.object,
    startFromPrevious: PropTypes.bool,
    peerView: PropTypes.oneOf(['none', 'always', 'afterSubmit']),
    meshGroupLimit: PropTypes.number,
    onAddPage: PropTypes.func.isRequired,
    onAttachPageImage: PropTypes.func.isRequired,
    onChangePageText: PropTypes.func.isRequired,
    onChangeMeshGroupLimit: PropTypes.func,
    onChangePeerView: PropTypes.func,
    onChangeStartFromPrevious: PropTypes.func,
    onMovePage: PropTypes.func.isRequired,
    onRemovePage: PropTypes.func.isRequired,
    onRemovePageImage: PropTypes.func.isRequired,
    onRemoveStarter: PropTypes.func.isRequired,
    onSave: PropTypes.func.isRequired,
    onUseCurrentProject: PropTypes.func.isRequired,
    onUseFile: PropTypes.func.isRequired,
};

export default TeacherAssignmentEditor;
