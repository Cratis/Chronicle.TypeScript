// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { PropertyAccessor, PropertyPathResolverProxyHandler } from '@cratis/fundamentals';
import { getEventTypeFor } from '../eventTypeDecorator';
import { IUniqueConstraintBuilder } from './IUniqueConstraintBuilder';

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
    removedWithEventTypeId?: string;
    message?: string;
}

/**
 * Implements {@link IUniqueConstraintBuilder}, capturing the unique constraint definition
 * for later serialization and registration with the Kernel.
 */
export class UniqueConstraintBuilder implements IUniqueConstraintBuilder {
    private readonly _capture: UniqueConstraintCapture;
    private _currentEventTypeId?: string;

    constructor(capture: UniqueConstraintCapture) {
        this._capture = capture;
    }

    /** @inheritdoc */
    withName(name: string): IUniqueConstraintBuilder {
        this._capture.name = name;
        return this;
    }

    /** @inheritdoc */
    on<TEvent>(...properties: PropertyAccessor<TEvent>[]): IUniqueConstraintBuilder {
        if (!this._currentEventTypeId) {
            return this;
        }
        const paths = properties.map(p => resolvePropertyPath(p));
        const existing = this._capture.eventDefinitions.find(d => d.eventTypeId === this._currentEventTypeId);
        if (existing) {
            existing.properties.push(...paths);
        } else {
            this._capture.eventDefinitions.push({ eventTypeId: this._currentEventTypeId, properties: paths });
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
        const et = getEventTypeFor(eventType);
        this._capture.removedWithEventTypeId = et.id.value;
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

    /**
     * Sets the current event type context for subsequent {@link on} calls.
     * @param eventTypeId - The event type identifier string.
     */
    withEventType(eventTypeId: string): UniqueConstraintBuilder {
        this._currentEventTypeId = eventTypeId;
        return this;
    }
}
