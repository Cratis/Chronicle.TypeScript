// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { PropertyAccessor, PropertyPathResolverProxyHandler } from '@cratis/fundamentals';
import { IRemovedWithJoinBuilder } from './IRemovedWithJoinBuilder';

/**
 * Accumulated removal configuration for a removedWithJoin clause.
 */
export interface RemovedWithJoinEntry {
    on: string;
    key: string;
}

/**
 * Concrete implementation of {@link IRemovedWithJoinBuilder}.
 * @template TReadModel - The read model type.
 * @template TEvent - The event type.
 */
export class RemovedWithJoinBuilder<TReadModel, TEvent> implements IRemovedWithJoinBuilder<TReadModel, TEvent> {
    readonly entry: RemovedWithJoinEntry = {
        on: '',
        key: '$eventSourceId'
    };

    /** @inheritdoc */
    on(readModelPropertyAccessor: PropertyAccessor<TReadModel>): this {
        const handler = new PropertyPathResolverProxyHandler();
        const proxy = new Proxy({}, handler);
        readModelPropertyAccessor(proxy as TReadModel);
        this.entry.on = handler.property;
        return this;
    }

    /** @inheritdoc */
    usingKey(keyAccessor: PropertyAccessor<TEvent>): this {
        const handler = new PropertyPathResolverProxyHandler();
        const proxy = new Proxy({}, handler);
        keyAccessor(proxy as TEvent);
        this.entry.key = handler.property;
        return this;
    }
}
