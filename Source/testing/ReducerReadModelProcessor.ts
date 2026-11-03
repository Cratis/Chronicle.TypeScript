// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import { ReducerEventDispatcher } from '../reducers/ReducerEventDispatcher.js';
import { BatchContext } from '../observation/batches/BatchContext.js';
import { EventAndContext } from '../observation/batches/EventAndContext.js';
import { EventBatch } from '../observation/batches/EventBatch.js';
import { ObservationOrigin } from '../observation/batches/ObservationOrigin.js';
import { PartitionFailedInBatch } from '../observation/batches/PartitionFailedInBatch.js';
import { getEventSourceTypeFor } from '../events/eventSourceTypeDecorator.js';
import { getEventStreamTypeFor } from '../events/eventStreamTypeDecorator.js';
import { getFilterTagsFor } from '../events/filterEventsByTagDecorator.js';
import { UnsupportedReducerOperation } from './UnsupportedReducerOperation.js';
import type { IReadModelProcessor } from './IReadModelProcessor.js';
import type { ReadModelState } from './ReadModelState.js';
import type { ScenarioEvent } from './ScenarioEvent.js';

/** Preserves the SDK reducer dispatch and the scenario's null-versus-deletion semantics. */
export class ReducerReadModelProcessor<TReadModel extends object> implements IReadModelProcessor<TReadModel> {
    private readonly _dispatcher: ReducerEventDispatcher;

    constructor(private readonly _readModelType: Constructor<TReadModel>, private readonly _reducerType: Constructor, eventTypes: Constructor[]) {
        if (getFilterTagsFor(_reducerType).length) {
            throw new UnsupportedReducerOperation('reducer.filterEventsByTag', _reducerType.name, 'Tag-filtered delivery is not fixture-backed.');
        }
        if (getEventSourceTypeFor(_reducerType) !== '') {
            throw new UnsupportedReducerOperation('reducer.eventSourceType', _reducerType.name, 'Source-type-filtered delivery is not fixture-backed.');
        }
        if (getEventStreamTypeFor(_reducerType) !== 'All') {
            throw new UnsupportedReducerOperation('reducer.eventStreamType', _reducerType.name, 'Stream-type-filtered delivery is not fixture-backed.');
        }
        this._dispatcher = new ReducerEventDispatcher(_reducerType, eventTypes);
    }

    async process(events: readonly ScenarioEvent[]): Promise<Map<string, ReadModelState<TReadModel>>> {
        const results = new Map<string, ReadModelState<TReadModel>>();
        const reducer = new (this._reducerType as new () => Record<string, Function>)();
        this._dispatcher.validateInstance(reducer);
        if (this._dispatcher.batchMethod) {
            await this.processBatches(reducer, events, results);
            return results;
        }
        for (const event of events) {
            const handler = this._dispatcher.handlerFor(event.context.eventType.id.value);
            if (!handler) continue;
            const prior = results.get(event.sourceId);
            const previous = prior?.deleted ? undefined : prior?.instance;
            let next: unknown;
            try {
                next = await this._dispatcher.invoke(reducer, handler, event.content, previous, event.context);
            } catch (cause) {
                throw new Error(`Reducer '${this._reducerType.name}' for read model '${this._readModelType.name}' failed`, { cause });
            }
            results.set(event.sourceId, {
                instance: next === undefined ? null : next as TReadModel | null,
                deleted: next === undefined
            });
        }
        return results;
    }

    private async processBatches(reducer: Record<string, Function>, events: readonly ScenarioEvent[],
        results: Map<string, ReadModelState<TReadModel>>): Promise<void> {
        const method = this._dispatcher.batchMethod!;
        const bySource = new Map<string, EventAndContext[]>();
        for (const event of events) {
            const observed = method.eventTypes.get(event.context.eventType.id.value);
            if (!observed) continue;
            const sourceEvents = bySource.get(event.sourceId) ?? [];
            sourceEvents.push(new EventAndContext(event.content, event.context, observed.type));
            bySource.set(event.sourceId, sourceEvents);
        }
        const signal = new AbortController().signal;
        for (const [sourceId, sourceEvents] of bySource) {
            const batch = new EventBatch(sourceEvents, false);
            const sequenceNumbers = sourceEvents.map(event => event.context.sequenceNumber);
            const context = new BatchContext({
                observerId: this._reducerType.name, eventStore: sourceEvents[0].context.eventStore ?? '', namespace: sourceEvents[0].context.namespace ?? '',
                eventSequenceId: 'event-log', origin: ObservationOrigin.Unknown, partitions: [sourceId], eventCount: sourceEvents.length,
                firstSequenceNumber: sequenceNumbers[0], lastSequenceNumber: sequenceNumbers.at(-1), deadline: undefined, signal, canDefer: false
            });
            let next: unknown;
            try {
                next = await this._dispatcher.invokeBatch(reducer, batch, undefined, context);
                const [reported] = batch.outcomes;
                if (reported) throw reported.error ?? new PartitionFailedInBatch(sourceId);
            } catch (cause) {
                throw new Error(`Reducer '${this._reducerType.name}' for read model '${this._readModelType.name}' failed`, { cause });
            }
            results.set(sourceId, {
                instance: next === undefined ? null : next as TReadModel | null,
                deleted: next === undefined
            });
        }
    }
}
