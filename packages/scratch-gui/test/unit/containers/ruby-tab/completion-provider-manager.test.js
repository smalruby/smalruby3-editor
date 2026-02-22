import CompletionProviderManager from '../../../../src/containers/ruby-tab/completion-provider-manager';

describe('CompletionProviderManager', () => {
    let manager;
    let monaco;
    let mockDisposable;

    beforeEach(() => {
        manager = new CompletionProviderManager();
        mockDisposable = {dispose: jest.fn()};
        monaco = {
            languages: {
                registerCompletionItemProvider: jest.fn(() => mockDisposable)
            }
        };
    });

    test('should register a provider with monaco', () => {
        const provider = {provideCompletionItems: jest.fn()};
        manager.register(monaco, 'smalruby', provider);
        expect(monaco.languages.registerCompletionItemProvider).toHaveBeenCalledWith('smalruby', provider);
    });

    test('should register multiple providers', () => {
        const provider1 = {provideCompletionItems: jest.fn()};
        const provider2 = {provideCompletionItems: jest.fn()};
        manager.register(monaco, 'smalruby', provider1);
        manager.register(monaco, 'smalruby', provider2);
        expect(monaco.languages.registerCompletionItemProvider).toHaveBeenCalledTimes(2);
    });

    test('should dispose all registered providers', () => {
        const disposable1 = {dispose: jest.fn()};
        const disposable2 = {dispose: jest.fn()};
        monaco.languages.registerCompletionItemProvider
            .mockReturnValueOnce(disposable1)
            .mockReturnValueOnce(disposable2);

        const provider1 = {provideCompletionItems: jest.fn()};
        const provider2 = {provideCompletionItems: jest.fn()};
        manager.register(monaco, 'smalruby', provider1);
        manager.register(monaco, 'smalruby', provider2);
        manager.dispose();

        expect(disposable1.dispose).toHaveBeenCalledTimes(1);
        expect(disposable2.dispose).toHaveBeenCalledTimes(1);
    });

    test('should clear disposables after dispose', () => {
        const provider = {provideCompletionItems: jest.fn()};
        manager.register(monaco, 'smalruby', provider);
        manager.dispose();

        // Calling dispose again should not call dispose on already-disposed providers
        mockDisposable.dispose.mockClear();
        manager.dispose();
        expect(mockDisposable.dispose).not.toHaveBeenCalled();
    });

    test('should handle dispose when no providers are registered', () => {
        expect(() => manager.dispose()).not.toThrow();
    });
});
