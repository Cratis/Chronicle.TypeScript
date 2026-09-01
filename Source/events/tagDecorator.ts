// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { Tag } from './Tag';
import { mergeTags } from './mergeTags';

/** Metadata key used to store the tags labeling a class. */
const TAGS_METADATA_KEY = 'chronicle:tags';

/**
 * TypeScript decorator that labels an event type, reactor, or reducer with one or more tags.
 * This is the TypeScript equivalent of the C# `[Tag]` attribute.
 *
 * Applying the decorator more than once accumulates tags rather than replacing them, so
 * `@tag('a')` followed by `@tag('b')` on the same class results in both `'a'` and `'b'`.
 *
 * @param values - The tags to apply.
 * @returns A class decorator.
 *
 * @example
 * ```typescript
 * @eventType()
 * @tag('analytics', 'user-action')
 * class UserLoggedIn {
 *     constructor(readonly userId: string) {}
 * }
 * ```
 */
export function tag(...values: string[]): ClassDecorator {
    return (target: object) => addTags(target, values);
}

/**
 * TypeScript decorator that labels an event type, reactor, or reducer with one or more tags.
 * This is the TypeScript equivalent of the C# `[Tags]` attribute, and behaves identically to
 * {@link tag} - use whichever reads more naturally at the call site.
 *
 * @param values - The tags to apply.
 * @returns A class decorator.
 */
export function tags(...values: string[]): ClassDecorator {
    return (target: object) => addTags(target, values);
}

function addTags(target: object, values: string[]): void {
    const existing = (Reflect.getMetadata(TAGS_METADATA_KEY, target) as Tag[] | undefined) ?? [];
    const merged = mergeTags(existing, values).map(value => new Tag(value));
    Reflect.defineMetadata(TAGS_METADATA_KEY, merged, target);
}

/**
 * Gets all tags applied to a class via {@link tag} or {@link tags}.
 * @param target - The class constructor to retrieve tags for.
 * @returns The tags applied to the class, or an empty array if none are.
 */
export function getTagsFor(target: Function): Tag[] {
    return (Reflect.getMetadata(TAGS_METADATA_KEY, target) as Tag[] | undefined) ?? [];
}
