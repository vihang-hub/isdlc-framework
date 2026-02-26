'use strict';

/**
 * TOON (Token-Oriented Object Notation) Encoder/Decoder
 * ======================================================
 * Pure CJS implementation with zero npm dependencies.
 * Encodes uniform arrays of objects into a compact tabular format
 * that reduces token consumption in session cache.
 *
 * TOON Format:
 *   [N]{field1,field2,...}:
 *     value1,value2,...
 *     value1,value2,...
 *
 * Traces to: REQ-0040 (FR-001, FR-002), ADR-0040-01 (Native CJS encoder)
 *
 * @module toon-encoder
 * @version 1.0.0
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of rows allowed in a single TOON block */
const MAX_ROWS = 10000;

/** Characters that require quoting in TOON values */
const SPECIAL_CHARS = /[,"\n\\]/;

// ---------------------------------------------------------------------------
// isUniformArray
// ---------------------------------------------------------------------------

/**
 * Checks whether the input is a non-empty array of plain objects that all
 * share exactly the same set of keys.
 *
 * @param {*} data - The value to check
 * @returns {boolean} true if data is a uniform array of objects
 */
function isUniformArray(data) {
    if (!Array.isArray(data)) return false;
    if (data.length === 0) return false;

    const first = data[0];
    if (first === null || typeof first !== 'object' || Array.isArray(first)) return false;

    const keys = Object.keys(first);
    if (keys.length === 0) return false;

    const keySet = keys.join(',');

    for (let i = 1; i < data.length; i++) {
        const item = data[i];
        if (item === null || typeof item !== 'object' || Array.isArray(item)) return false;
        const itemKeys = Object.keys(item);
        if (itemKeys.join(',') !== keySet) return false;
    }

    return true;
}

// ---------------------------------------------------------------------------
// Value serialization
// ---------------------------------------------------------------------------

/**
 * Serializes a single JS value to its TOON string representation.
 *
 * | JS Type            | TOON Serialization                         |
 * |--------------------|--------------------------------------------|
 * | string (simple)    | Bare, unquoted                             |
 * | string (special)   | Double-quoted, escaped                     |
 * | number             | Numeric literal                            |
 * | boolean            | true/false                                 |
 * | null               | null literal                               |
 * | undefined          | null literal                               |
 * | object/array       | JSON.stringify()                           |
 *
 * @param {*} value - The value to serialize
 * @returns {string} TOON-encoded value
 */
function serializeValue(value) {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'boolean') return String(value);
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string') {
        if (value.length === 0) return '""';
        if (SPECIAL_CHARS.test(value)) {
            // Double-quote and escape special characters
            const escaped = value
                .replace(/\\/g, '\\\\')
                .replace(/"/g, '\\"')
                .replace(/\n/g, '\\n');
            return '"' + escaped + '"';
        }
        return value;
    }
    // object or array — fallback to JSON
    return JSON.stringify(value);
}

/**
 * Deserializes a single TOON value string back to a JS value.
 *
 * @param {string} raw - The raw TOON value string
 * @returns {*} The deserialized JS value
 */
function deserializeValue(raw) {
    if (raw === 'null') return null;
    if (raw === 'true') return true;
    if (raw === 'false') return false;

    // Check for quoted string
    if (raw.length >= 2 && raw[0] === '"' && raw[raw.length - 1] === '"') {
        const inner = raw.slice(1, -1);
        return inner
            .replace(/\\n/g, '\n')
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\');
    }

    // Try number
    if (raw !== '' && !isNaN(raw) && raw.trim() === raw) {
        const num = Number(raw);
        if (isFinite(num)) return num;
    }

    // Try JSON parse for objects/arrays
    if ((raw[0] === '{' || raw[0] === '[')) {
        try {
            return JSON.parse(raw);
        } catch (_) {
            // Fall through to string
        }
    }

    // Plain string
    return raw;
}

