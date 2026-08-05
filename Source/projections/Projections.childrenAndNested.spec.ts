// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { field } from '@cratis/fundamentals';
import { describe, expect, it, vi } from 'vitest';
import { IClientArtifactsProvider } from '../artifacts';
import { ChronicleConnection } from '../connection';
import { eventType } from '../events/eventTypeDecorator';
import { readModel } from '../readModels/readModel';
import { childrenFrom } from './modelBound/childrenFrom';
import { clearWith } from './modelBound/clearWith';
import { fromEvent } from './modelBound/fromEvent';
import { nested } from './modelBound/nested';
import { setFrom } from './modelBound/setFrom';
import { Projections } from './Projections';

// Decorators are applied as plain function calls (rather than `@decorator` syntax) so these
// fixtures don't depend on the test runner's decorator-syntax support.

class LineAdded {
    productId!: string;
    quantity!: number;
}
eventType()(LineAdded);

class LineQuantityChanged {
    quantity!: number;
}
eventType()(LineQuantityChanged);

class SummaryUpdated {
    total!: number;
}
eventType()(SummaryUpdated);

class SummaryCleared {}
eventType()(SummaryCleared);

class NoteAdded {
    text!: string;
}
eventType()(NoteAdded);

class NoteCleared {}
eventType()(NoteCleared);

class TagAdded {
    name!: string;
}
eventType()(TagAdded);

class OrderCreated {}
eventType()(OrderCreated);

class OrderLine {
    productId!: string;
    quantity!: number;
}
setFrom(LineQuantityChanged)(OrderLine.prototype, 'quantity');

class OrderSummary {
    total!: number;
}
setFrom(SummaryUpdated)(OrderSummary.prototype, 'total');
clearWith(SummaryCleared)(OrderSummary);

class OrderNote {
    text!: string;
}
setFrom(NoteAdded)(OrderNote.prototype, 'text');

class Order {
    id!: string;
    lines!: OrderLine[];
    summary!: OrderSummary | undefined;
    note!: OrderNote | undefined;
    tags!: string[];
}
childrenFrom(LineAdded, undefined, 'productId', undefined)(Order.prototype, 'lines');
field(Array, { enumerable: true, genericArguments: [OrderLine] })(Order.prototype, 'lines');
nested(Order.prototype, 'summary');
field(OrderSummary)(Order.prototype, 'summary');
nested(Order.prototype, 'note');
field(OrderNote)(Order.prototype, 'note');
clearWith(NoteCleared)(Order.prototype, 'note');
childrenFrom(TagAdded)(Order.prototype, 'tags');
fromEvent(OrderCreated)(Order);
readModel()(Order);

interface FromRecord {
    Key: { Id: string };
    Value: { Properties: Record<string, string>; Key: string; ParentKey: string };
}

interface ChildrenDefinition {
    IdentifiedBy: string;
    From: FromRecord[];
    RemovedWith: Array<{ Key: { Id: string } }>;
}

interface BuiltDefinition {
    Children: Record<string, ChildrenDefinition>;
    Nested: Record<string, ChildrenDefinition>;
}

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

    const projections = new Projections('test-store', connection, clientArtifacts, 'test-sink');
    return { projections, registerMock };
}

describe('Projections with childrenFrom, nested and clearWith', () => {
    describe('when registering a model-bound projection using them', () => {
        it('should not throw', async () => {
            const { projections } = createProjections([Order]);
            await expect(projections.register()).resolves.not.toThrow();
        });

        it('should build a children definition with the resolved child type wired up', async () => {
            const { projections, registerMock } = createProjections([Order]);
            await projections.register();

            const definition = registerMock.mock.calls[0][0].Projections[0] as BuiltDefinition;
            const lines = definition.Children.lines;

            expect(lines.IdentifiedBy).toBe('productId');
            const creationEntry = lines.From.find(candidate => candidate.Key.Id === 'LineAdded')!;
            expect(creationEntry.Value.Key).toBe('$eventSourceId');
            expect(creationEntry.Value.ParentKey).toBe('$eventSourceId');

            const updateEntry = lines.From.find(candidate => candidate.Key.Id === 'LineQuantityChanged')!;
            expect(updateEntry.Value.Properties.quantity).toBe('quantity');
        });

        it('should build a children definition even when the child element type cannot be resolved', async () => {
            const { projections, registerMock } = createProjections([Order]);
            await projections.register();

            const definition = registerMock.mock.calls[0][0].Projections[0] as BuiltDefinition;
            const tags = definition.Children.tags;

            expect(tags.From.some(candidate => candidate.Key.Id === 'TagAdded')).toBe(true);
        });

        it('should build a nested definition honoring a class-level clearWith on the nested type', async () => {
            const { projections, registerMock } = createProjections([Order]);
            await projections.register();

            const definition = registerMock.mock.calls[0][0].Projections[0] as BuiltDefinition;
            const summary = definition.Nested.summary;

            const updateEntry = summary.From.find(candidate => candidate.Key.Id === 'SummaryUpdated')!;
            expect(updateEntry.Value.Properties.total).toBe('total');
            expect(summary.RemovedWith.some(candidate => candidate.Key.Id === 'SummaryCleared')).toBe(true);
        });

        it('should build a nested definition honoring a property-level clearWith', async () => {
            const { projections, registerMock } = createProjections([Order]);
            await projections.register();

            const definition = registerMock.mock.calls[0][0].Projections[0] as BuiltDefinition;
            const note = definition.Nested.note;

            const updateEntry = note.From.find(candidate => candidate.Key.Id === 'NoteAdded')!;
            expect(updateEntry.Value.Properties.text).toBe('text');
            expect(note.RemovedWith.some(candidate => candidate.Key.Id === 'NoteCleared')).toBe(true);
        });
    });
});
