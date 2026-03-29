// === Smalruby: This file is Smalruby-specific (Monaco editor setup for Ruby tab) ===

import CompletionProviderManager from './completion-provider-manager';
import {DnclSnippetsCompleter} from './dncl-snippets';
import {dnclLanguage, dnclLanguageConfiguration} from './dncl-mode';
import SnippetsCompleter from './snippets-completer';
import {smalrubyLanguage, smalrubyLanguageConfiguration} from './smalruby-mode';

/**
 * Register a custom paste action that uses the Clipboard API.
 * Monaco Editor v0.55.1 standalone has a broken built-in paste action.
 * @param {object} editor - Monaco editor instance.
 * @param {string} pasteLabel - Localized label for the paste action.
 */
const registerCustomPasteAction = (editor, pasteLabel) => {
    editor.addAction({
        id: 'smalruby.paste',
        label: pasteLabel,
        contextMenuGroupId: '9_cutcopypaste',
        contextMenuOrder: 4,
        precondition: '!editorReadonly',
        run: async ed => {
            try {
                const text = await navigator.clipboard.readText();
                if (text) {
                    ed.trigger('keyboard', 'type', {text});
                }
            } catch (err) {
                // eslint-disable-next-line no-console
                console.error('Smalruby custom paste error:', err);
            }
        }
    });
};

/**
 * Hide the original (broken) Paste action in Monaco Editor v0.55.1 context menu.
 * Monaco renders context menus in a Shadow DOM (.shadow-root-host).
 * Returns MutationObserver references for cleanup.
 * @returns {object} Observer refs for cleanup:
 *   { pasteMutationObserver: MutationObserver|null, bodyMutationObserver: MutationObserver|null }.
 */
const setupPasteDuplicateHider = () => {
    let pasteMutationObserver = null;
    let bodyMutationObserver = null;

    const hideDuplicatePaste = shadowRoot => {
        const pasteLabels = Array.from(shadowRoot.querySelectorAll(
            '.action-label[aria-label="Paste"], .action-label[aria-label="貼り付け"]'
        ));
        if (pasteLabels.length >= 2) {
            const firstPasteItem = pasteLabels[0].closest('.action-item');
            if (firstPasteItem) {
                firstPasteItem.style.display = 'none';
            }
        }
    };

    const setupObserver = host => {
        if (pasteMutationObserver) return;

        pasteMutationObserver = new MutationObserver(() => {
            hideDuplicatePaste(host.shadowRoot);
        });
        pasteMutationObserver.observe(host.shadowRoot, {
            childList: true,
            subtree: true
        });
        hideDuplicatePaste(host.shadowRoot);
    };

    const shadowRootHost = document.querySelector('.shadow-root-host');
    if (shadowRootHost && shadowRootHost.shadowRoot) {
        setupObserver(shadowRootHost);
    } else {
        bodyMutationObserver = new MutationObserver(() => {
            const host = document.querySelector('.shadow-root-host');
            if (host && host.shadowRoot) {
                setupObserver(host);
                bodyMutationObserver.disconnect();
                bodyMutationObserver = null;
            }
        });
        bodyMutationObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    return {pasteMutationObserver, bodyMutationObserver};
};

/**
 * Register the Smalruby language mode, completion provider, and quick fix provider.
 * @param {object} monaco - Monaco namespace.
 * @param {object} editor - Monaco editor instance.
 * @param {object} vm - Scratch VM instance.
 * @param {object} quickFixProvider - QuickFixProvider instance.
 * @param {object|null} existingManager - Existing CompletionProviderManager to reuse.
 * @returns {object} CompletionProviderManager instance.
 */
const registerLanguageAndProviders = (monaco, editor, vm, quickFixProvider, existingManager) => {
    // Register Smalruby language
    monaco.languages.register({id: 'smalruby'});
    monaco.languages.setMonarchTokensProvider('smalruby', smalrubyLanguage);
    monaco.languages.setLanguageConfiguration('smalruby', smalrubyLanguageConfiguration);

    // === Smalruby: Start of DNCL language registration ===
    // Register DNCL language mode
    monaco.languages.register({id: 'dncl'});
    monaco.languages.setMonarchTokensProvider('dncl', dnclLanguage);
    monaco.languages.setLanguageConfiguration('dncl', dnclLanguageConfiguration);
    // === Smalruby: End of DNCL language registration ===

    // Set up completion provider
    let completionProviderManager = existingManager;
    if (!completionProviderManager) {
        completionProviderManager = new CompletionProviderManager();
        const completer = new SnippetsCompleter(vm);
        completionProviderManager.register(monaco, 'smalruby', {
            provideCompletionItems: (model, position, context, token) => (
                completer.provideCompletionItems(model, position, context, token, monaco)
            )
        });

        // === Smalruby: Start of DNCL completion provider ===
        const dnclCompleter = new DnclSnippetsCompleter();
        completionProviderManager.register(monaco, 'dncl', {
            provideCompletionItems: (model, position, context, token) => (
                dnclCompleter.provideCompletionItems(model, position, context, token, monaco)
            )
        });
        // === Smalruby: End of DNCL completion provider ===
    }

    // Register quick fix provider for conversion errors
    quickFixProvider.setVM(vm);
    monaco.languages.registerCodeActionProvider('smalruby', {
        provideCodeActions: (model, range, ctx, token) => (
            quickFixProvider.provideCodeActions(model, range, ctx, token)
        )
    });

    return completionProviderManager;
};

export {
    registerCustomPasteAction,
    setupPasteDuplicateHider,
    registerLanguageAndProviders
};
