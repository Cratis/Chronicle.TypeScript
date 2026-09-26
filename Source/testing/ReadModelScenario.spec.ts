// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { describe, expect, it } from 'vitest';
import { ConceptAs, field } from '@cratis/fundamentals';
import type { Constructor } from '@cratis/fundamentals';
import { eventType } from '../events/eventTypeDecorator.js';
import type { EventContext } from '../events/EventContext.js';
import { fromEvent } from '../projections/modelBound/fromEvent.js';
import { setFrom } from '../projections/modelBound/setFrom.js';
import { removedWith } from '../projections/modelBound/removedWith.js';
import type { IProjectionBuilderFor } from '../projections/declarative/IProjectionBuilderFor.js';
import type { IProjectionFor } from '../projections/declarative/IProjectionFor.js';
import { projection } from '../projections/declarative/projection.js';
import { reducer } from '../reducers/reducer.js';
import { ReadModelScenario, ReadModelScenarioGivenBuilder } from './index.js';
import { readModelScenarioExample } from './ReadModelScenario.example.js';

class ItemAdded {
    @field(Number) amount: number;
    constructor(amount: number) { this.amount = amount; }
}
eventType('scenario-item-added')(ItemAdded);
class ItemRemoved {}
eventType('scenario-item-removed')(ItemRemoved);
class UnrelatedEvent {}
eventType('scenario-unrelated')(UnrelatedEvent);
class BookTitle extends ConceptAs<string> {
    static readonly valueType = String;
}
class BookNamed {
    @field(BookTitle) title: BookTitle;
    constructor(title: BookTitle) { this.title = title; }
}
eventType('scenario-book-named')(BookNamed);
class BookState { title = ''; }
class BookReducer {
    bookNamed(event: { title: string }): BookState { return { title: event.title }; }
}
reducer('scenario-book-reducer', undefined, BookState)(BookReducer);

const nullableStates: unknown[] = [];
class NullableState { count = 0; }
class NullableReducer {
    itemAdded(_event: ItemAdded, current: NullableState | null | undefined): null {
        nullableStates.push(current);
        return null;
    }
}
reducer('scenario-nullable-reducer', undefined, NullableState)(NullableReducer);

