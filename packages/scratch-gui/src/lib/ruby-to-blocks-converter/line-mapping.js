/**
 * Mixin for line mapping utility methods.
 */
const LineMappingUtils = {
    /**
     * Get block ID for the given line number using O(1) map lookup with fallback.
     * The lineToNodeMap is populated during AST processing with a shallowest-first strategy,
     * so this returns the parent block for nested statements.
     * If no direct mapping exists for the line (e.g., line contains only `do` or `end`),
     * falls back to finding the shallowest node whose range contains the line.
     * @param {number} lineNumber - Line number (1-indexed)
     * @returns {string|null} Block ID or null if not found
     */
    getBlockIdForLine (lineNumber) {
        const entry = this._context.lineToNodeMap.get(lineNumber);

        if (!entry) {
            // Fallback 1: Find the shallowest node whose range contains this line
            const fallbackEntry = this._findContainingNode(lineNumber);
            if (fallbackEntry) {
                const blockId = this._context.nodeToBlockMap.get(fallbackEntry.node);
                if (blockId) return blockId;
            }

            // Fallback 2: Find the nearest executable line before this line
            const nearestLine = this._findNearestExecutableLine(lineNumber);
            if (nearestLine !== null) {
                return this.getBlockIdForLine(nearestLine);
            }

            return null;
        }

        const blockId = this._context.nodeToBlockMap.get(entry.node);

        // If direct mapping exists but node has no block, or block was deleted, try fallback
        if (!blockId || !this._context.blocks[blockId]) {
            const fallbackEntry = this._findContainingNode(lineNumber);
            if (fallbackEntry) {
                const fallbackBlockId = this._context.nodeToBlockMap.get(fallbackEntry.node);
                if (fallbackBlockId && this._context.blocks[fallbackBlockId]) {
                    return fallbackBlockId;
                }
            }

            const nearestLine = this._findNearestExecutableLine(lineNumber);
            if (nearestLine !== null) {
                return this.getBlockIdForLine(nearestLine);
            }

            return null;
        }

        return blockId;
    },

    /**
     * Find the shallowest node whose line range contains the given line number.
     * This is used as a fallback when no direct line mapping exists.
     * Searches through all nodes in nodeToBlockMap (which have associated blocks).
     * @param {number} lineNumber - Line number to search for
     * @returns {{node: object, depth: number}|null} Entry with node and depth, or null
     */
    _findContainingNode (lineNumber) {
        let bestMatchNode = null;
        let bestMatchStartLine = null;
        let bestMatchEndLine = null;

        // Search through all nodes that have blocks (nodeToBlockMap)
        for (const [node] of this._context.nodeToBlockMap.entries()) {
            // Get line range for this node
            if (node.location) {
                const startLine = node.location.startLine;
                const endLine = node.location.endLine || startLine;

                // Check if this node's range contains the target line
                if (startLine !== null && typeof startLine !== 'undefined' &&
                    endLine !== null && typeof endLine !== 'undefined' &&
                    startLine <= lineNumber && lineNumber <= endLine) {
                    // Keep the shallowest (smallest range) matching node
                    // If multiple nodes have same range, keep first found
                    const range = endLine - startLine;
                    const currentBestRange = bestMatchEndLine === null ? Infinity :
                        bestMatchEndLine - bestMatchStartLine;

                    if (range < currentBestRange ||
                        (range === currentBestRange && startLine < bestMatchStartLine)) {
                        bestMatchNode = node;
                        bestMatchStartLine = startLine;
                        bestMatchEndLine = endLine;
                    }
                }
            }
        }

        if (bestMatchNode) {
            return {node: bestMatchNode, depth: 0};
        }

        return null;
    },

    /**
     * Find the nearest executable line before the given line number.
     * Searches backwards from the target line to find a line with an executable block.
     * @param {number} lineNumber - Line number to start searching from
     * @returns {number|null} Nearest executable line number, or null if not found
     */
    _findNearestExecutableLine (lineNumber) {
        // Search backwards from the line before the target
        for (let line = lineNumber - 1; line >= 1; line--) {
            const entry = this._context.lineToNodeMap.get(line);
            if (entry) {
                const blockId = this._context.nodeToBlockMap.get(entry.node);
                if (blockId) {
                    return line;
                }
            }

            // Fallback: Check if this line is contained in some node that has a block
            const fallbackEntry = this._findContainingNode(line);
            if (fallbackEntry) {
                return line;
            }
        }
        return null;
    },

    /**
     * Get the line range for a top-level script block.
     * Returns the minimum and maximum line numbers covered by all blocks in the script.
     * @param {string} topBlockId - ID of the top-level block
     * @param {object} blocks - Blocks object from VM target
     * @returns {{startLine: number, endLine: number}|null} Line range or null if not found
     */
    getLineRangeForTopLevelScript (topBlockId, blocks) {
        if (!topBlockId || !blocks) return null;

        let minLine = Infinity;
        let maxLine = -Infinity;
        let foundAny = false;

        // Traverse all blocks in the script
        const visitBlock = blockId => {
            if (!blockId) return;

            const block = blocks.getBlock ? blocks.getBlock(blockId) : blocks[blockId];

            // Find the node for this block
            for (const [node, id] of this._context.nodeToBlockMap.entries()) {
                if (id === blockId) {
                    if (node.location) {
                        const startLine = node.location.startLine;
                        const endLine = node.location.endLine || startLine;

                        if (startLine !== null && typeof startLine !== 'undefined' &&
                            endLine !== null && typeof endLine !== 'undefined') {
                            minLine = Math.min(minLine, startLine);
                            maxLine = Math.max(maxLine, endLine);
                            foundAny = true;
                        }
                    }
                    break;
                }
            }

            // Visit next block
            if (block && block.next) {
                visitBlock(block.next);
            }

            // Visit inputs (for nested blocks and substacks)
            if (block && block.inputs) {
                Object.entries(block.inputs).forEach(([_key, input]) => {
                    if (input && input.block) {
                        visitBlock(input.block);
                    }
                });
            }
        };

        visitBlock(topBlockId);

        if (foundAny) {
            // Extend range to include closing 'end' lines from container nodes
            let bestContainer = null;
            let bestContainerSize = Infinity;

            if (this._context.containerNodeRanges) {
                this._context.containerNodeRanges.forEach(container => {
                    // Only consider 'BlockNode' type containers (do...end blocks)
                    // Skip others as they are often too broad
                    if (container.type !== 'BlockNode') {
                        return;
                    }

                    // If container starts at minLine and ends after maxLine
                    if (container.startLine === minLine && container.endLine > maxLine) {
                        const containerSize = container.endLine - container.startLine;
                        if (containerSize < bestContainerSize) {
                            bestContainer = container;
                            bestContainerSize = containerSize;
                        }
                    }
                });

                if (bestContainer) {
                    maxLine = bestContainer.endLine;
                }
            }

            return {startLine: minLine, endLine: maxLine};
        }

        return null;
    }
};

export default LineMappingUtils;
