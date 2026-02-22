/**
 * Manages multiple Monaco CompletionItemProviders.
 * Handles registration and disposal of providers.
 */
class CompletionProviderManager {
    #disposables = [];

    /**
     * Register a completion provider with Monaco Editor.
     * @param {object} monaco - The monaco instance.
     * @param {string} languageId - The language identifier.
     * @param {object} provider - The completion item provider.
     */
    register (monaco, languageId, provider) {
        const disposable = monaco.languages.registerCompletionItemProvider(languageId, provider);
        this.#disposables.push(disposable);
    }

    /**
     * Dispose all registered providers.
     */
    dispose () {
        this.#disposables.forEach(d => d.dispose());
        this.#disposables = [];
    }
}

export default CompletionProviderManager;
