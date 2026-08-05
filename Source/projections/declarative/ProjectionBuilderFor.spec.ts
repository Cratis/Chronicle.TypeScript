// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { eventType } from '../../events/eventTypeDecorator';
import { ProjectionBuilderFor } from './ProjectionBuilderFor';

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
}

interface FromRecord {
    Key: { Id: string };
    Value: { Properties: Record<string, string>; Key: string };
}

interface JoinRecord {
    Key: { Id: string };
    Value: { Properties: Record<string, string> };
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
            expect(entry.Value.Key).toBe('singleton');
        });
    });

    describe('when using add on a join builder', () => {
        it('should produce a $add expression targeting the event property', () => {
            const builder = new ProjectionBuilderFor<Inventory>();
            builder.join(ItemAdded, join => join.add(model => model.total).with(event => event.quantity));

            const definition = builder.build('inventory', 'Inventory') as unknown as { Join: JoinRecord[] };
            const entry = definition.Join.find(candidate => candidate.Key.Id === 'ItemAdded')!;

            expect(entry.Value.Properties.total).toBe('$add(quantity)');
        });
    });

    describe('when using subtract on a join builder', () => {
        it('should produce a $subtract expression targeting the event property', () => {
            const builder = new ProjectionBuilderFor<Inventory>();
            builder.join(ItemRemoved, join => join.subtract(model => model.removedTotal).with(event => event.quantity));

            const definition = builder.build('inventory', 'Inventory') as unknown as { Join: JoinRecord[] };
            const entry = definition.Join.find(candidate => candidate.Key.Id === 'ItemRemoved')!;

            expect(entry.Value.Properties.removedTotal).toBe('$subtract(quantity)');
        });
    });

    describe('when using count on a join builder', () => {
        it('should produce a $count expression', () => {
            const builder = new ProjectionBuilderFor<Inventory>();
            builder.join(ThingHappened, join => join.count(model => model.thingsHappenedCount));

            const definition = builder.build('inventory', 'Inventory') as unknown as { Join: JoinRecord[] };
            const entry = definition.Join.find(candidate => candidate.Key.Id === 'ThingHappened')!;

            expect(entry.Value.Properties.thingsHappenedCount).toBe('$count');
        });
    });
});
