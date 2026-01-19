class BaseCompleter {
    /**
     * Convert an item to a Monaco CompletionItem.
     * @param {object} item - The snippet item.
     * @param {object} range - The range where the completion is requested.
     * @param {object} monaco - The monaco instance.
     * @returns {object} Monaco CompletionItem.
     */
    toCompletionItem (item, range, monaco) {
        const snippet = item.snippet || item.value;
        const description = item.description || item.caption;

        return {
            label: item.caption,
            kind: this.#getCompletionItemKind(item.type, monaco),
            documentation: {
                value: this.#toMarkdown(description, snippet)
            },
            insertText: snippet,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: 'Smalruby Snippet',
            range: range
        };
    }

    #getCompletionItemKind (type, monaco) {
        switch (type) {
        case 'method':
            return monaco.languages.CompletionItemKind.Method;
        case 'function':
            return monaco.languages.CompletionItemKind.Function;
        case 'variable':
            return monaco.languages.CompletionItemKind.Variable;
        case 'value':
            return monaco.languages.CompletionItemKind.Value;
        case 'constant':
            return monaco.languages.CompletionItemKind.Constant;
        case 'enum_member':
            return monaco.languages.CompletionItemKind.EnumMember;
        case 'keyword':
            return monaco.languages.CompletionItemKind.Keyword;
        case 'event':
            return monaco.languages.CompletionItemKind.Event;
        case 'snippet':
        default:
            return monaco.languages.CompletionItemKind.Snippet;
        }
    }

    #toMarkdown (description, snippet) {
        const cleanSnippet = this.#removeSnippetVarAroundCode(snippet);
        return `**${description}**\n\n---\n\n\`\`\`ruby\n${cleanSnippet}\n\`\`\``;
    }

    #removeSnippetVarAroundCode = function (snippet) {
        return snippet.replace(/\$\{[0-9]+:?([^}]*?)\}/g, '$1');
    };
}

export default BaseCompleter;