// ---------------------------------------------------------------------------
// Row parsing helper
// ---------------------------------------------------------------------------

/**
 * Splits a TOON data row into individual value tokens, respecting quoted strings.
 *
 * @param {string} line - The data row (without leading whitespace)
 * @returns {string[]} Array of raw value tokens
 */
function splitRow(line) {
    const tokens = [];
    let current = '';
    let inQuotes = false;
    let i = 0;

    while (i < line.length) {
        const ch = line[i];

        if (inQuotes) {
            if (ch === '\\' && i + 1 < line.length) {
                current += ch + line[i + 1];
                i += 2;
                continue;
            }
            if (ch === '"') {
                current += ch;
                inQuotes = false;
                i++;
                continue;
            }
            current += ch;
            i++;
        } else {
            if (ch === '"') {
                inQuotes = true;
                current += ch;
                i++;
                continue;
            }
            if (ch === ',') {
                tokens.push(current);
                current = '';
                i++;
                continue;
            }
            current += ch;
            i++;
        }
    }

    tokens.push(current);
    return tokens;
}

// ---------------------------------------------------------------------------
// encode
// ---------------------------------------------------------------------------

/**
 * Encodes a uniform array of objects into TOON tabular format.
 *
 * @param {Array<Object>} data - Array of uniform plain objects
 * @returns {string} TOON-encoded string
 * @throws {TypeError} If data is not a uniform array of objects
 * @throws {RangeError} If data exceeds MAX_ROWS (10,000)
 */
function encode(data) {
    if (!isUniformArray(data)) {
        throw new TypeError('encode() requires a non-empty uniform array of objects');
    }
    if (data.length > MAX_ROWS) {
        throw new RangeError(`encode() input exceeds maximum of ${MAX_ROWS} rows (got ${data.length})`);
    }

    const fields = Object.keys(data[0]);
    const header = `[${data.length}]{${fields.join(',')}}:`;

    const rows = data.map(obj => {
        return '  ' + fields.map(f => serializeValue(obj[f])).join(',');
    });

    return header + '\n' + rows.join('\n');
}

// ---------------------------------------------------------------------------
// decode
// ---------------------------------------------------------------------------

/**
 * Decodes a TOON-encoded string back to an array of objects.
 * On any parse failure, falls back to JSON.parse() (fail-open per ADR-0040-03).
 *
 * @param {string} toonString - The TOON-encoded string
 * @returns {Array<Object>} Decoded array of objects
 */
function decode(toonString) {
    try {
        if (typeof toonString !== 'string' || toonString.length === 0) {
            return JSON.parse(toonString);
        }

        const lines = toonString.split('\n');
        const headerLine = lines[0].trim();

        // Parse header: [N]{field1,field2,...}:
        const headerMatch = headerLine.match(/^\[(\d+)]\{([^}]+)}:$/);
        if (!headerMatch) {
            return JSON.parse(toonString);
        }

        const expectedCount = parseInt(headerMatch[1], 10);
        const fields = headerMatch[2].split(',');

        const result = [];
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.length === 0) continue;

            const values = splitRow(line);
            if (values.length !== fields.length) {
                // Mismatch -- fall back to JSON
                return JSON.parse(toonString);
            }

            const obj = {};
            for (let j = 0; j < fields.length; j++) {
                obj[fields[j]] = deserializeValue(values[j]);
            }
            result.push(obj);
        }

        if (result.length !== expectedCount) {
            // Row count mismatch -- fall back to JSON
            return JSON.parse(toonString);
        }

        return result;
    } catch (_) {
        // Final fallback: try JSON.parse
        try {
            return JSON.parse(toonString);
        } catch (jsonErr) {
            throw new SyntaxError('Failed to decode: input is neither valid TOON nor valid JSON');
        }
    }
}

// ---------------------------------------------------------------------------
// isPrimitiveArray (REQ-0041)
// ---------------------------------------------------------------------------

