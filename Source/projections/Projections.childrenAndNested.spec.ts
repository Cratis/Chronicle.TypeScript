// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { AutoMap } from '@cratis/chronicle.contracts';
import { field } from '@cratis/fundamentals';
import { describe, expect, it, vi } from 'vitest';
import { IClientArtifactsProvider } from '../artifacts/index.js';
import { ChronicleConnection } from '../connection/index.js';
import { eventType } from '../events/eventTypeDecorator.js';
import { childrenFrom } from './modelBound/childrenFrom.js';
import { clearWith } from './modelBound/clearWith.js';
import { fromEvent } from './modelBound/fromEvent.js';
import { nested } from './modelBound/nested.js';
import { noAutoMap } from './modelBound/noAutoMap.js';
import { setFrom } from './modelBound/setFrom.js';
import { Projections } from './Projections.js';

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

class LineQuantityCleared {}
eventType()(LineQuantityCleared);

class SummaryUpdated {
    total!: number;
}
eventType()(SummaryUpdated);

class SummaryCleared {}
eventType()(SummaryCleared);

class SummaryTotalCleared {}
eventType()(SummaryTotalCleared);

class NoteAdded {
    text!: string;
}
eventType()(NoteAdded);

class NoteCleared {}
eventType()(NoteCleared);

class OrderLabelCleared {}
eventType()(OrderLabelCleared);

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
noAutoMap(OrderLine.prototype, 'quantity');
clearWith(LineQuantityCleared)(OrderLine.prototype, 'quantity');

class ChildWithId {
    id = '';
    label = '';
}
class ChildWithUppercaseId {
    Id = '';
}
class ChildWithExplicitId {
    employeeNumber = '';
    label = '';
}
class ChildWithMatchingEventKey {
    productId = '';
}
class ChildWithMappedId {
    id = '';
}
setFrom(LineAdded, 'productId')(ChildWithMappedId.prototype, 'id');
class ChildWithoutAutoMap {
    id = '';
}
noAutoMap(ChildWithoutAutoMap);
class IdentifiedChildren {
    byConvention!: ChildWithId[];
    byUppercaseId!: ChildWithUppercaseId[];
    byExplicitId!: ChildWithExplicitId[];
    byInferredEventKey!: ChildWithMatchingEventKey[];
    byEventKey!: ChildWithId[];
    byMatchingKey!: ChildWithId[];
    withExplicitMapping!: ChildWithMappedId[];
    withoutAutoMap!: ChildWithoutAutoMap[];
}
childrenFrom(LineAdded, ChildWithId)(IdentifiedChildren.prototype, 'byConvention');
childrenFrom(LineAdded, ChildWithUppercaseId)(IdentifiedChildren.prototype, 'byUppercaseId');
childrenFrom(LineAdded, ChildWithExplicitId, 'employeeNumber')(IdentifiedChildren.prototype, 'byExplicitId');
childrenFrom(LineAdded, 'productId')(IdentifiedChildren.prototype, 'byInferredEventKey');
childrenFrom(LineAdded, 'productId', 'id')(IdentifiedChildren.prototype, 'byEventKey');
childrenFrom(LineAdded, 'id', 'id')(IdentifiedChildren.prototype, 'byMatchingKey');
childrenFrom(LineAdded, ChildWithMappedId)(IdentifiedChildren.prototype, 'withExplicitMapping');
childrenFrom(LineAdded, ChildWithoutAutoMap)(IdentifiedChildren.prototype, 'withoutAutoMap');
field(Array, { enumerable: true, genericArguments: [ChildWithMatchingEventKey] })(IdentifiedChildren.prototype, 'byInferredEventKey');
field(Array, { enumerable: true, genericArguments: [ChildWithId] })(IdentifiedChildren.prototype, 'byEventKey');
field(Array, { enumerable: true, genericArguments: [ChildWithId] })(IdentifiedChildren.prototype, 'byMatchingKey');
fromEvent(OrderCreated)(IdentifiedChildren);

class OrderSummary {
    total!: number;
}
setFrom(SummaryUpdated)(OrderSummary.prototype, 'total');
noAutoMap(OrderSummary.prototype, 'total');
clearWith(SummaryTotalCleared)(OrderSummary.prototype, 'total');
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
    label?: string;
}
clearWith(OrderLabelCleared)(Order.prototype, 'label');
childrenFrom(LineAdded, undefined, 'productId', undefined)(Order.prototype, 'lines');
field(Array, { enumerable: true, genericArguments: [OrderLine] })(Order.prototype, 'lines');
nested(Order.prototype, 'summary');
field(OrderSummary)(Order.prototype, 'summary');
nested(Order.prototype, 'note');
field(OrderNote)(Order.prototype, 'note');
clearWith(NoteCleared)(Order.prototype, 'note');
childrenFrom(TagAdded)(Order.prototype, 'tags');
fromEvent(OrderCreated)(Order);

