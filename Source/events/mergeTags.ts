// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Tag } from './Tag';

/**
 * Merges one or more sources of tags - static tags declared on a type, tags carried by an
 * individual event instance, and tags supplied at call time - into a single, distinct list of
 * tag values. Mirrors the .NET client, which merges static, instance, and dynamic tags the
 * same way before sending an append request.
 * @param sources - The tag sources to merge. Each may be a mix of strings and {@link Tag} instances,
 * or undefined when that source contributed no tags.
 * @returns The distinct, merged tag values.
 */
export function mergeTags(...sources: ReadonlyArray<Iterable<string | Tag> | undefined>): string[] {
    const values = new Set<string>();
    for (const source of sources) {
        if (!source) continue;
        for (const entry of source) {
            const value = typeof entry === 'string' ? entry : entry.value;
            if (value.trim().length > 0) {
                values.add(value);
            }
        }
    }
    return [...values];
}