/**
 * Checks whether the input is an array containing only primitive values
 * (string, number, boolean, null). Empty arrays return true.
 *
 * Traces to: REQ-0041 FR-003 (AC-003-01 through AC-003-05)
 *
 * @param {*} data - The value to check
 * @returns {boolean} true if data is an array of only primitives
 */
function isPrimitiveArray(data) {
    if (!Array.isArray(data)) return false;
    for (let i = 0; i < data.length; i++) {
        const v = data[i];
        if (v !== null && typeof v === 'object') return false;
        if (typeof v === 'undefined') continue; // treat undefined as primitive-ish
        if (typeof v !== 'string' && typeof v !== 'number' && typeof v !== 'boolean') {
            if (v !== null) return false;
        }
    }
    return true;
}

// ---------------------------------------------------------------------------
// encodeValue (REQ-0041)
// ---------------------------------------------------------------------------

/**
 * Encodes any JavaScript value into TOON (Token-Oriented Object Notation) format.
 *
 * Handles nested objects, primitive arrays, mixed arrays, and delegates to
 * encode() for uniform arrays of objects. Produces indentation-based output
 * optimized for LLM context consumption.
 *
 * Traces to: REQ-0041 FR-001 through FR-006
 *
 * @param {*} data - Any JavaScript value
 * @param {object} [options={}]
 * @param {number} [options.indent=0] - Starting indentation level (2 spaces per level)
 * @param {string[]} [options.stripKeys=[]] - Keys to omit at all nesting levels
 * @returns {string} TOON-encoded string
 */
function encodeValue(data, options = {}) {
    const indent = options.indent || 0;
    const stripKeys = options.stripKeys || [];

    // Primitives
    if (data === null || data === undefined) return serializeValue(data);
    if (typeof data === 'boolean') return serializeValue(data);
    if (typeof data === 'number') return serializeValue(data);
    if (typeof data === 'string') return serializeValue(data);

    // Arrays
    if (Array.isArray(data)) {
        // Uniform array of objects => tabular format
        if (isUniformArray(data)) {
            // Apply stripKeys to uniform arrays before encoding
            if (stripKeys.length > 0) {
                const stripped = data.map(obj => {
                    const result = {};
                    for (const k of Object.keys(obj)) {
                        if (!stripKeys.includes(k)) result[k] = obj[k];
                    }
                    return result;
                });
                // Re-check uniformity after stripping
                if (isUniformArray(stripped)) {
                    return encode(stripped);
                }
            } else {
                return encode(data);
            }
        }
        // Empty array => inline form
        if (data.length === 0) {
            return '[0]:';
        }
        // Primitive array => inline form (without key prefix, caller adds key)
        if (isPrimitiveArray(data)) {
            const vals = data.map(v => serializeValue(v)).join(',');
            return '[' + data.length + ']: ' + vals;
        }
        // Mixed/object array => list form
        return _encodeListArray(data, indent, stripKeys);
    }

    // Plain object
    if (typeof data === 'object') {
        return _encodeObject(data, indent, stripKeys);
    }

    // Fallback
    return String(data);
}

/**
 * Encodes a plain object as indented key-value pairs.
 * Internal helper called by encodeValue().
 *
 * @param {object} obj - Plain object to encode
 * @param {number} indent - Current indentation level
 * @param {string[]} stripKeys - Keys to omit
 * @returns {string} Encoded lines joined by newlines
 */
