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
    MAX_ROWS
};
