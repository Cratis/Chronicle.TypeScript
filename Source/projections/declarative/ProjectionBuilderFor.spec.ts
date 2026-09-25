// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { eventType } from '../../events/eventTypeDecorator.js';
import { ProjectionBuilderFor } from './ProjectionBuilderFor.js';

// Decorators are applied as plain function calls (rather than `@decorator` syntax) so these
// fixtures don't depend on the test runner's decorator-syntax support.

class ItemAdded {
    quantity!: number;
}
eventType()(ItemAdded);

class ItemRemoved {
    quantity!: number;
}
eventType()(ItemRemoved);

class ThingHappened {}
eventType()(ThingHappened);

class Inventory {
    id!: string;
    total!: number;
    removedTotal!: number;
    thingsHappenedCount!: number;
    countsByEventType!: Record<string, number>;
    active!: boolean;
    status!: string;
    started!: Date;
    cleared!: string | null;
    incrementsByEventType!: Record<string, number>;
    decrementsByEventType!: Record<string, number>;
}

interface FromRecord {
    Key: { Id: string };
    Value: { Properties: Record<string, string>; Key: string };
}

interface JoinRecord {
    Key: { Id: string };
    Value: { Properties: Record<string, string> };
}

interface AllDefinition {
    Properties: Record<string, string>;
    IncludeChildren: boolean;
}

