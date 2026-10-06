// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Guid } from '@cratis/fundamentals';
import { AppendError } from '../eventSequences/AppendError.js';
import { AppendResult } from '../eventSequences/AppendResult.js';
import { ConcurrencyViolation } from '../eventSequences/ConcurrencyViolation.js';
import { ConstraintViolation } from '../eventSequences/ConstraintViolation.js';
import { EventForEventSourceId } from '../eventSequences/EventForEventSourceId.js';
import { EventSequenceId } from '../eventSequences/EventSequenceId.js';
import { planDerivedGuards, resolveBatchRouting } from '../eventSequences/resolveEventSourceRouting.js';
import { ensureNamedTagBatchIsSupported } from '../eventSequences/ensureNamedTagBatchIsSupported.js';
import { IEventStore } from '../IEventStore.js';
import type { TransactionalAppendOptions } from './TransactionalAppendOptions.js';
import { mergeNamedTags } from '../events/mergeNamedTags.js';
import { IUnitOfWork } from './IUnitOfWork.js';

interface EventForEventSourceIdWithSequenceNumber {
    readonly sequenceNumber: number;
    readonly eventSequenceId: EventSequenceId;
    readonly eventForEventSourceId: EventForEventSourceId;
}

/**
 * Represents a unit of work that buffers events and commits them as transaction-like append operations.
 */
export class UnitOfWork implements IUnitOfWork {
    private _events: EventForEventSourceIdWithSequenceNumber[] = [];
    private _appendResults: AppendResult[] = [];
    private _isCommitted = false;
    private _isRolledBack = false;
    private _onCompleted: (unitOfWork: IUnitOfWork) => void;

    constructor(
        readonly correlationId: Guid,
        onCompleted: (unitOfWork: IUnitOfWork) => void,
        private readonly _eventStore: IEventStore
    ) {
        this._onCompleted = onCompleted;
    }

    /** @inheritdoc */
    get isCompleted(): boolean {
        return this._isCommitted || this._isRolledBack;
    }

    /** @inheritdoc */
    get isSuccess(): boolean {
        return this._appendResults.every(_ => _.isSuccess);
    }

    /** @inheritdoc */
    addEvent(eventSequenceId: EventSequenceId, eventSourceId: string, event: object, options?: TransactionalAppendOptions): void {
        this.throwIfCompleted();
        const namedTags = mergeNamedTags(options?.namedTags);
        this._events.push({
            sequenceNumber: this._events.length,
            eventSequenceId,
            eventForEventSourceId: {
                eventSourceId,
                event,
                ...(options?.eventSource !== undefined ? { eventSource: options.eventSource } : {}),
                ...(options?.eventStream !== undefined ? { eventStream: options.eventStream } : {}),
                ...(namedTags.length > 0 ? { namedTags } : {})
            }
        });
    }

    /** @inheritdoc */
    getEvents(): ReadonlyArray<object> {
        return this._events.map(_ => _.eventForEventSourceId.event);
    }

    /** @inheritdoc */
    getAppendResults(): ReadonlyArray<AppendResult> {
        return this._appendResults;
    }

    /** @inheritdoc */
    getConstraintViolations(): ReadonlyArray<ConstraintViolation> {
        return this._appendResults.flatMap(appendResult => appendResult.constraintViolations);
    }

    /** @inheritdoc */
    getConcurrencyViolations(): ReadonlyArray<ConcurrencyViolation> {
        return this._appendResults
            .map(appendResult => appendResult.concurrencyViolation)
            .filter((violation): violation is ConcurrencyViolation => violation !== undefined);
    }

    /** @inheritdoc */
    getAppendErrors(): ReadonlyArray<AppendError> {
        return this._appendResults.flatMap(appendResult => appendResult.errors);
    }

    /** @inheritdoc */
    async commit(): Promise<void> {
        this.throwIfCompleted();

        if (this._events.length > 0) {
            // Validate the entire commit before writing any sequence, including combinations in different groups.
            ensureNamedTagBatchIsSupported(
                this._events.some(entry => (entry.eventForEventSourceId.namedTags?.length ?? 0) > 0),
                this._events.some(entry => entry.eventForEventSourceId.eventSource !== undefined)
            );
            const resultsBySequenceNumber = new Map<number, AppendResult>();
            const eventsByEventSequence = new Map<string, EventForEventSourceIdWithSequenceNumber[]>();

            for (const eventToAppend of this._events) {
                const key = eventToAppend.eventSequenceId.value;
                const events = eventsByEventSequence.get(key) ?? [];
                events.push(eventToAppend);
                eventsByEventSequence.set(key, events);
            }

            // Resolve routing and required guards for every group first: a rejection must not follow a written group.
            const eventSources = this._eventStore.eventSources;
            for (const eventsForSequence of eventSources ? eventsByEventSequence.values() : []) {
                const events = eventsForSequence.map(_ => _.eventForEventSourceId);
                planDerivedGuards(events.map(_ => resolveBatchRouting(eventSources, _)), events, undefined);
            }

            for (const [eventSequenceId, eventsForSequence] of eventsByEventSequence) {
                const sequence = this._eventStore.getEventSequence(new EventSequenceId(eventSequenceId));
                const appendResults = await sequence.appendMany(
                    eventsForSequence.map(_ => _.eventForEventSourceId),
                    { correlationId: this.correlationId }
                );

                appendResults.forEach((appendResult, index) => {
                    resultsBySequenceNumber.set(eventsForSequence[index].sequenceNumber, appendResult);
                });
            }

            this._appendResults = [...resultsBySequenceNumber.entries()]
                .sort(([left], [right]) => left - right)
                .map(([, appendResult]) => appendResult);
        } else {
            this._appendResults = [];
        }

        this._isCommitted = true;
        this._onCompleted(this);
    }

    /** @inheritdoc */
    async rollback(): Promise<void> {
        this.throwIfCompleted();
        this._isRolledBack = true;
        this._events = [];
        this._appendResults = [];
        this._onCompleted(this);
    }

    /** @inheritdoc */
    onCompleted(callback: (unitOfWork: IUnitOfWork) => void): void {
        const previous = this._onCompleted;
        this._onCompleted = unitOfWork => {
            previous(unitOfWork);
            callback(unitOfWork);
        };
    }

    private throwIfCompleted(): void {
        if (this._isCommitted) {
            throw new Error(`Unit of work ${this.correlationId} is already committed.`);
        }
        if (this._isRolledBack) {
            throw new Error(`Unit of work ${this.correlationId} is already rolled back.`);
        }
    }
}
