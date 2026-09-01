// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { Tag } from './Tag';
import { mergeTags } from './mergeTags';

/** Metadata key used to store the tags a reactor or reducer filters events by. */
const FILTER_TAGS_METADATA_KEY = 'chronicle:filterEventsByTag';

/**
 * TypeScript decorator that restricts a reactor or reducer so that it only handles events
 * that carry a specific tag. This is the TypeScript equivalent of the C# `[FilterEventsByTag]`
 * attribute.
 *
 * Apply this decorator to a `@reactor()` or `@reducer()`-decorated class to filter the observed
 * event stream to events tagged with the given value. Use {@link tag}/{@link tags} when the
 * intent is to *label* an observer for discoverability; use this decorator when the intent is
 * to *filter* which events reach it. Applying the decorator more than once accumulates filter
 * tags - a class handles events carrying any of the applied tags.
 *
 * @param value - The tag value that an event must carry in order to be dispatched to the observer.
 * @returns A class decorator.
 *
 * @example
 * ```typescript
 * @reactor()
 * @filterEventsByTag('vip')
 * class VipWelcomeReactor {
 *     async customerRegistered(event: CustomerRegistered): Promise<void> {
 *         console.log(`Welcome VIP customer ${event.emailAddress}`);
 *     }
 * }
 * ```
 */
export function filterEventsByTag(value: string): ClassDecorator {
    return (target: object) => {
        const existing = (Reflect.getMetadata(FILTER_TAGS_METADATA_KEY, target) as Tag[] | undefined) ?? [];
        const merged = mergeTags(existing, [value]).map(tagValue => new Tag(tagValue));
        Reflect.defineMetadata(FILTER_TAGS_METADATA_KEY, merged, target);
    };
}

/**
 * Gets all filter tags applied to a class via {@link filterEventsByTag}.
 * @param target - The class constructor to retrieve filter tags for.
 * @returns The filter tags applied to the class, or an empty array if none are.
 */
export function getFilterTagsFor(target: Function): Tag[] {
    return (Reflect.getMetadata(FILTER_TAGS_METADATA_KEY, target) as Tag[] | undefined) ?? [];
}