const reducerFailure = new Error('broken handler');
class FailingState {}
class FailingReducer {
    itemAdded(): never { throw reducerFailure; }
}
reducer('scenario-failing-reducer', undefined, FailingState)(FailingReducer);

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

    it('exposes a named given builder for selecting an event source', () => {
        const scenario = new ReadModelScenario(ItemState, artifacts);
        expect(scenario.given).toBeInstanceOf(ReadModelScenarioGivenBuilder);
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
        expect(contexts.map(context => context.eventSourceType)).toEqual(['Default', 'Default']);
        expect(contexts.map(context => context.eventStreamType)).toEqual(['All', 'All']);
        expect(contexts.map(context => context.eventStreamId)).toEqual(['Default', 'Default']);
        expect(contexts.map(context => context.eventStore)).toEqual(['[NotSet]', '[NotSet]']);
        expect(contexts.map(context => context.namespace)).toEqual(['[NotSet]', '[NotSet]']);
        expect(contexts.map(context => context.eventType.id.value)).toEqual(['scenario-item-added', 'scenario-item-added']);
        expect(contexts.map(context => context.eventType.generation.value)).toEqual([1, 1]);
        expect(contexts.every(context => context.occurred instanceof Date && !Number.isNaN(context.occurred.getTime()))).toBe(true);
        expect(contexts.map(context => context.correlationId)).toEqual([
            '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000'
        ]);
    });

    it('keeps interleaved event sources separate and rejects an ambiguous single instance', async () => {
        contexts.length = 0;
        const scenario = new ReadModelScenario(ItemState, artifacts);
        scenario.given.forEventSource('A').events(new ItemAdded(2));
        scenario.given.forEventSource('B').events(new ItemAdded(7));
        scenario.given.forEventSource('A').events(new ItemAdded(3));
        expect(await scenario.instanceForEventSourceId('A')).toEqual({ count: 5 });
        expect(await scenario.instanceForEventSourceId('B')).toEqual({ count: 7 });
        expect(contexts.map(context => context.sequenceNumber)).toEqual([0n, 1n, 2n]);
        expect(contexts.map(context => context.eventSourceId)).toEqual(['A', 'B', 'A']);
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
        incomingStates.length = 0;
        const scenario = new ReadModelScenario(ItemState, artifacts);
        scenario.given.forEventSource('A').events(new ItemAdded(2), new ItemRemoved());
        expect(await scenario.instanceForEventSourceId('A')).toBeNull();
        expect(await scenario.wasDeletedForEventSourceId('A')).toBe(true);
        scenario.given.forEventSource('A').events(new ItemAdded(4));
        expect(await scenario.instance).toEqual({ count: 4 });
        expect(incomingStates.at(-1)).toBeUndefined();
        expect(await scenario.wasDeletedForEventSourceId('A')).toBe(false);
    });

    it('serializes concept properties as primitives, like production append', async () => {
        const scenario = new ReadModelScenario(BookState, {
            reducers: [BookReducer], eventTypes: [BookNamed], projections: []
        });
        scenario.given.forEventSource('book-42').events(new BookNamed(new BookTitle('Dune')));
        expect(await scenario.instance).toEqual({ title: 'Dune' });
    });

    it('preserves a null reducer result as null state rather than a deletion', async () => {
        nullableStates.length = 0;
        const scenario = new ReadModelScenario(NullableState, {
            reducers: [NullableReducer], eventTypes: [ItemAdded], projections: []
        });
        scenario.given.forEventSource('A').events(new ItemAdded(1), new ItemAdded(2));
        expect(await scenario.instanceForEventSourceId('A')).toBeNull();
        expect(await scenario.wasDeletedForEventSourceId('A')).toBe(false);
        expect(nullableStates).toEqual([undefined, null]);
    });

    it('wraps reducer failures with the read model and reducer names and preserves the cause', async () => {
        const scenario = new ReadModelScenario(FailingState, {
            reducers: [FailingReducer], eventTypes: [ItemAdded], projections: []
        });
        scenario.given.forEventSource('A').events(new ItemAdded(1));
        await expect(scenario.instance).rejects.toMatchObject({
            message: expect.stringContaining('FailingState'),
            cause: reducerFailure
        });
        await expect(scenario.instance).rejects.toThrow('FailingReducer');
    });

    it('replays a compiled model-bound projection and recreates it after removal', async () => {
        class ProjectedState {
            @field(Number) count = 0;
        }
        fromEvent(ItemAdded)(ProjectedState);
        setFrom(ItemAdded, 'amount')(ProjectedState.prototype, 'count');
        removedWith(ItemRemoved)(ProjectedState);
        const scenario = new ReadModelScenario(ProjectedState, artifacts);
        scenario.given.forEventSource('A').events(new ItemAdded(3), new ItemRemoved());
        expect(await scenario.instanceForEventSourceId('A')).toBeNull();
        expect(await scenario.wasDeletedForEventSourceId('A')).toBe(true);
        scenario.given.forEventSource('A').events(new UnrelatedEvent(), new ItemAdded(7));
        expect(await scenario.instance).toMatchObject({ count: 7 });
        expect(await scenario.wasDeletedForEventSourceId('A')).toBe(false);
    });

    it('selects a declarative projection using its final compiled contract', async () => {
        class FluentState { @field(Number) count = 0; }
        class FluentProjection implements IProjectionFor<FluentState> {
            define(builder: IProjectionBuilderFor<FluentState>): void {
                builder.from(ItemAdded, from => from.set(model => model.count).to(event => event.amount));
            }
        }
        projection('scenario-fluent-projection', FluentState)(FluentProjection);
        const scenario = new ReadModelScenario(FluentState, { ...artifacts, projections: [FluentProjection] });
        scenario.given.forEventSource('A').events(new ItemAdded(8));
        expect(await scenario.instance).toMatchObject({ count: 8 });
    });

    it('rejects unsupported mappings before replay even when no events are seeded', () => {
        class CustomKeyState { @field(Number) count = 0; }
        fromEvent(ItemAdded, { key: 'amount' })(CustomKeyState);
        expect(() => new ReadModelScenario(CustomKeyState, artifacts)).toThrow('only $eventSourceId keys are supported');
    });

    it('rejects noncanonical numeric source IDs instead of merging independent histories', async () => {
        class NumericState { @field(Number) id = 0; }
        fromEvent(ItemAdded)(NumericState);
        const scenario = new ReadModelScenario(NumericState, artifacts);
        scenario.given.forEventSource('01').events(new ItemAdded(1));
        await expect(scenario.instance).rejects.toThrow('not a canonical number identifier');
    });

    it('keeps reducer precedence when a projection also applies', async () => {
        class DualState { @field(Number) count = 0; }
        class DualReducer { itemAdded(event: ItemAdded): DualState { return { count: event.amount }; } }
        reducer('scenario-dual-reducer', undefined, DualState)(DualReducer);
        fromEvent(ItemAdded)(DualState);
        const scenario = new ReadModelScenario(DualState, { ...artifacts, reducers: [DualReducer] });
        scenario.given.forEventSource('A').events(new ItemAdded(4));
        expect(await scenario.instance).toEqual({ count: 4 });
    });

    it('rejects multiple applicable projections before replay', () => {
        class FluentState { @field(Number) count = 0; }
        class FirstProjection implements IProjectionFor<FluentState> { define(): void {} }
        class SecondProjection implements IProjectionFor<FluentState> { define(): void {} }
        projection('first-projection', FluentState)(FirstProjection);
        projection('second-projection', FluentState)(SecondProjection);
        expect(() => new ReadModelScenario(FluentState, { ...artifacts, projections: [FirstProjection, SecondProjection] }))
            .toThrow('Multiple projections found');
    });
});
