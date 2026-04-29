// === Smalruby: This file is Smalruby-specific (DNCL→Ruby conversion state) ===

const CJK_ID_TAIL = 'a-zA-Z0-9_\\u3040-\\u309F\\u30A0-\\u30FF\\u4E00-\\u9FFF'

/**
 * Track which uppercase identifiers are arrays within a conversion. Reset
 * via `detectArrayNames` at the start of each `dnclToRuby` invocation.
 * @type {Set<string>}
 */
let arrayNames = new Set()

/**
 * Track names of user-defined functions within a conversion. These should
 * not be prefixed with `@` when referenced (they are method calls, not
 * instance variables).
 * @type {Set<string>}
 */
let functionNames = new Set()

/**
 * Map an identifier from DNCL to Ruby variable name.
 * - Lowercase identifiers → `@name`
 * - Uppercase identifiers with array value → `@_array_Name_`
 * - Uppercase identifiers without array value → `@_var_Name_`
 * @param {string} name - The DNCL identifier.
 * @param {boolean} isArray - Whether the identifier is used as an array.
 * @returns {string} The Ruby variable name.
 */
const mapVarName = (name, isArray = false) => {
  if (/^[A-Z]/.test(name)) {
    return isArray ? `@_array_${name}_` : `@_var_${name}_`
  }
  return `@${name}`
}

/**
 * Detect array names from the full source before line-by-line conversion.
 * An uppercase identifier assigned to an array literal is an array name.
 * @param {string} source - The full DNCL source code.
 */
const detectArrayNames = (source) => {
  arrayNames = new Set()
  const lines = source.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    // Match: UppercaseName = [...]
    const assignMatch = trimmed.match(
      new RegExp(`^([A-Z][${CJK_ID_TAIL}]*)\\s*(?:=|←)\\s*\\[`),
    )
    if (assignMatch) {
      arrayNames.add(assignMatch[1])
    }
    // Match: UppercaseName[...] (array access)
    const accessMatches = trimmed.matchAll(
      new RegExp(`([A-Z][${CJK_ID_TAIL}]*)\\[`, 'g'),
    )
    for (const m of accessMatches) {
      arrayNames.add(m[1])
    }
    // Match: 要素数(UppercaseName)
    const lenMatch = trimmed.match(
      new RegExp(`要素数\\(([A-Z][${CJK_ID_TAIL}]*)\\)`),
    )
    if (lenMatch) {
      arrayNames.add(lenMatch[1])
    }
  }
}

/**
 * Detect user-defined function names from `関数 name(...)` definitions.
 * Runs before line-by-line conversion so calls (including forward
 * references) can be recognized regardless of definition order.
 * @param {string} source - The full DNCL source code.
 */
const detectFunctionNames = (source) => {
  functionNames = new Set()
  const lines = source.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    const m = trimmed.match(/^関数\s+(\w+)\s*\(/)
    if (m) {
      functionNames.add(m[1])
    }
  }
}

/**
 * Check if a name is a known array.
 * @param {string} name - The identifier to check.
 * @returns {boolean} True if the name is a known array.
 */
const isArrayName = (name) => arrayNames.has(name)

/**
 * Check if a name is a known user-defined function.
 * @param {string} name - The identifier to check.
 * @returns {boolean} True if the name is a known function.
 */
const isFunctionName = (name) => functionNames.has(name)

/**
 * Register a new array name. Used when array access syntax `Name[...]` is
 * encountered during line-level identifier conversion.
 * @param {string} name - The array identifier.
 */
const addArrayName = (name) => {
  arrayNames.add(name)
}

export {
  addArrayName,
  detectArrayNames,
  detectFunctionNames,
  isArrayName,
  isFunctionName,
  mapVarName,
}