class ExplicitLine {
    productId!: string;
    quantity!: number;
}
setFrom(LineQuantityChanged)(ExplicitLine.prototype, 'quantity');
noAutoMap(ExplicitLine);

class ExplicitSummary {
    total!: number;
}
setFrom(SummaryUpdated)(ExplicitSummary.prototype, 'total');
noAutoMap(ExplicitSummary);

class OrderWithExplicitParts {
    id!: string;
    lines!: ExplicitLine[];
    summary!: ExplicitSummary | undefined;
}
childrenFrom(LineAdded, undefined, 'productId')(OrderWithExplicitParts.prototype, 'lines');
field(Array, { enumerable: true, genericArguments: [ExplicitLine] })(OrderWithExplicitParts.prototype, 'lines');
nested(OrderWithExplicitParts.prototype, 'summary');
field(ExplicitSummary)(OrderWithExplicitParts.prototype, 'summary');
fromEvent(OrderCreated)(OrderWithExplicitParts);

class OrderWithoutAutoMap {
    id!: string;
    lines!: OrderLine[];
    summary!: OrderSummary | undefined;
}
childrenFrom(LineAdded, undefined, 'productId')(OrderWithoutAutoMap.prototype, 'lines');
field(Array, { enumerable: true, genericArguments: [OrderLine] })(OrderWithoutAutoMap.prototype, 'lines');
nested(OrderWithoutAutoMap.prototype, 'summary');
field(OrderSummary)(OrderWithoutAutoMap.prototype, 'summary');
noAutoMap(OrderWithoutAutoMap);
fromEvent(OrderCreated)(OrderWithoutAutoMap);

class Grandchild {
    id!: string;
}

class ChildWithGrandchildren {
    grandchildren!: Grandchild[];
    detail!: Grandchild | undefined;
}
childrenFrom(LineAdded)(ChildWithGrandchildren.prototype, 'grandchildren');
field(Array, { enumerable: true, genericArguments: [Grandchild] })(ChildWithGrandchildren.prototype, 'grandchildren');
nested(ChildWithGrandchildren.prototype, 'detail');
field(Grandchild)(ChildWithGrandchildren.prototype, 'detail');

class DecoratedChildWithGrandchildren {
    grandchildren!: Grandchild[];
    detail!: Grandchild | undefined;
}
childrenFrom(LineAdded)(DecoratedChildWithGrandchildren.prototype, 'grandchildren');
field(Array, { enumerable: true, genericArguments: [Grandchild] })(DecoratedChildWithGrandchildren.prototype, 'grandchildren');
nested(DecoratedChildWithGrandchildren.prototype, 'detail');
field(Grandchild)(DecoratedChildWithGrandchildren.prototype, 'detail');
noAutoMap(DecoratedChildWithGrandchildren);

class OrderWithDecoratedChild {
    children!: DecoratedChildWithGrandchildren[];
}
childrenFrom(LineAdded)(OrderWithDecoratedChild.prototype, 'children');
field(Array, { enumerable: true, genericArguments: [DecoratedChildWithGrandchildren] })(OrderWithDecoratedChild.prototype, 'children');
fromEvent(OrderCreated)(OrderWithDecoratedChild);

class DecoratedOrderWithUndecoratedChild {
    children!: ChildWithGrandchildren[];
}
childrenFrom(LineAdded)(DecoratedOrderWithUndecoratedChild.prototype, 'children');
field(Array, { enumerable: true, genericArguments: [ChildWithGrandchildren] })(DecoratedOrderWithUndecoratedChild.prototype, 'children');
noAutoMap(DecoratedOrderWithUndecoratedChild);
fromEvent(OrderCreated)(DecoratedOrderWithUndecoratedChild);

interface FromRecord {
    Key: { Id: string };
    Value: { Properties: Record<string, string>; Key: string; ParentKey: string };
}

interface ChildrenDefinition {
    IdentifiedBy: string;
    AutoMap: AutoMap;
    NoAutoMapProperties: string[];
    From: FromRecord[];
    RemovedWith: Array<{ Key: { Id: string }; Value: { Key: string; ParentKey: string } }>;
    Children: Record<string, ChildrenDefinition>;
    Nested: Record<string, ChildrenDefinition>;
}

