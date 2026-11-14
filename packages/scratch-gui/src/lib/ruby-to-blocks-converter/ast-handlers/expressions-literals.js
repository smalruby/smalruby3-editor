// === Smalruby: This file is Smalruby-specific (literal-handling AST visitors for expressions) ===
import Primitive from '../primitive';

/**
 * Literal expression AST handlers for RubyToBlocksConverter.
 * @mixes RubyToBlocksConverter
 */
const ExpressionsLiterals = {
    visitSelfNode(node) {
        return new Primitive('self', 'self', node);
    },

    visitSymbolNode(node) {
        return new Primitive('sym', node.unescaped.value, node);
    },

    visitStringNode(node) {
        return new Primitive('str', node.unescaped.value, node);
    },

    visitIntegerNode(node) {
        return new Primitive('int', node.value, node);
    },

    visitFloatNode(node) {
        return new Primitive('float', node.value, node);
    },

    // === Smalruby: Start of regex literal support ===
    visitRegularExpressionNode(node) {
        const pattern = node.unescaped.value;
        const closingSource = this._getSource({ location: node.closingLoc });
        const flags = closingSource.length > 1 ? closingSource.slice(1) : '';
        return new Primitive('regexp', `/${pattern}/${flags}`, node);
    },
    // === Smalruby: End of regex literal support ===

    visitTrueNode(node) {
        const index = (this._context.literalCallIndices.true || 0) + 1;
        this._context.literalCallIndices.true = index;

        const block = this._createBlock('operator_equals', 'value_boolean');
        block.node = node;
        this._addTextInput(block, 'OPERAND1', '1', '1');
        this._addTextInput(block, 'OPERAND2', '1', '1');
        block.comment = this._createComment(`@ruby:literal:true:${index}`, block.id);
        return block;
    },

    visitFalseNode(node) {
        const index = (this._context.literalCallIndices.false || 0) + 1;
        this._context.literalCallIndices.false = index;

        const block = this._createBlock('operator_lt', 'value_boolean');
        block.node = node;
        this._addTextInput(block, 'OPERAND1', '0', '0');
        this._addTextInput(block, 'OPERAND2', '0', '0');
        block.comment = this._createComment(`@ruby:literal:false:${index}`, block.id);
        return block;
    },

    visitArrayNode(node) {
        return new Primitive(
            'array',
            node.elements.map((childNode) => this.visit(childNode)),
            node,
        );
    },

    visitHashNode(node) {
        // Prism HashNode has elements which are AssocNode or AssocSplatNode
        // Use toJSON().type instead of constructor.name for production build compatibility
        const elements = new Map();
        node.elements.forEach((element) => {
            if (element.toJSON().type === 'AssocNode') {
                elements.set(this.visit(element.key), this.visit(element.value));
            }
        });
        return new Primitive('hash', elements, node);
    },

    visitKeywordHashNode(node) {
        // Prism KeywordHashNode is used for keyword arguments without braces, e.g. foo(secs: 5)
        // Elements are AssocNode with SymbolNode keys
        // Use toJSON().type instead of constructor.name for production build compatibility
        const elements = new Map();
        node.elements.forEach((element) => {
            if (element.toJSON().type === 'AssocNode') {
                elements.set(this.visit(element.key), this.visit(element.value));
            }
        });
        return new Primitive('hash', elements, node);
    },

    visitNilNode(node) {
        return new Primitive('nil', null, node);
    },

    visitParenthesesNode(node) {
        // Parenthesized expression e.g. (1), (x + 1), (a; b; c)
        // Delegate to the inner StatementsNode so chaining/sequencing is handled correctly
        if (node.body) {
            return this.visit(node.body);
        }
        return new Primitive('nil', null, node);
    },

    visitAssocNode(node) {
        return [this.visit(node.key), this.visit(node.value)];
    },

    visitRangeNode(node) {
        const visitedLeft = this.visit(node.left);
        const visitedRight = this.visit(node.right);
        // A range without an end (`1..`) or with a string with `#{...}` stopped the conversion with
        // a JavaScript error (issue #1885).
        if (this._isMissingOperand(node.left, visitedLeft) || this._isMissingOperand(node.right, visitedRight)) {
            throw this._wrongInstructionError(node);
        }
        const left = this._rangeEndValue(node.left, visitedLeft);
        const right = this._rangeEndValue(node.right, visitedRight);
        const opcode = node.isExcludeEnd() ? 'ruby_exclude_range' : 'ruby_range';
        const block = this._createBlock(opcode, 'value_boolean');
        block.node = node;
        // The ends go in the number inputs of "pick random": an end that is not a number or a value
        // (`self..2`, `1..:a`, `(@a = 1)..2`) was put there as something else (issue #1906). `rand`
        // does not take such a range; the range is left and told as a wrong instruction at the end,
        // after a `when` has told its own line (`when 1..` with the next line as the end).
        if (!this._isRangeEnd(left) || !this._isRangeEnd(right)) {
            this._context.rangesWithWrongEnd.add(block.id);
        }
        this._addNumberInput(block, 'FROM', 'math_number', left, 1);
        this._addNumberInput(block, 'TO', 'math_number', right, 10);
        return block;
    },

    /**
     * The value of an end of a range. An end in parentheses (`1..(@a + 1)`, `1..((2))`) comes as the
     * statements in them; the one statement is the value. Put in the input as the statements, the end
     * came back as the default value of the input (issue #1906).
     * @param {object} node - The node of the end.
     * @param {*} value - What visiting the node returned.
     * @returns {*} The value of the end.
     */
    _rangeEndValue(node, value) {
        const statements = this._getNodeTypeName(node) === 'ParenthesesNode' && node.body ? node.body.body : null;
        if (statements && statements.length === 1 && Array.isArray(value) && value.length === 1) {
            return this._rangeEndValue(statements[0], value[0]);
        }
        return value;
    },

    /**
     * Whether the value of an end of a range can go in a number input: a number or a value block.
     * `true` / `false` are left out: they come as the block `1 == 1` / `0 == 1` marked as a literal,
     * which is a value block.
     * @param {*} value - The value of the end.
     * @returns {boolean} Whether the end is a number or a value block.
     */
    _isRangeEnd(value) {
        return !this._isTrue(value) && !this._isFalse(value) && this._isNumberOrBlock(value);
    },

    visitConstantReadNode(node) {
        const value = {
            scope: null,
            name: node.name,
        };
        return new Primitive('const', value, node);
    },

    visitConstantPathNode(node) {
        const value = {
            scope: this.visit(node.parent),
            name: node.name,
        };
        return new Primitive('const', value, node);
    },
};

export default ExpressionsLiterals;
