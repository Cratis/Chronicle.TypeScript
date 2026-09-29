// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { field } from '@cratis/fundamentals';
import { chai, describe, it, vi } from 'vitest';
import { IClientArtifactsProvider } from '../artifacts/index.js';
import { ChronicleConnection } from '../connection/index.js';
import { eventType } from '../events/eventTypeDecorator.js';
import { childrenFrom } from './modelBound/childrenFrom.js';
import { fromEvent } from './modelBound/fromEvent.js';
import { Projections } from './Projections.js';

chai.should();

class KeyedItemAdded {
    itemId = '';
    orderId = '';
    name = '';
}
eventType()(KeyedItemAdded);

class KeyedOrderCreated {}
eventType()(KeyedOrderCreated);

// No @field metadata on any collection: the child type comes only from the options.
class KeyedItem {
    id = '';
    sku = '';
    name = '';
}

class KeyedOrder {
    byKey: KeyedItem[] = [];
    byIdentifiedBy: KeyedItem[] = [];
    byParentKey: KeyedItem[] = [];
    byKeyAndIdentifiedBy: KeyedItem[] = [];
    byKeyAndParentKey: KeyedItem[] = [];
    byAll: KeyedItem[] = [];
    byFieldMetadata: KeyedItem[] = [];
}
childrenFrom(KeyedItemAdded, { childType: KeyedItem, key: 'itemId' })(KeyedOrder.prototype, 'byKey');
childrenFrom(KeyedItemAdded, { childType: KeyedItem, identifiedBy: 'sku' })(KeyedOrder.prototype, 'byIdentifiedBy');
childrenFrom(KeyedItemAdded, { childType: KeyedItem, parentKey: 'orderId' })(KeyedOrder.prototype, 'byParentKey');
childrenFrom(KeyedItemAdded, { childType: KeyedItem, key: 'itemId', identifiedBy: 'sku' })(KeyedOrder.prototype, 'byKeyAndIdentifiedBy');
childrenFrom(KeyedItemAdded, { childType: KeyedItem, key: 'itemId', parentKey: 'orderId' })(KeyedOrder.prototype, 'byKeyAndParentKey');
childrenFrom(KeyedItemAdded, { childType: KeyedItem, key: 'itemId', identifiedBy: 'sku', parentKey: 'orderId' })(KeyedOrder.prototype, 'byAll');
childrenFrom(KeyedItemAdded, { key: 'itemId' })(KeyedOrder.prototype, 'byFieldMetadata');
field(Array, { enumerable: true, genericArguments: [KeyedItem] })(KeyedOrder.prototype, 'byFieldMetadata');
fromEvent(KeyedOrderCreated)(KeyedOrder);

interface ChildrenDefinition {
    IdentifiedBy: string;
    From: Array<{ Key: { Id: string }; Value: { Key: string; ParentKey: string; Properties: Record<string, string> } }>;
}

async function registeredChildren(): Promise<Record<string, ChildrenDefinition>> {
    const register = vi.fn().mockResolvedValue(undefined);
    const connection = {
        readModels: { registerMany: vi.fn().mockResolvedValue(undefined) },
        projections: { register }
    } as unknown as ChronicleConnection;
    const artifacts = {
        eventTypes: [], readModels: [KeyedOrder], reactors: [], reducers: [], seeders: [], constraints: [],
        projections: [], webhooks: [], eventTypeMigrations: [], globalForHandlers: []
    } as unknown as IClientArtifactsProvider;
    await new Projections('test-store', 'test-namespace', connection, artifacts, 'test-sink').register();
    return register.mock.calls[0][0].Projections[0].Children;
}

function creation(children: Record<string, ChildrenDefinition>, property: string) {
    const child = children[property];
    const entry = child.From.find(candidate => candidate.Key.Id === 'KeyedItemAdded')!;
    return { identifiedBy: child.IdentifiedBy, key: entry.Value.Key, parentKey: entry.Value.ParentKey, properties: entry.Value.Properties };
}

describe('when registering childrenFrom with the options form', () => {
    it('should key children by the event property and map the discovered identifier from it', async () => {
        creation(await registeredChildren(), 'byKey').should.deep.equal({
            identifiedBy: 'id', key: 'itemId', parentKey: '$eventSourceId', properties: { id: 'itemId' }
        });
    });

    it('should use an explicit identifiedBy with the default event source key', async () => {
        creation(await registeredChildren(), 'byIdentifiedBy').should.deep.equal({
            identifiedBy: 'sku', key: '$eventSourceId', parentKey: '$eventSourceId', properties: { sku: '$eventContext(EventSourceId)' }
        });
    });

    it('should use an explicit parent key with the default child key', async () => {
        creation(await registeredChildren(), 'byParentKey').should.deep.equal({
            identifiedBy: 'id', key: '$eventSourceId', parentKey: 'orderId', properties: { id: '$eventContext(EventSourceId)' }
        });
    });

    it('should map an explicit identifiedBy from an explicit key', async () => {
        creation(await registeredChildren(), 'byKeyAndIdentifiedBy').should.deep.equal({
            identifiedBy: 'sku', key: 'itemId', parentKey: '$eventSourceId', properties: { sku: 'itemId' }
        });
    });

    it('should combine an explicit key and parent key', async () => {
        creation(await registeredChildren(), 'byKeyAndParentKey').should.deep.equal({
            identifiedBy: 'id', key: 'itemId', parentKey: 'orderId', properties: { id: 'itemId' }
        });
    });

    it('should combine key, identifiedBy and parent key', async () => {
        creation(await registeredChildren(), 'byAll').should.deep.equal({
            identifiedBy: 'sku', key: 'itemId', parentKey: 'orderId', properties: { sku: 'itemId' }
        });
    });

    it('should emit the same definition when the child type comes from field metadata', async () => {
        const children = await registeredChildren();
        creation(children, 'byFieldMetadata').should.deep.equal(creation(children, 'byKey'));
    });
});
