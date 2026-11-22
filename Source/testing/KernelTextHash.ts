// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

const surrogatePair = /[\ud800-\udbff][\udc00-\udfff]/g;

function escapeUnit(unit: string): string {
    return `\\u${unit.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}`;
}

/**
 * The kernel hashes JSON written with the relaxed encoder, which escapes every supplementary-plane character
 * as two uppercase UTF-16 escapes while keeping measured BMP characters literal. Only actual surrogate pairs are
 * rewritten, so literal backslash-u text and the stored content are untouched.
 */
export function kernelEscapedJson(json: string): string {
    return json.replace(surrogatePair, pair => escapeUnit(pair[0]) + escapeUnit(pair[1]));
}
