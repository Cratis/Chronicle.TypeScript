// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import { ReducerEventDispatcher } from '../reducers/ReducerEventDispatcher.js';
import type { IReadModelProcessor } from './IReadModelProcessor.js';
import type { ReadModelState } from './ReadModelState.js';
import type { ScenarioEvent } from './ScenarioEvent.js';

/** Preserves the SDK reducer dispatch and the scenario's null-versus-deletion semantics. */
export class ReducerReadModelProcessor<TReadModel extends object> implements IReadModelProcessor<TReadModel> {
    private readonly _dispatcher: ReducerEventDispatcher;

    constructor(private readonly _readModelType: Constructor<TReadModel>, private readonly _reducerType: Constructor, eventTypes: Constructor[]) {
        this._dispatcher = new ReducerEventDispatcher(_reducerType, eventTypes);
    }

    async process(events: readonly ScenarioEvent[]): Promise<Map<string, ReadModelState<TReadModel>>> {
        const results = new Map<string, ReadModelState<TReadModel>>();
        const reducer = new (this._reducerType as new () => Record<string, Function>)();
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
}
