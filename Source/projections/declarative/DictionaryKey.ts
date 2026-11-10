// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { PropertyAccessor, PropertyPathResolverProxyHandler } from '@cratis/fundamentals';
import type { EventContext } from '../../events/EventContext.js';
import { CausedByProperty, causedByProperty } from '../causedBy.js';
import { eventContextPropertyExpression } from '../eventContextPropertyExpression.js';
import { InvalidEventContextPropertyError } from '../InvalidEventContextPropertyError.js';
import { InvalidDictionaryKey } from './InvalidDictionaryKey.js';

/**
 * Where the key of a dictionary entry comes from when a projection maps into a dictionary-typed read model property.
 * Pass a plain accessor on the event for the common case; use the factory methods for keys from the event content,
 * the event context or the identity that caused the event.
 */
export class DictionaryKey {
    private constructor(readonly expression: string) {}

    /**
     * The key is read from a property of the event content. Nested paths are supported; the kernel requires the
     * property to exist on the event (case-sensitively) and an event without a value for it leaves the dictionary as it is.
     * @param eventPropertyAccessor - Accessor for the event property holding the key.
     * @returns The dictionary key.
     */
    static fromEventContent<TEvent>(eventPropertyAccessor: PropertyAccessor<TEvent>): DictionaryKey {
        const handler = new PropertyPathResolverProxyHandler();
        eventPropertyAccessor(new Proxy({}, handler) as TEvent);
        const path = handler.path;
        if (!/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/.test(path) || path.split('.').some(segment => segment.startsWith('$'))) {
            throw new InvalidDictionaryKey(path);
        }
        return new DictionaryKey(`$eventContent.${path}`);
    }

    /**
     * The key is read from the event context, for instance `eventSourceId` or `causedBy.subject`.
     * @param contextProperty - The event context property name, or an accessor on the {@link EventContext}.
     * @returns The dictionary key.
     */
    static fromEventContext(contextProperty: string | PropertyAccessor<EventContext>): DictionaryKey {
        let path: string;
        if (typeof contextProperty === 'function') {
            const handler = new PropertyPathResolverProxyHandler();
            contextProperty(new Proxy({}, handler) as EventContext);
            path = handler.path;
        } else {
            path = contextProperty;
        }
        if (path.endsWith('()')) {
            throw new InvalidEventContextPropertyError(path);
        }
        eventContextPropertyExpression(path);
        const camelCased = path.split('.').map(segment => segment.charAt(0).toLowerCase() + segment.slice(1)).join('.');
        return new DictionaryKey(`$eventContext.${camelCased}`);
    }

    /**
     * The key is a member of the identity that caused the event.
     * @param property - The identity member: `subject`, `name` or `userName`.
     * @returns The dictionary key.
     */
    static causedBy(property: CausedByProperty): DictionaryKey {
        return new DictionaryKey(`$causedBy.${causedByProperty(property)}`);
    }
}

/** A dictionary key: an accessor on the event (the key is read from the event content) or a {@link DictionaryKey}. */
export type DictionaryKeySource<TEvent> = PropertyAccessor<TEvent> | DictionaryKey;

/**
 * Resolves a dictionary key source to its {@link DictionaryKey}.
 * @param key - The key source.
 * @returns The dictionary key.
 */
export function toDictionaryKey<TEvent>(key: DictionaryKeySource<TEvent>): DictionaryKey {
    return key instanceof DictionaryKey ? key : DictionaryKey.fromEventContent(key);
}

/**
 * Builds the target property path of a dictionary entry: `<dictionary>.<key expression>`, for example
 * `slots.$eventContent.category`.
 * @param dictionaryProperty - The dictionary-typed read model property.
 * @param key - Where the key of the entry comes from.
 * @returns The dynamic property path the kernel resolves per event.
 */
export function dictionaryEntryPath<TEvent>(dictionaryProperty: string, key: DictionaryKeySource<TEvent>): string {
    return `${dictionaryProperty}.${toDictionaryKey(key).expression}`;
}
