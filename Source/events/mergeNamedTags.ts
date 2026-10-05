// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { InvalidNamedTag } from './InvalidNamedTag.js';
import { NamedTag } from './NamedTag.js';

/**
 * Validates and merges structured named tags - for example the tags carried by an individual event and
 * the tags supplied for a whole append call - into one distinct list. The first occurrence of each exact
 * (ordinal, case-sensitive) name and value pair is kept, in order. Mirrors the .NET client's
 * `NamedTagConverters.Merge`.
 * @param sources - The named tag sources to merge, in precedence order. An undefined or null source contributes nothing.
 * @returns The distinct, validated named tags.
 * @throws {@link InvalidNamedTag} when a source is not iterable, contains an entry that is not an object,
 * or contains a tag with a blank name or a non-string value.
 */
export function mergeNamedTags(...sources: ReadonlyArray<Iterable<NamedTag> | undefined | null>): NamedTag[] {
    const seen = new Set<string>();
    const merged: NamedTag[] = [];
    for (const source of sources) {
        if (source === undefined || source === null) continue;
        if (typeof source !== 'object' || typeof (source as Iterable<NamedTag>)[Symbol.iterator] !== 'function') {
            throw new InvalidNamedTag();
        }
        for (const entry of source as Iterable<unknown>) {
            if (entry === null || typeof entry !== 'object') throw new InvalidNamedTag();
            // Reconstruct so plain { name, value } objects are validated exactly like NamedTag instances.
            const tag = entry instanceof NamedTag ? entry
                : new NamedTag(Reflect.get(entry, 'name') as string, Reflect.get(entry, 'value') as string);
            const key = JSON.stringify([tag.name, tag.value]);
            if (seen.has(key)) continue;
            seen.add(key);
            merged.push(tag);
        }
    }
    return merged;
}
