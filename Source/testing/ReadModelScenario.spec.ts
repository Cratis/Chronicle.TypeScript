// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { describe, expect, it } from 'vitest';
import type { Constructor } from '@cratis/fundamentals';
import { eventType } from '../events/eventTypeDecorator.js';
import type { EventContext } from '../events/EventContext.js';
import { fromEvent } from '../projections/modelBound/fromEvent.js';
import { projection } from '../projections/declarative/projection.js';
import { reducer } from '../reducers/reducer.js';
import { ReadModelScenario } from './index.js';
import { readModelScenarioExample } from './ReadModelScenario.example.js';

class ItemAdded {
    constructor(readonly amount: number) {}
}
eventType('scenario-item-added')(ItemAdded);
class ItemRemoved {}
eventType('scenario-item-removed')(ItemRemoved);
class UnrelatedEvent {}
eventType('scenario-unrelated')(UnrelatedEvent);

class ItemState {
    count = 0;
}
const contexts: EventContext[] = [];
const incomingStates: Array<ItemState | undefined> = [];
class ItemReducer {
    async itemAdded(event: ItemAdded, current: ItemState | undefined, context: EventContext): Promise<ItemState> {
        contexts.push(context);
        incomingStates.push(current);
        await Promise.resolve();
        return { count: (current?.count ?? 0) + event.amount };
    }
    itemRemoved(): undefined { return undefined; }
}
reducer('scenario-item-reducer', undefined, ItemState)(ItemReducer);

const artifacts = {
    reducers: [ItemReducer],
    eventTypes: [ItemAdded, ItemRemoved, UnrelatedEvent],
    projections: [] as Constructor[]
};

describe('ReadModelScenario', () => {
    it('runs the compiled documentation example', async () => {
        expect(await readModelScenarioExample()).toEqual({ title: 'Dune' });
    });

    it('returns null without matching events and distinguishes that from deletion', async () => {
        const scenario = new ReadModelScenario(ItemState, artifacts);
        scenario.given.forEventSource('A').events(new UnrelatedEvent());
        expect(await scenario.instance).toBeNull();
        expect(await scenario.instanceForEventSourceId('A')).toBeNull();
        expect(await scenario.wasDeletedForEventSourceId('A')).toBe(false);
    });

    it('passes each event, current state, and realistic ordered contexts to an async reducer', async () => {
        contexts.length = 0;
        incomingStates.length = 0;
        const scenario = new ReadModelScenario(ItemState, artifacts);
        scenario.given.forEventSource('A').events(new ItemAdded(2), new ItemAdded(3));
        expect(await scenario.instance).toEqual({ count: 5 });
        expect(incomingStates).toEqual([undefined, { count: 2 }]);
        expect(contexts.map(context => context.sequenceNumber)).toEqual([0n, 1n]);
        expect(contexts.map(context => context.eventSourceId)).toEqual(['A', 'A']);
        expect(contexts.map(context => context.eventType.id.value)).toEqual(['scenario-item-added', 'scenario-item-added']);
        expect(contexts.map(context => context.eventType.generation.value)).toEqual([1, 1]);
        expect(contexts.every(context => context.occurred instanceof Date && !Number.isNaN(context.occurred.getTime()))).toBe(true);
        expect(contexts.map(context => context.correlationId)).toEqual([
            '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000'
        ]);
    });

    it('keeps interleaved event sources separate and rejects an ambiguous single instance', async () => {
        const scenario = new ReadModelScenario(ItemState, artifacts);
        scenario.given.forEventSource('A').events(new ItemAdded(2));
        scenario.given.forEventSource('B').events(new ItemAdded(7));
        scenario.given.forEventSource('A').events(new ItemAdded(3));
        expect(await scenario.instanceForEventSourceId('A')).toEqual({ count: 5 });
        expect(await scenario.instanceForEventSourceId('B')).toEqual({ count: 7 });
        await expect(scenario.instance).rejects.toThrow('Multiple read model instances');
    });

    it('replays added events after an earlier result was read', async () => {
        const scenario = new ReadModelScenario(ItemState, artifacts);
        scenario.given.forEventSource('A').events(new ItemAdded(2));
        expect(await scenario.instance).toEqual({ count: 2 });
        scenario.given.forEventSource('A').events(new ItemAdded(3));
        expect(await scenario.instance).toEqual({ count: 5 });
    });

    it('treats an undefined reducer result as deletion, not missing history', async () => {
        const scenario = new ReadModelScenario(ItemState, artifacts);
        scenario.given.forEventSource('A').events(new ItemAdded(2), new ItemRemoved());
        expect(await scenario.instanceForEventSourceId('A')).toBeNull();
        expect(await scenario.wasDeletedForEventSourceId('A')).toBe(true);
        scenario.given.forEventSource('A').events(new ItemAdded(4));
        expect(await scenario.instance).toEqual({ count: 4 });
        expect(await scenario.wasDeletedForEventSourceId('A')).toBe(false);
    });

    it('rejects model-bound and declarative projections rather than silently returning null', () => {
        class ProjectedState {}
        fromEvent(ItemAdded)(ProjectedState);
        expect(() => new ReadModelScenario(ProjectedState, artifacts)).toThrow('not supported yet; use a kernel-backed test');

        class FluentState {}
        class FluentProjection {}
        projection('scenario-fluent-projection', FluentState)(FluentProjection);
        expect(() => new ReadModelScenario(FluentState, { ...artifacts, projections: [FluentProjection] }))
            .toThrow('not supported yet; use a kernel-backed test');
    });
});
