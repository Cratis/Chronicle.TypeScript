// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { getEventTypeFor } from '../eventTypeDecorator';
import { IConstraintBuilder } from './IConstraintBuilder';
import { IUniqueConstraintBuilder } from './IUniqueConstraintBuilder';
import { UniqueConstraintBuilder, UniqueConstraintCapture } from './UniqueConstraintBuilder';

/** Represents the captured scope for a constraint. */
export interface ConstraintScopeCapture {
    perEventSourceType: boolean;
    perEventStreamType: boolean;
    perEventStreamId: boolean;
}

/** Represents the captured definition of a unique event type constraint. */
export interface UniqueEventTypeCapture {
    eventTypeId: string;
    message?: string;
    name?: string;
}

/** Represents the full captured definition of a constraint. */
export interface ConstraintCapture {
    name: string;
    scope: ConstraintScopeCapture;
    uniqueConstraint?: UniqueConstraintCapture;
    uniqueEventType?: UniqueEventTypeCapture;
}

/**
 * Implements {@link IConstraintBuilder}, capturing the constraint definition
 * for later serialization and registration with the Kernel.
 */
export class ConstraintBuilder implements IConstraintBuilder {
    readonly capture: ConstraintCapture;
    private _uniqueBuilder?: UniqueConstraintBuilder;

    constructor(name: string) {
        this.capture = {
            name,
            scope: { perEventSourceType: false, perEventStreamType: false, perEventStreamId: false }
        };
    }

    /** @inheritdoc */
    perEventSourceType(): IConstraintBuilder {
        this.capture.scope.perEventSourceType = true;
        return this;
    }

    /** @inheritdoc */
    perEventStreamType(): IConstraintBuilder {
        this.capture.scope.perEventStreamType = true;
        return this;
    }

    /** @inheritdoc */
    perEventStreamId(): IConstraintBuilder {
        this.capture.scope.perEventStreamId = true;
        return this;
    }

    /** @inheritdoc */
    unique(callback: (builder: IUniqueConstraintBuilder) => void): IConstraintBuilder {
        const uniqueCapture: UniqueConstraintCapture = {
            eventDefinitions: [],
            ignoreCasing: false
        };
        this.capture.uniqueConstraint = uniqueCapture;
        this._uniqueBuilder = new UniqueConstraintBuilder(uniqueCapture);
        callback(this._uniqueBuilder);
        return this;
    }

    /** @inheritdoc */
    uniqueFor(eventType: Function, message?: string, name?: string): IConstraintBuilder {
        const et = getEventTypeFor(eventType);
        this.capture.uniqueEventType = {
            eventTypeId: et.id.value,
            message,
            name
        };
        return this;
    }
}
