// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { field } from '@cratis/fundamentals';
import { describe, expect, it } from 'vitest';
import type { IClientArtifactsProvider } from '../artifacts/IClientArtifactsProvider.js';
import { eventType } from '../events/eventTypeDecorator.js';
import { childrenFrom } from '../projections/modelBound/childrenFrom.js';
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

    it('permits equal-named child types under different parents', () => {
        const first = parentWithChild();
        const second = parentWithChild();
        Object.defineProperty(second.Parent, 'name', { value: 'OtherParent' });
        const artifacts = { readModels: [first.Parent, first.Item, second.Item, second.Parent], projections: [], reducers: [] } as unknown as IClientArtifactsProvider;
        expect(() => assertUniqueReadModelIds(rootReadModelTypes(artifacts))).not.toThrow();
        expect(rootReadModelTypes(artifacts)).toEqual([first.Parent, second.Parent]);
    });
});
