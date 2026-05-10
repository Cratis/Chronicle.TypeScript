// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { PropertyAccessor, PropertyPathResolverProxyHandler } from '@cratis/fundamentals';
import { IRemovedWithBuilder } from './IRemovedWithBuilder';

/**
 * Accumulated removal configuration for a removedWith clause.
 */
export interface RemovedWithEntry {
    key: string;
    parentKey: string;
}

/**
 * Concrete implementation of {@link IRemovedWithBuilder}.
 * @template TReadModel - The read model type.
 * @template TEvent - The event type.
 */
export class RemovedWithBuilder<TReadModel, TEvent> implements IRemovedWithBuilder<TReadModel, TEvent> {
    readonly entry: RemovedWithEntry = {
        key: '$eventSourceId',
        parentKey: ''
    };

    /** @inheritdoc */
    usingKey(keyAccessor: PropertyAccessor<TEvent>): this {
        const handler = new PropertyPathResolverProxyHandler();
        const proxy = new Proxy({}, handler);
        keyAccessor(proxy as TEvent);
        this.entry.key = handler.property;
        return this;
    }

    /** @inheritdoc */
    usingKeyFromContext(contextPropertyName: string): this {
        this.entry.key = `$context.${contextPropertyName}`;
        return this;
    }
}