function _encodeObject(obj, indent, stripKeys) {
    const prefix = '  '.repeat(indent);
    const lines = [];

    for (const key of Object.keys(obj)) {
        if (stripKeys.includes(key)) continue;

        const value = obj[key];

        // Null / undefined / primitives
        if (value === null || value === undefined) {
            lines.push(prefix + key + ': ' + serializeValue(value));
            continue;
        }
        if (typeof value === 'boolean' || typeof value === 'number') {
            lines.push(prefix + key + ': ' + serializeValue(value));
            continue;
        }
        if (typeof value === 'string') {
            lines.push(prefix + key + ': ' + serializeValue(value));
            continue;
        }

        // Array values
        if (Array.isArray(value)) {
            // Empty array
            if (value.length === 0) {
                lines.push(prefix + key + '[0]:');
                continue;
            }
            // Primitive array => inline form
            if (isPrimitiveArray(value)) {
                const vals = value.map(v => serializeValue(v)).join(',');
                lines.push(prefix + key + '[' + value.length + ']: ' + vals);
                continue;
            }
            // Uniform array of objects => tabular, indented
            if (isUniformArray(value)) {
                // Apply stripKeys to elements before encoding
                let arrToEncode = value;
                if (stripKeys.length > 0) {
                    arrToEncode = value.map(item => {
                        const result = {};
                        for (const k of Object.keys(item)) {
                            if (!stripKeys.includes(k)) result[k] = item[k];
                        }
                        return result;
                    });
                    if (!isUniformArray(arrToEncode)) {
                        // Degraded to non-uniform after stripping; use list form
                        lines.push(prefix + key + ':');
                        const listContent = _encodeListArray(arrToEncode, indent + 1, stripKeys);
                        lines.push(listContent);
                        continue;
                    }
                }
                lines.push(prefix + key + ':');
                const tabular = encode(arrToEncode);
                // Indent the tabular output
                const tabLines = tabular.split('\n').map(l => '  '.repeat(indent + 1) + l);
                lines.push(tabLines.join('\n'));
                continue;
            }
            // Non-uniform/mixed array => list form
            lines.push(prefix + key + ':');
            const listContent = _encodeListArray(value, indent + 1, stripKeys);
            lines.push(listContent);
            continue;
        }

        // Nested object
        if (typeof value === 'object') {
            const nested = _encodeObject(value, indent + 1, stripKeys);
            if (nested.trim().length === 0) {
                // Empty nested object
                lines.push(prefix + key + ':');
            } else {
                lines.push(prefix + key + ':');
                lines.push(nested);
            }
            continue;
        }
    }

    return lines.join('\n');
}

/**
 * Encodes an array in list form with `- ` prefix.
 * Internal helper called by _encodeObject() and encodeValue().
 *
 * @param {Array} arr - Array to encode
 * @param {number} indent - Current indentation level
 * @param {string[]} stripKeys - Keys to omit from object elements
 * @returns {string} Encoded list content
 */
