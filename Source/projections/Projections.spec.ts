// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { IClientArtifactsProvider } from '../artifacts';
import { ChronicleConnection } from '../connection';
import { eventType } from '../events/eventTypeDecorator';
import { readModel } from '../readModels/readModel';
import { addFrom } from './modelBound/addFrom';
import { count } from './modelBound/count';
import { decrement } from './modelBound/decrement';
import { fromEvent } from './modelBound/fromEvent';
import { increment } from './modelBound/increment';
import { subtractFrom } from './modelBound/subtractFrom';
import { Projections } from './Projections';

// Decorators are applied as plain function calls (rather than `@decorator` syntax) so these
// fixtures don't depend on the test runner's decorator-syntax support - they exercise exactly
// the same decorator functions and metadata storage that `@decorator` syntax would invoke.

class ItemAdded {
    quantity!: number;
}
eventType()(ItemAdded);

class ItemRemoved {
    amount!: number;
}
eventType()(ItemRemoved);

class CounterIncremented {}
eventType()(CounterIncremented);

class CounterDecremented {}
eventType()(CounterDecremented);

class ThingHappened {}
eventType()(ThingHappened);

class KeyedThingHappened {}
eventType()(KeyedThingHappened);

class Inventory {
    id!: string;
    total!: number;
    totalFromNamedProperty!: number;
    removedTotal!: number;
    incrementedCount!: number;
    decrementedCount!: number;
    thingsHappenedCount!: number;
    constantKeyedCount!: number;
}
addFrom(ItemAdded)(Inventory.prototype, 'total');
addFrom(ItemAdded, 'quantity')(Inventory.prototype, 'totalFromNamedProperty');
subtractFrom(ItemRemoved, 'amount')(Inventory.prototype, 'removedTotal');
increment(CounterIncremented)(Inventory.prototype, 'incrementedCount');
decrement(CounterDecremented)(Inventory.prototype, 'decrementedCount');
count(ThingHappened)(Inventory.prototype, 'thingsHappenedCount');
count(KeyedThingHappened, 'all-things')(Inventory.prototype, 'constantKeyedCount');
fromEvent(ItemAdded)(Inventory);
readModel()(Inventory);

/**
 * Builds a {@link Projections} instance wired to capture the registration payload sent
 * to the kernel, without requiring a real gRPC connection.
 */
function createProjections(readModels: (new (...args: unknown[]) => unknown)[]) {
    const registerMock = vi.fn().mockResolvedValue(undefined);
    const registerManyMock = vi.fn().mockResolvedValue(undefined);
    const connection = {
        readModels: { registerMany: registerManyMock },
        projections: { register: registerMock }
    } as unknown as ChronicleConnection;

    const clientArtifacts: IClientArtifactsProvider = {
        eventTypes: [],
        readModels: readModels as unknown as IClientArtifactsProvider['readModels'],
        reactors: [],
        reducers: [],
        seeders: [],
        constraints: [],
        projections: [],
        webhooks: [],
        eventTypeMigrations: []
    };

    const projections = new Projections('test-store', 'test-namespace', connection, clientArtifacts, 'test-sink');
    return { projections, registerMock };
}

function findFromEntry(definition: { From: Array<{ Key: { Id: string }; Value: { Properties: Record<string, string>; Key: string } }> }, eventTypeId: string) {
    const entry = definition.From.find(candidate => candidate.Key.Id === eventTypeId);
    if (!entry) {
        throw new Error(`No From entry found for event type '${eventTypeId}'.`);
    }
    return entry;
}

describe('Projections', () => {
    describe('when registering a model-bound projection with arithmetic decorators', () => {
        it('should not throw and should produce the correct wire expressions', async () => {
            const { projections, registerMock } = createProjections([Inventory]);

            await expect(projections.register()).resolves.not.toThrow();

            const request = registerMock.mock.calls[0][0] as { Projections: unknown[] };
            const definition = request.Projections[0] as { From: Array<{ Key: { Id: string }; Value: { Properties: Record<string, string>; Key: string } }> };

            const itemAdded = findFromEntry(definition, 'ItemAdded');
            expect(itemAdded.Value.Properties.total).toBe('$add(total)');
            expect(itemAdded.Value.Properties.totalFromNamedProperty).toBe('$add(quantity)');

            const itemRemoved = findFromEntry(definition, 'ItemRemoved');
            expect(itemRemoved.Value.Properties.removedTotal).toBe('$subtract(amount)');

            const counterIncremented = findFromEntry(definition, 'CounterIncremented');
            expect(counterIncremented.Value.Properties.incrementedCount).toBe('$increment');

            const counterDecremented = findFromEntry(definition, 'CounterDecremented');
            expect(counterDecremented.Value.Properties.decrementedCount).toBe('$decrement');

            const thingHappened = findFromEntry(definition, 'ThingHappened');
            expect(thingHappened.Value.Properties.thingsHappenedCount).toBe('$count');

            const keyedThingHappened = findFromEntry(definition, 'KeyedThingHappened');
            expect(keyedThingHappened.Value.Properties.constantKeyedCount).toBe('$count');
            expect(keyedThingHappened.Value.Key).toBe('$value(all-things)');
        });
    });
});
