// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Constructor, PropertyAccessor, PropertyPathResolverProxyHandler } from '@cratis/fundamentals';
import { getEventTypeFor } from '../eventTypeDecorator.js';
import { IUniqueConstraintBuilder } from './IUniqueConstraintBuilder.js';

/** Resolves a property path string from a {@link PropertyAccessor}. */
function resolvePropertyPath<T>(accessor: PropertyAccessor<T>): string {
    const handler = new PropertyPathResolverProxyHandler();
    const proxy = new Proxy({}, handler);
    accessor(proxy as T);
    return handler.path;
}

/** Captured definition of a unique constraint event entry. */
export interface UniqueConstraintEventEntry {
    eventTypeId: string;
    properties: string[];
}

/** Captured definition of a unique constraint. */
export interface UniqueConstraintCapture {
    name?: string;
    eventDefinitions: UniqueConstraintEventEntry[];
    ignoreCasing: boolean;
    /** The most recently specified removal event type (retained for legacy capture consumers). */
    removedWithEventTypeId?: string;
    /** Distinct removal event types in registration order. */
    removedWithEventTypeIds?: string[];
    message?: string;
}

/**
 * Implements {@link IUniqueConstraintBuilder}, capturing the unique constraint definition
 * for later serialization and registration with the Kernel.
 */
export class UniqueConstraintBuilder implements IUniqueConstraintBuilder {
    private readonly _capture: UniqueConstraintCapture;

    constructor(capture: UniqueConstraintCapture) {
        this._capture = capture;
    }

    /** @inheritdoc */
    withName(name: string): IUniqueConstraintBuilder {
        this._capture.name = name;
        return this;
    }

    /** @inheritdoc */
    on<TEvent>(eventType: Constructor<TEvent>, ...properties: PropertyAccessor<TEvent>[]): IUniqueConstraintBuilder {
        const eventTypeId = getEventTypeFor(eventType).id.value;
        const paths = properties.map(p => resolvePropertyPath(p));
        const existing = this._capture.eventDefinitions.find(d => d.eventTypeId === eventTypeId);
        if (existing) {
            existing.properties.push(...paths);
        } else {
            this._capture.eventDefinitions.push({ eventTypeId, properties: paths });
        }
        return this;
    }

    /** @inheritdoc */
    ignoreCasing(): IUniqueConstraintBuilder {
        this._capture.ignoreCasing = true;
        return this;
    }

    /** @inheritdoc */
    removedWith(eventType: Function): IUniqueConstraintBuilder {
        const eventTypeId = getEventTypeFor(eventType).id.value;
        const removalEventTypeIds = this._capture.removedWithEventTypeIds ??=
            this._capture.removedWithEventTypeId ? [this._capture.removedWithEventTypeId] : [];
        if (!removalEventTypeIds.includes(eventTypeId)) {
            removalEventTypeIds.push(eventTypeId);
        }
        this._capture.removedWithEventTypeId = eventTypeId;
        return this;
    }

    /** @inheritdoc */
    withMessage(message: string): IUniqueConstraintBuilder {
        this._capture.message = message;
        return this;
    }

    /** @inheritdoc */
    withMessageFrom(messageProvider: () => string): IUniqueConstraintBuilder {
        this._capture.message = messageProvider();
        return this;
    }
}