describe('ProjectionBuilderFor', () => {
    describe('when using add on a from builder', () => {
        it('should produce a $add expression targeting the event property', () => {
            const builder = new ProjectionBuilderFor<Inventory>();
            builder.from(ItemAdded, from => from.add(model => model.total).with(event => event.quantity));

            const definition = builder.build('inventory', 'Inventory') as unknown as { From: FromRecord[] };
            const entry = definition.From.find(candidate => candidate.Key.Id === 'ItemAdded')!;

            expect(entry.Value.Properties.total).toBe('$add(quantity)');
        });
    });

    describe('when using subtract on a from builder', () => {
        it('should produce a $subtract expression targeting the event property', () => {
            const builder = new ProjectionBuilderFor<Inventory>();
            builder.from(ItemRemoved, from => from.subtract(model => model.removedTotal).with(event => event.quantity));

            const definition = builder.build('inventory', 'Inventory') as unknown as { From: FromRecord[] };
            const entry = definition.From.find(candidate => candidate.Key.Id === 'ItemRemoved')!;

            expect(entry.Value.Properties.removedTotal).toBe('$subtract(quantity)');
        });
    });

    describe('when using count on a from builder', () => {
        it('should produce a $count expression and return the builder for chaining', () => {
            const builder = new ProjectionBuilderFor<Inventory>();
            builder.from(ThingHappened, from => from.count(model => model.thingsHappenedCount).usingConstantKey('singleton'));

            const definition = builder.build('inventory', 'Inventory') as unknown as { From: FromRecord[] };
            const entry = definition.From.find(candidate => candidate.Key.Id === 'ThingHappened')!;

            expect(entry.Value.Properties.thingsHappenedCount).toBe('$count');
            expect(entry.Value.Key).toBe('$value(singleton)');
        });
    });

    describe('when setting constants on a from builder', () => {
        it('should encode constants as value expressions and null as a clear', () => {
            const builder = new ProjectionBuilderFor<Inventory>();
            builder.from(ThingHappened, from => {
                from.set(model => model.active).toValue(true);
                from.set(model => model.status).toValue('on-loan');
                from.set(model => model.total).toValue(2.5);
                from.set(model => model.started).toValue(new Date('2025-01-02T03:04:05.006Z'));
                from.set(model => model.cleared).toValue(null);
                from.set(model => model.id).toValue({ value: 'wrapped' });
                from.setThisValue().toValue('whole');
            });

            const definition = builder.build('inventory', 'Inventory') as unknown as { From: FromRecord[] };
            expect(definition.From[0].Value.Properties).toMatchObject({
                active: '$value(true)',
                status: '$value(on-loan)',
                total: '$value(2.5)',
                started: '$value(2025-01-02T03:04:05.006Z)',
                cleared: '$null',
                id: '$value(wrapped)',
                $this: '$value(whole)'
            });
        });

        it('should encode constant keys and parent keys as expressions', () => {
            const builder = new ProjectionBuilderFor<Inventory>();
            builder.from(ThingHappened, from => from.usingConstantKey('singleton').usingConstantParentKey('parent'));
            const definition = builder.build('inventory', 'Inventory') as unknown as { From: Array<{ Value: { Key: string; ParentKey: string } }> };
            expect(definition.From[0].Value.Key).toBe('$value(singleton)');
            expect(definition.From[0].Value.ParentKey).toBe('$value(parent)');
        });
    });

    describe('when using add on a join builder', () => {
        it('should produce a $add expression targeting the event property', () => {
            const builder = new ProjectionBuilderFor<Inventory>();
            builder.join(ItemAdded, join => join.on(model => model.id).add(model => model.total).with(event => event.quantity));

            const definition = builder.build('inventory', 'Inventory') as unknown as { Join: JoinRecord[] };
            const entry = definition.Join.find(candidate => candidate.Key.Id === 'ItemAdded')!;

            expect(entry.Value.Properties.total).toBe('$add(quantity)');
        });
    });

    describe('when setting a constant on a join builder', () => {
        it('should send a value expression for the property and key', () => {
            const builder = new ProjectionBuilderFor<Inventory>();
            builder.join(ItemAdded, join => join.on(model => model.id).usingConstantKey('singleton').set(model => model.status).toValue('on-loan'));
            const definition = builder.build('inventory', 'Inventory') as unknown as { Join: Array<{ Value: { Key: string; Properties: Record<string, string> } }> };
            expect(definition.Join[0].Value.Key).toBe('$value(singleton)');
            expect(definition.Join[0].Value.Properties.status).toBe('$value(on-loan)');
        });
    });

    describe('when using subtract on a join builder', () => {
        it('should produce a $subtract expression targeting the event property', () => {
            const builder = new ProjectionBuilderFor<Inventory>();
            builder.join(ItemRemoved, join => join.on(model => model.id).subtract(model => model.removedTotal).with(event => event.quantity));

            const definition = builder.build('inventory', 'Inventory') as unknown as { Join: JoinRecord[] };
            const entry = definition.Join.find(candidate => candidate.Key.Id === 'ItemRemoved')!;

            expect(entry.Value.Properties.removedTotal).toBe('$subtract(quantity)');
        });
    });

    describe('when using count on a join builder', () => {
        it('should produce a $count expression', () => {
            const builder = new ProjectionBuilderFor<Inventory>();
            builder.join(ThingHappened, join => join.on(model => model.id).count(model => model.thingsHappenedCount));

            const definition = builder.build('inventory', 'Inventory') as unknown as { Join: JoinRecord[] };
            const entry = definition.Join.find(candidate => candidate.Key.Id === 'ThingHappened')!;

            expect(entry.Value.Properties.thingsHappenedCount).toBe('$count');
        });
    });

    describe('when joining without an on property', () => {
        it('should reject a definition that the kernel cannot convert', () => {
            const builder = new ProjectionBuilderFor<Inventory>();
            builder.join(ThingHappened, join => join.count(model => model.thingsHappenedCount));
            expect(() => builder.build('inventory', 'Inventory'))
                .toThrow("A join with event 'ThingHappened' requires an on property.");
        });
    });

    describe('when using count with event context property on fromEvery', () => {
        it('should produce a $count expression with dictionary key from event context', () => {
            const builder = new ProjectionBuilderFor<Inventory>();
            builder.fromEvery(fromEvery => fromEvery.count(model => model.countsByEventType, 'eventType'));

            const definition = builder.build('inventory', 'Inventory') as unknown as { All: AllDefinition };

            expect(definition.All.Properties['countsByEventType.$eventContext.eventType']).toBe('$count');
        });
    });

    describe('when using increment with event context property on fromEvery', () => {
        it('should produce a $increment expression with dictionary key from event context', () => {
            const builder = new ProjectionBuilderFor<Inventory>();
            builder.fromEvery(fromEvery => fromEvery.increment(model => model.incrementsByEventType, 'eventType'));

            const definition = builder.build('inventory', 'Inventory') as unknown as { All: AllDefinition };

            expect(definition.All.Properties['incrementsByEventType.$eventContext.eventType']).toBe('$increment');
        });
    });

    describe('when using decrement with event context property on fromEvery', () => {
        it('should produce a $decrement expression with dictionary key from event context', () => {
            const builder = new ProjectionBuilderFor<Inventory>();
            builder.fromEvery(fromEvery => fromEvery.decrement(model => model.decrementsByEventType, 'eventType'));

            const definition = builder.build('inventory', 'Inventory') as unknown as { All: AllDefinition };

            expect(definition.All.Properties['decrementsByEventType.$eventContext.eventType']).toBe('$decrement');
        });
    });

    describe('when using multiple fromEvery operations', () => {
        it('should produce all operations in the All.Properties definition', () => {
            const builder = new ProjectionBuilderFor<Inventory>();
            builder.fromEvery(fromEvery => {
                fromEvery.count(model => model.countsByEventType, 'eventType');
                fromEvery.increment(model => model.incrementsByEventType, 'correlationId');
                fromEvery.set(model => model.id).toEventSourceId();
            });

            const definition = builder.build('inventory', 'Inventory') as unknown as { All: AllDefinition };

            expect(definition.All.Properties['countsByEventType.$eventContext.eventType']).toBe('$count');
            expect(definition.All.Properties['incrementsByEventType.$eventContext.correlationId']).toBe('$increment');
            expect(definition.All.Properties.id).toBe('$eventSourceId');
        });
    });
});
