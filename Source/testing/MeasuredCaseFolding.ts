// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// constraints-ignore-casing-measurements.json: the kernel applies string.ToLowerInvariant to the joined key text.
// Only these five non-ASCII scalars are measured; neighbours such as Ø, È or U+0302 are not admitted by resemblance.
// The unicode flag matches whole scalars, so a lone or reversed surrogate never matches.
const measuredCasingText = /^[A-Za-z0-9 .@_:\-|{}$\u00c9\u00df\u00e9\u00f8\u0301]*$/u;

/** Text whose .NET lower-invariant mapping was captured by the packaged oracle; no normalization or full folding. */
export function isMeasuredCasingText(value: string): boolean { return measuredCasingText.test(value); }

/** Applies the measured lower-invariant mapping: ASCII letters and U+00C9 only; ß, ø and U+0301 map to themselves. */
export function measuredLowerInvariant(value: string): string {
    return value.replace(/[A-Z\u00c9]/g, letter => letter === '\u00c9' ? '\u00e9' : String.fromCharCode(letter.charCodeAt(0) + 32));
}

type CasingDefinition = { ignoreCasing: boolean; eventDefinitions: ReadonlyArray<{ properties: readonly unknown[] }> };

/** The isolated, unscoped, single-property, removal-free ignoreCasing definition measured for non-ASCII text. */
export function isMeasuredCasingShape(unique: CasingDefinition, scoped: boolean, removable: boolean): boolean {
    return unique.ignoreCasing && !scoped && !removable && unique.eventDefinitions.length === 1 && unique.eventDefinitions[0].properties.length === 1;
}