function _encodeListArray(arr, indent, stripKeys) {
    const prefix = '  '.repeat(indent);
    const lines = [];

    for (const item of arr) {
        if (item === null || item === undefined ||
            typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
            // Primitive list item
            lines.push(prefix + '- ' + serializeValue(item));
        } else if (Array.isArray(item)) {
            // Nested array in list
            if (isPrimitiveArray(item) && item.length > 0) {
                const vals = item.map(v => serializeValue(v)).join(',');
                lines.push(prefix + '- [' + item.length + ']: ' + vals);
            } else if (item.length === 0) {
                lines.push(prefix + '- [0]:');
            } else {
                lines.push(prefix + '-');
                const nested = _encodeListArray(item, indent + 1, stripKeys);
                lines.push(nested);
            }
        } else if (typeof item === 'object') {
            // Object list item: first key on `- ` line, rest indented
            const keys = Object.keys(item).filter(k => !stripKeys.includes(k));
            if (keys.length === 0) {
                lines.push(prefix + '-');
                continue;
            }
            const firstKey = keys[0];
            const firstValue = item[firstKey];

            // Check if first value is primitive
            if (firstValue === null || firstValue === undefined ||
                typeof firstValue === 'string' || typeof firstValue === 'number' || typeof firstValue === 'boolean') {
                lines.push(prefix + '- ' + firstKey + ': ' + serializeValue(firstValue));
            } else if (Array.isArray(firstValue)) {
                if (isPrimitiveArray(firstValue) || firstValue.length === 0) {
                    if (firstValue.length === 0) {
                        lines.push(prefix + '- ' + firstKey + '[0]:');
                    } else {
                        const vals = firstValue.map(v => serializeValue(v)).join(',');
                        lines.push(prefix + '- ' + firstKey + '[' + firstValue.length + ']: ' + vals);
                    }
                } else {
                    lines.push(prefix + '- ' + firstKey + ':');
                    const arrContent = _encodeListArray(firstValue, indent + 2, stripKeys);
                    lines.push(arrContent);
                }
            } else {
                // Nested object as first value
                lines.push(prefix + '- ' + firstKey + ':');
                const nested = _encodeObject(firstValue, indent + 2, stripKeys);
                lines.push(nested);
            }

            // Remaining keys at indent + 1
            for (let ki = 1; ki < keys.length; ki++) {
                const k = keys[ki];
                const v = item[k];
                const restPrefix = '  '.repeat(indent + 1);

                if (v === null || v === undefined ||
                    typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
                    lines.push(restPrefix + k + ': ' + serializeValue(v));
                } else if (Array.isArray(v)) {
                    if (isPrimitiveArray(v) || v.length === 0) {
                        if (v.length === 0) {
                            lines.push(restPrefix + k + '[0]:');
                        } else {
                            const vals = v.map(vi => serializeValue(vi)).join(',');
                            lines.push(restPrefix + k + '[' + v.length + ']: ' + vals);
                        }
                    } else {
                        lines.push(restPrefix + k + ':');
                        const arrContent = _encodeListArray(v, indent + 2, stripKeys);
                        lines.push(arrContent);
                    }
                } else if (typeof v === 'object') {
                    lines.push(restPrefix + k + ':');
                    const nested = _encodeObject(v, indent + 2, stripKeys);
                    lines.push(nested);
                }
            }
        }
    }

    return lines.join('\n');
}

// ---------------------------------------------------------------------------
// decodeValue (REQ-0041)
// ---------------------------------------------------------------------------

/**
 * Decodes a TOON-encoded string back to a JavaScript value.
 * Handles indentation-based objects, inline arrays, list-form arrays,
 * and tabular format. Intended for test round-trip verification.
 *
 * Falls back to JSON.parse() if the input does not appear to be TOON format.
 *
 * Traces to: REQ-0041 FR-008 (AC-008-01 through AC-008-05)
 *
 * @param {string} toonString - TOON-encoded string
 * @returns {*} Decoded JavaScript value
 * @throws {SyntaxError} If input is neither valid TOON nor valid JSON
 */
