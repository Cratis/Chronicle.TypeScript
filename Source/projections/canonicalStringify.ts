// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Serializes a definition with recursively sorted object keys while preserving array order. */
export function canonicalStringify(value: Record<string, unknown>): string {
    return JSON.stringify(value, (_key, member: unknown) => {
        if (member === null || typeof member !== 'object' || Array.isArray(member)) {
            return member;
        }
        return Object.fromEntries(Object.keys(member).sort().map(key => [key, (member as Record<string, unknown>)[key]]));
    });
}
