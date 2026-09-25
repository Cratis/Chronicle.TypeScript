// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { field } from '@cratis/fundamentals';
import { describe, expect, it } from 'vitest';
import type { IClientArtifactsProvider } from '../artifacts/IClientArtifactsProvider.js';
import { eventType } from '../events/eventTypeDecorator.js';
import { childrenFrom } from '../projections/modelBound/childrenFrom.js';
import { nested } from '../projections/modelBound/nested.js';
import { TypeDiscoverer } from '../types/TypeDiscoverer.js';
import { DecoratorType } from '../types/DecoratorType.js';
import { DefaultClientArtifactsProvider } from '../artifacts/DefaultClientArtifactsProvider.js';
import { JsonSchemaGenerator } from '../schemas/JsonSchemaGenerator.js';
import { projection } from '../projections/declarative/projection.js';
import type { IProjectionBuilderFor } from '../projections/declarative/IProjectionBuilderFor.js';
import { setFrom } from '../projections/modelBound/setFrom.js';
import { rootReadModelTypes } from './rootReadModelTypes.js';
import { Projections } from '../projections/Projections.js';
import type { ChronicleConnection } from '../connection/ChronicleConnection.js';
import { assertUniqueReadModelIds } from './assertUniqueReadModelIds.js';

class Added { value!: string; }
eventType()(Added);

function parentWithChild() {
    class Item { value!: string; }
    setFrom(Added)(Item.prototype, 'value');
    class Parent { items!: Item[]; }
    field(Array, { genericArguments: [Item] })(Parent.prototype, 'items');
    childrenFrom(Added)(Parent.prototype, 'items');
    return { Parent, Item };
}

describe('root model-bound discovery', () => {
    it('discovers only the parent as a root projection', async () => {
        const { Parent, Item } = parentWithChild();
        const artifacts = { readModels: [Parent, Item], projections: [], reducers: [] } as unknown as IClientArtifactsProvider;
        const projections = new Projections('test', 'Default', {} as ChronicleConnection, artifacts, 'sink');
        await projections.discover();
        expect(projections.hasFor('Parent')).toBe(true);
        expect(projections.hasFor('Item')).toBe(false);
    });

    it('does not register a child with its own setFrom as a root', () => {
        const { Parent, Item } = parentWithChild();
        const artifacts = { readModels: [Parent, Item], projections: [], reducers: [] } as unknown as IClientArtifactsProvider;
        expect(rootReadModelTypes(artifacts)).toEqual([Parent]);
    });

    it('resolves children from decorator metadata without design metadata', () => {
        class Item { value = ''; }
        setFrom(Added)(Item.prototype, 'value');
        class Parent { items: Item[] = []; }
        childrenFrom(Added, Item)(Parent.prototype, 'items');
        const artifacts = { readModels: [Parent, Item], projections: [], reducers: [] } as unknown as IClientArtifactsProvider;
        expect(rootReadModelTypes(artifacts)).toEqual([Parent]);
        expect(JsonSchemaGenerator.generate(Parent, undefined, true).properties?.items.items?.properties?.value.type).toBe('string');
        const projections = new Projections('test', 'Default', {} as ChronicleConnection, artifacts, 'sink');
        return projections.discover().then(() => {
            expect(projections.hasFor('Parent')).toBe(true);
            expect(projections.hasFor('Item')).toBe(false);
        });
    });

    it('excludes nested default-instance members and their grandchildren', () => {
        class Leaf { value = ''; }
        setFrom(Added)(Leaf.prototype, 'value');
        class Address { leaf = new Leaf(); }
        nested(Address.prototype, 'leaf');
        class Parent { addr = new Address(); }
        nested(Parent.prototype, 'addr');
        const artifacts = { readModels: [Parent, Address, Leaf], projections: [], reducers: [] } as unknown as IClientArtifactsProvider;
        expect(rootReadModelTypes(artifacts)).toEqual([Parent]);
    });

    it('excludes a typed child referenced only by a declarative children builder', () => {
        class Child { value = ''; }
        setFrom(Added)(Child.prototype, 'value');
        class Parent { children: Child[] = []; }
        field(Array, { genericArguments: [Child] })(Parent.prototype, 'children');
        class ParentProjection {
            define(builder: IProjectionBuilderFor<Parent>) { builder.children<Child>(parent => parent.children, () => {}); }
        }
        projection('parent-projection', Parent)(ParentProjection);
        const artifacts = { readModels: [Parent, Child], projections: [ParentProjection], reducers: [] } as unknown as IClientArtifactsProvider;
        expect(rootReadModelTypes(artifacts)).toEqual([Parent]);
    });

    it('retains a self-referencing tree as a root', () => {
        class Node { children: Node[] = []; }
        childrenFrom(Added, Node)(Node.prototype, 'children');
        const artifacts = { readModels: [Node], projections: [], reducers: [] } as unknown as IClientArtifactsProvider;
        expect(rootReadModelTypes(artifacts)).toEqual([Node]);
    });

    it('does not eagerly register a property-only child as a root', () => {
        const discoverer = new TypeDiscoverer();
        const before = discoverer.getTypesByDecoratorType(DecoratorType.ReadModel);
        const { Parent, Item } = parentWithChild();
        expect(discoverer.getTypesByDecoratorType(DecoratorType.ReadModel)).toEqual(before);
        const artifacts = new DefaultClientArtifactsProvider(discoverer);
        expect(rootReadModelTypes(artifacts)).toContain(Parent);
        expect(rootReadModelTypes(artifacts)).not.toContain(Item);
    });

    it('permits equal-named child types under different parents', () => {
        const first = parentWithChild();
        const second = parentWithChild();
        Object.defineProperty(second.Parent, 'name', { value: 'OtherParent' });
        const artifacts = { readModels: [first.Parent, first.Item, second.Item, second.Parent], projections: [], reducers: [] } as unknown as IClientArtifactsProvider;
        expect(() => assertUniqueReadModelIds(rootReadModelTypes(artifacts))).not.toThrow();
        expect(rootReadModelTypes(artifacts)).toEqual([first.Parent, second.Parent]);
    });
});