function decodeValue(toonString) {
    if (typeof toonString !== 'string') {
        throw new SyntaxError('decodeValue requires a string input');
    }

    // Empty string
    if (toonString.trim().length === 0) {
        // Try JSON.parse first
        try { return JSON.parse(toonString); } catch (_) {}
        throw new SyntaxError('Failed to decode: empty input');
    }

    // Single-line primitives
    const trimmed = toonString.trim();
    if (trimmed === 'null') return null;
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;

    // Single-line number
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
        return Number(trimmed);
    }

    // Single-line quoted string
    if (trimmed.length >= 2 && trimmed[0] === '"' && trimmed[trimmed.length - 1] === '"') {
        return deserializeValue(trimmed);
    }

    // Check for tabular format: [N]{fields}:
    const tabularMatch = trimmed.match(/^\[(\d+)]\{([^}]+)}:/);
    if (tabularMatch) {
        return decode(toonString);
    }

    // Check if it looks like JSON
    if (trimmed[0] === '{') {
        try { return JSON.parse(toonString); } catch (_) {}
    }
    if (trimmed[0] === '[' && !tabularMatch) {
        try { return JSON.parse(toonString); } catch (_) {}
    }

    const lines = toonString.split('\n');
    const nonEmptyLines = lines.filter(l => l.trim().length > 0);

    // Single-line bare string: no colon for key-value, no list prefix, no structure
    if (nonEmptyLines.length === 1) {
        const single = nonEmptyLines[0].trim();
        // If it contains `: ` or ends with `:` followed by nothing/array marker, parse as KV
        const hasKV = single.match(/^[^:\[]+:\s/) || single.match(/^[^:\[]+\[\d+]:/);
        if (!hasKV) {
            // Bare string value
            return deserializeValue(single);
        }
    }

    // Check for top-level list form (first non-empty line starts with `- `)
    if (nonEmptyLines.length > 0 && nonEmptyLines[0].trim().startsWith('- ')) {
        return _decodeLines(lines, 0, 0, lines.length).value;
    }

    // Validate that the input looks like TOON key-value pairs (at least one line with `:`)
    const hasStructure = nonEmptyLines.some(l => {
        const t = l.trim();
        return t.includes(': ') || t.match(/^[^:\[]+:$/) || t.match(/^[^:\[]+\[\d+]:/);
    });
    if (!hasStructure) {
        // Not TOON structure -- try JSON.parse as last resort
        try { return JSON.parse(toonString); } catch (_) {}
        throw new SyntaxError('Failed to decode: input is neither valid TOON nor valid JSON');
    }

    // Multi-line: parse as object (key-value pairs)
    const result = _decodeLines(lines, 0, 0, lines.length);
    return result.value;
}

/**
 * Gets the indentation level of a line (number of leading spaces / 2).
 */
function _getIndent(line) {
    let spaces = 0;
    for (let i = 0; i < line.length; i++) {
        if (line[i] === ' ') spaces++;
        else break;
    }
    return Math.floor(spaces / 2);
}

/**
 * Recursive line-by-line parser for TOON format.
 * Returns { value, nextLine } where nextLine is the index after parsed content.
 */
function _decodeLines(lines, baseIndent, startLine, endLine) {
    // Check first non-empty line to determine structure type
    let firstNonEmpty = startLine;
    while (firstNonEmpty < endLine && lines[firstNonEmpty].trim().length === 0) {
        firstNonEmpty++;
    }
    if (firstNonEmpty >= endLine) {
        return { value: '', nextLine: endLine };
    }

    const firstLine = lines[firstNonEmpty];
    const firstTrimmed = firstLine.trim();

    // Tabular format
    const tabMatch = firstTrimmed.match(/^\[(\d+)]\{([^}]+)}:$/);
    if (tabMatch) {
        // Collect all lines until end or until indent drops
        const toonLines = [firstTrimmed];
        let i = firstNonEmpty + 1;
        while (i < endLine) {
            const line = lines[i];
            if (line.trim().length === 0) { i++; continue; }
            const lineIndent = _getIndent(line);
            if (lineIndent <= baseIndent && !line.trim().startsWith(' ')) {
                // Allow data rows that have indent relative to tabular header
                if (lineIndent > _getIndent(firstLine)) {
                    toonLines.push(line.trim());
                    i++;
                    continue;
                }
                break;
            }
            toonLines.push('  ' + line.trim());
            i++;
        }
        return { value: decode(toonLines.join('\n')), nextLine: i };
    }

    // List form: lines starting with `- `
    if (firstTrimmed.startsWith('- ')) {
        const arr = [];
        let i = firstNonEmpty;
        const listIndent = _getIndent(firstLine);

        while (i < endLine) {
            const line = lines[i];
            if (line.trim().length === 0) { i++; continue; }

            const lineIndent = _getIndent(line);
            if (lineIndent < listIndent) break;
            if (lineIndent === listIndent && !line.trim().startsWith('- ')) break;

            if (lineIndent === listIndent && line.trim().startsWith('- ')) {
                const content = line.trim().slice(2); // Remove `- ` prefix

                // Check if it's a key-value pair
                const kvMatch = content.match(/^([^:\[]+)\[(\d+)]:\s*(.*)$/);
                if (kvMatch) {
                    // Inline array in list item
                    const obj = {};
                    const arrKey = kvMatch[1];
                    const count = parseInt(kvMatch[2], 10);
                    const valsStr = kvMatch[3];
                    if (count === 0 || valsStr.trim() === '') {
                        obj[arrKey] = [];
                    } else {
                        obj[arrKey] = splitRow(valsStr).map(v => deserializeValue(v.trim()));
                    }
                    // Check for continuation lines
                    i++;
                    while (i < endLine) {
                        const nextLine = lines[i];
                        if (nextLine.trim().length === 0) { i++; continue; }
                        const nextIndent = _getIndent(nextLine);
                        if (nextIndent <= listIndent) break;
                        // Parse additional key-value pairs for this object
                        _parseKVLine(nextLine.trim(), obj, lines, i, endLine, nextIndent);
                        i = _skipBlock(lines, i, endLine, nextIndent);
                    }
                    if (Object.keys(obj).length === 1 && typeof Object.values(obj)[0] !== 'object') {
                        arr.push(obj);
                    } else {
                        arr.push(obj);
                    }
                    continue;
                }

                const simpleKvMatch = content.match(/^([^:]+):\s+(.+)$/);
                if (simpleKvMatch && !content.match(/^[^:]+:\s*$/)) {
                    // key: value on the `- ` line -- start of an object element
                    const obj = {};
                    const k = simpleKvMatch[1].trim();
                    obj[k] = deserializeValue(simpleKvMatch[2].trim());

                    // Collect continuation lines at deeper indent
                    i++;
                    while (i < endLine) {
                        const nextLine = lines[i];
                        if (nextLine.trim().length === 0) { i++; continue; }
                        const nextIndent = _getIndent(nextLine);
                        if (nextIndent <= listIndent) break;
                        // Parse additional key-value pairs for this object
                        const kvParsed = _parseObjectBlock(lines, i, endLine, listIndent + 1);
                        Object.assign(obj, kvParsed.value);
                        i = kvParsed.nextLine;
                        break; // only one block of continuation
                    }
                    arr.push(obj);
                    continue;
                }

                // Check for key: (with nothing after, starting nested block)
                const nestedKeyMatch = content.match(/^([^:]+):\s*$/);
                if (nestedKeyMatch) {
                    const obj = {};
                    const k = nestedKeyMatch[1].trim();
                    i++;
                    // Parse nested content
                    const blockEnd = _findBlockEnd(lines, i, endLine, listIndent + 1);
                    const nested = _decodeLines(lines, listIndent + 1, i, blockEnd);
                    obj[k] = nested.value;
                    i = nested.nextLine;

                    // Check for sibling keys at listIndent + 1
                    while (i < endLine) {
                        const nextLine = lines[i];
                        if (nextLine.trim().length === 0) { i++; continue; }
                        const nextIndent = _getIndent(nextLine);
                        if (nextIndent <= listIndent) break;
                        if (nextIndent === listIndent + 1) {
                            const sibling = _parseObjectBlock(lines, i, endLine, listIndent + 1);
                            Object.assign(obj, sibling.value);
                            i = sibling.nextLine;
                        } else {
                            break;
                        }
                    }
                    arr.push(obj);
                    continue;
                }

                // Plain primitive value after `- `
                arr.push(deserializeValue(content));
                i++;
                continue;
            }

            i++;
        }
        return { value: arr, nextLine: i };
    }

    // Object form: key-value pairs
    return _parseObjectBlock(lines, startLine, endLine, baseIndent);
}

/**
 * Parse a block of key-value pairs as an object.
 */
function _parseObjectBlock(lines, startLine, endLine, baseIndent) {
    const obj = {};
    let i = startLine;

    while (i < endLine) {
        const line = lines[i];
        if (line.trim().length === 0) { i++; continue; }

        const lineIndent = _getIndent(line);
        if (lineIndent < baseIndent) break;
        if (lineIndent > baseIndent) { i++; continue; } // skip deeper lines handled by recursion

        const trimmedLine = line.trim();

        // Inline array: key[N]: values
        const inlineArrMatch = trimmedLine.match(/^([^:\[]+)\[(\d+)]:\s*(.*)$/);
        if (inlineArrMatch) {
            const key = inlineArrMatch[1].trim();
            const count = parseInt(inlineArrMatch[2], 10);
            const valsStr = inlineArrMatch[3];
            if (count === 0 || valsStr.trim() === '') {
                obj[key] = [];
            } else {
                obj[key] = splitRow(valsStr).map(v => deserializeValue(v.trim()));
            }
            i++;
            continue;
        }

        // key: value (value on same line)
        const kvMatch = trimmedLine.match(/^([^:]+):\s+(.+)$/);
        if (kvMatch) {
            const key = kvMatch[1].trim();
            obj[key] = deserializeValue(kvMatch[2].trim());
            i++;
            continue;
        }

        // key: (with nothing after -- nested block)
        const nestedMatch = trimmedLine.match(/^([^:]+):\s*$/);
        if (nestedMatch) {
            const key = nestedMatch[1].trim();
            i++;
            const blockEnd = _findBlockEnd(lines, i, endLine, baseIndent + 1);
            const nested = _decodeLines(lines, baseIndent + 1, i, blockEnd);
            obj[key] = nested.value;
            i = nested.nextLine;
            continue;
        }

        // If the line doesn't match any pattern, it might be a bare value
        // (for single-key single-value at root)
        i++;
    }

    return { value: obj, nextLine: i };
}

/**
 * Find the end of a block at the given indent level.
 */
function _findBlockEnd(lines, startLine, endLine, minIndent) {
    let i = startLine;
    while (i < endLine) {
        const line = lines[i];
        if (line.trim().length === 0) { i++; continue; }
        const lineIndent = _getIndent(line);
        if (lineIndent < minIndent) break;
        i++;
    }
    return i;
}

/**
 * Parse a single key-value line and add to obj.
 */
function _parseKVLine(trimmedLine, obj, lines, lineIndex, endLine, indent) {
    const inlineArrMatch = trimmedLine.match(/^([^:\[]+)\[(\d+)]:\s*(.*)$/);
    if (inlineArrMatch) {
        const key = inlineArrMatch[1].trim();
        const count = parseInt(inlineArrMatch[2], 10);
        const valsStr = inlineArrMatch[3];
        if (count === 0 || valsStr.trim() === '') {
            obj[key] = [];
        } else {
            obj[key] = splitRow(valsStr).map(v => deserializeValue(v.trim()));
        }
        return;
    }

    const kvMatch = trimmedLine.match(/^([^:]+):\s+(.+)$/);
    if (kvMatch) {
        obj[kvMatch[1].trim()] = deserializeValue(kvMatch[2].trim());
        return;
    }

    const nestedMatch = trimmedLine.match(/^([^:]+):\s*$/);
    if (nestedMatch) {
        const key = nestedMatch[1].trim();
        const blockEnd = _findBlockEnd(lines, lineIndex + 1, endLine, indent + 1);
        const nested = _decodeLines(lines, indent + 1, lineIndex + 1, blockEnd);
        obj[key] = nested.value;
    }
}

/**
 * Skip past a block starting at lineIndex.
 */
function _skipBlock(lines, lineIndex, endLine, baseIndent) {
    let i = lineIndex + 1;
    while (i < endLine) {
        const line = lines[i];
        if (line.trim().length === 0) { i++; continue; }
        const indent = _getIndent(line);
        if (indent <= baseIndent) break;
        i++;
    }
    return i;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
    encode,
    decode,
    isUniformArray,
    // Exposed for testing
    serializeValue,
    deserializeValue,
    splitRow,
    MAX_ROWS,
    // REQ-0041: Full TOON spec
    encodeValue,
    decodeValue,
    isPrimitiveArray
};