interface BuiltDefinition {
    From: FromRecord[];
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
        eventTypeMigrations: [],
        globalForHandlers: []
    };

    const projections = new Projections('test-store', 'test-namespace', connection, clientArtifacts, 'test-sink');
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
            expect(lines.AutoMap).toBe(AutoMap.Enabled);
            expect(lines.NoAutoMapProperties).toEqual(['quantity']);
            const creationEntry = lines.From.find(candidate => candidate.Key.Id === 'LineAdded')!;
            expect(creationEntry.Value.Key).toBe('$eventSourceId');
            expect(creationEntry.Value.ParentKey).toBe('$eventSourceId');

            const updateEntry = lines.From.find(candidate => candidate.Key.Id === 'LineQuantityChanged')!;
            expect(updateEntry.Value.Properties.quantity).toBe('quantity');
        });

        it('should map a convention or explicit child identifier from the creating event source id', async () => {
            const { projections, registerMock } = createProjections([IdentifiedChildren]);
            await projections.register();

            const children = (registerMock.mock.calls[0][0].Projections[0] as BuiltDefinition).Children;
            expect(children.byConvention.IdentifiedBy).toBe('id');
            expect(children.byConvention.From[0].Value.Properties).toEqual({ id: '$eventContext(EventSourceId)' });
            expect(children.byUppercaseId.IdentifiedBy).toBe('Id');
            expect(children.byUppercaseId.From[0].Value.Properties).toEqual({ Id: '$eventContext(EventSourceId)' });
            expect(children.byExplicitId.IdentifiedBy).toBe('employeeNumber');
            expect(children.byExplicitId.From[0].Value.Properties).toEqual({ employeeNumber: '$eventContext(EventSourceId)' });
        });

        it('should map the child identifier from an explicit event key when it differs from the property name', async () => {
            const { projections, registerMock } = createProjections([IdentifiedChildren]);
            await projections.register();

            const children = (registerMock.mock.calls[0][0].Projections[0] as BuiltDefinition).Children;
            expect(children.byEventKey.From[0].Value.Properties.id).toBe('productId');
            expect(children.byInferredEventKey.IdentifiedBy).toBe('productId');
            expect(children.byInferredEventKey.From[0].Value.Properties).toEqual({});
            expect(children.byMatchingKey.From[0].Value.Properties).toEqual({});
        });

        it('should leave explicitly mapped identifiers and disabled auto-mapping unchanged', async () => {
            const { projections, registerMock } = createProjections([IdentifiedChildren]);
            await projections.register();

            const children = (registerMock.mock.calls[0][0].Projections[0] as BuiltDefinition).Children;
            expect(children.withExplicitMapping.From[0].Value.Properties).toEqual({ id: 'productId' });
            expect(children.withoutAutoMap.From[0].Value.Properties).toEqual({});
        });

        it('should clear only the child member through a From mapping', async () => {
            const { projections, registerMock } = createProjections([Order]);
            await projections.register();

            const lines = (registerMock.mock.calls[0][0].Projections[0] as BuiltDefinition).Children.lines;
            const clearEntry = lines.From.find(candidate => candidate.Key.Id === 'LineQuantityCleared')!;
            expect(clearEntry.Value).toEqual({ Properties: { quantity: '$null' }, Key: '$eventSourceId', ParentKey: '' });
            expect(lines.RemovedWith.some(candidate => candidate.Key.Id === 'LineQuantityCleared')).toBe(false);
        });

        it('should build a children definition even when the child element type cannot be resolved', async () => {
            const { projections, registerMock } = createProjections([Order]);
            await projections.register();

            const definition = registerMock.mock.calls[0][0].Projections[0] as BuiltDefinition;
            const tags = definition.Children.tags;

            expect(tags.From.some(candidate => candidate.Key.Id === 'TagAdded')).toBe(true);
            expect(tags.AutoMap).toBe(AutoMap.Enabled);
            expect(tags.NoAutoMapProperties).toEqual([]);
        });

        it('should build a nested definition honoring a class-level clearWith on the nested type', async () => {
            const { projections, registerMock } = createProjections([Order]);
            await projections.register();

            const definition = registerMock.mock.calls[0][0].Projections[0] as BuiltDefinition;
            const summary = definition.Nested.summary;

            expect(summary.IdentifiedBy).toBe('*NotSet*');
            expect(summary.AutoMap).toBe(AutoMap.Enabled);
            expect(summary.NoAutoMapProperties).toEqual(['total']);
            const updateEntry = summary.From.find(candidate => candidate.Key.Id === 'SummaryUpdated')!;
            expect(updateEntry.Value.Properties.total).toBe('total');
            expect(summary.RemovedWith).toContainEqual({ Key: expect.objectContaining({ Id: 'SummaryCleared' }), Value: { Key: '$eventSourceId', ParentKey: '' } });
            expect(summary.From.some(candidate => candidate.Key.Id === 'SummaryCleared')).toBe(false);
        });

        it('should clear only the nested type member through a From mapping', async () => {
            const { projections, registerMock } = createProjections([Order]);
            await projections.register();

            const summary = (registerMock.mock.calls[0][0].Projections[0] as BuiltDefinition).Nested.summary;
            const clearEntry = summary.From.find(candidate => candidate.Key.Id === 'SummaryTotalCleared')!;
            expect(clearEntry.Value).toEqual({ Properties: { total: '$null' }, Key: '$eventSourceId', ParentKey: '' });
            expect(summary.RemovedWith.some(candidate => candidate.Key.Id === 'SummaryTotalCleared')).toBe(false);
        });

        it('should disable AutoMap on decorated child and nested types while retaining explicit mappings', async () => {
            const { projections, registerMock } = createProjections([OrderWithExplicitParts]);
            await projections.register();

            const definition = registerMock.mock.calls[0][0].Projections[0] as BuiltDefinition;
            expect(definition.Children.lines.AutoMap).toBe(AutoMap.Disabled);
            expect(definition.Children.lines.From.find(candidate => candidate.Key.Id === 'LineQuantityChanged')?.Value.Properties.quantity).toBe('quantity');
            expect(definition.Nested.summary.AutoMap).toBe(AutoMap.Disabled);
            expect(definition.Nested.summary.From.find(candidate => candidate.Key.Id === 'SummaryUpdated')?.Value.Properties.total).toBe('total');
        });

        it('should inherit disabled AutoMap from the declaring model for child and nested types', async () => {
            const { projections, registerMock } = createProjections([OrderWithoutAutoMap]);
            await projections.register();

            const definition = registerMock.mock.calls[0][0].Projections[0] as BuiltDefinition;
            expect(definition.Children.lines.AutoMap).toBe(AutoMap.Disabled);
            expect(definition.Nested.summary.AutoMap).toBe(AutoMap.Disabled);
        });

        it('should disable grandchild definitions when their declaring child type is decorated', async () => {
            const { projections, registerMock } = createProjections([OrderWithDecoratedChild]);
            await projections.register();

            const definition = registerMock.mock.calls[0][0].Projections[0] as BuiltDefinition;
            const child = definition.Children.children;
            expect(child.AutoMap).toBe(AutoMap.Disabled);
            expect(child.Children.grandchildren.AutoMap).toBe(AutoMap.Disabled);
            expect(child.Nested.detail.AutoMap).toBe(AutoMap.Disabled);
        });

        it('should not cascade the decorated root policy past an undecorated child', async () => {
            const { projections, registerMock } = createProjections([DecoratedOrderWithUndecoratedChild]);
            await projections.register();

            const definition = registerMock.mock.calls[0][0].Projections[0] as BuiltDefinition;
            const child = definition.Children.children;
            expect(child.AutoMap).toBe(AutoMap.Disabled);
            expect(child.Children.grandchildren.AutoMap).toBe(AutoMap.Enabled);
            expect(child.Nested.detail.AutoMap).toBe(AutoMap.Enabled);
        });

        it('should build a nested definition honoring a property-level clearWith', async () => {
            const { projections, registerMock } = createProjections([Order]);
            await projections.register();

            const definition = registerMock.mock.calls[0][0].Projections[0] as BuiltDefinition;
            const note = definition.Nested.note;

            expect(note.IdentifiedBy).toBe('*NotSet*');
            const updateEntry = note.From.find(candidate => candidate.Key.Id === 'NoteAdded')!;
            expect(updateEntry.Value.Properties.text).toBe('text');
            expect(note.RemovedWith.some(candidate => candidate.Key.Id === 'NoteCleared')).toBe(true);
            expect(note.From.some(candidate => candidate.Key.Id === 'NoteCleared')).toBe(false);
        });

        it('should keep root scalar clearWith as a From mapping', async () => {
            const { projections, registerMock } = createProjections([Order]);
            await projections.register();

            const definition = registerMock.mock.calls[0][0].Projections[0] as BuiltDefinition;
            const clearEntry = definition.From.find(candidate => candidate.Key.Id === 'OrderLabelCleared')!;
            expect(clearEntry.Value).toEqual({ Properties: { label: '$null' }, Key: '$eventSourceId', ParentKey: '' });
        });
    });
});
