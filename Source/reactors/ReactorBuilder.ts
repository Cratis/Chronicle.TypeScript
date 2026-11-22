// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import { EventSequenceId } from '../eventSequences/EventSequenceId.js';
import type { EventContext } from '../events/EventContext.js';
import { EventType } from '../events/EventType.js';
import { EventTypeId } from '../events/EventTypeId.js';
import { EventTypeGeneration } from '../events/EventTypeGeneration.js';
import { getEventTypeMetadata } from '../events/eventTypeDecorator.js';
import type { IReactorBuilder } from './IReactorBuilder.js';
import type { IReactorDefinitionBuilder } from './IReactorDefinitionBuilder.js';
import type { IReactorDefinition } from './IReactorDefinition.js';
import { ReactorId } from './ReactorId.js';

import type { ReactorCallback } from './ReactorCallback.js';

/** Builds a snapshot of subscriptions and callbacks; never registers an artifact globally. */
export class ReactorBuilder implements IReactorBuilder, IReactorDefinitionBuilder {
    private readonly _knownTypes: readonly Constructor[];
    private readonly _subscriptions = new Map<string, EventType>();
    private readonly _handlers = new Map<string, ReactorCallback[]>();
    private readonly _catchAll: ReactorCallback[] = [];
    private _eventSequenceId = EventSequenceId.eventLog.value;
    private _isReplayable = true;

    constructor(private readonly _id: ReactorId | string, knownTypes: readonly Constructor[]) {
        if (!(typeof _id === 'string' ? _id : _id.value).trim()) throw new Error('Reactor id must not be empty.');
        this._knownTypes = [...knownTypes];
    }

    /** @inheritdoc */
    withEventType<T>(eventType: Constructor<T>): this {
        const metadata = getEventTypeMetadata(eventType);
        if (!this._knownTypes.includes(eventType) || !metadata) {
            throw new Error(`Reactor event type '${eventType.name}' has no registered event type.`);
        }
        const type = metadata.eventType;
        const previous = this._subscriptions.get(type.id.value);
        if (!previous || previous.generation.value < type.generation.value) this._subscriptions.set(type.id.value, type);
        return this;
    }

    /** @inheritdoc */
    on<T>(eventType: Constructor<T>, handler: (event: T, context: EventContext) => void | Promise<void>): this {
        this.withEventType(eventType);
        const id = getEventTypeMetadata(eventType)!.eventType.id.value;
        const callbacks = this._handlers.get(id) ?? [];
        callbacks.push((content, context) => handler(Object.assign(Object.create(eventType.prototype) as object, content) as T, context));
        this._handlers.set(id, callbacks);
        return this;
    }

    /** @inheritdoc */
    subscribe(handler: ReactorCallback): this {
        for (const type of this._knownTypes) this.withEventType(type);
        this._catchAll.push(handler);
        return this;
    }

    /** @inheritdoc */
    onEventSequence(eventSequenceId: EventSequenceId | string): this {
        this._eventSequenceId = typeof eventSequenceId === 'string' ? eventSequenceId : eventSequenceId.value;
        return this;
    }

    /** @inheritdoc */
    notReplayable(): this {
        this._isReplayable = false;
        return this;
    }

    /** Creates an immutable definition, independent of subsequent builder changes. */
    build(delegate?: IReactorDefinition['handle']): IReactorDefinition {
        if (this._subscriptions.size === 0) throw new Error('Reactor must subscribe to at least one event type.');
        const handlers = new Map([...this._handlers].map(([id, callbacks]) => [id, [...callbacks]]));
        const catchAll = [...this._catchAll];
        const eventTypes = Object.freeze([...this._subscriptions.values()].map(type => Object.freeze(new EventType(
            Object.freeze(new EventTypeId(type.id.value)), Object.freeze(new EventTypeGeneration(type.generation.value)), type.tombstone))));
        const ids = new Set(eventTypes.map(type => type.id.value));
        const handle: IReactorDefinition['handle'] = async (event, signal) => {
            if (!ids.has(event.context.eventType.id.value)) return;
            if (delegate) {
                if (!signal.aborted) await delegate(event, signal);
                return;
            }
            for (const callback of [...(handlers.get(event.context.eventType.id.value) ?? []), ...catchAll]) {
                if (signal.aborted) return;
                await callback(event.content, event.context);
            }
        };
        return Object.freeze({
            id: Object.freeze(new ReactorId(typeof this._id === 'string' ? this._id : this._id.value)),
            eventSequenceId: Object.freeze(new EventSequenceId(this._eventSequenceId)),
            eventTypes, isReplayable: this._isReplayable, handle
        });
    }
}
