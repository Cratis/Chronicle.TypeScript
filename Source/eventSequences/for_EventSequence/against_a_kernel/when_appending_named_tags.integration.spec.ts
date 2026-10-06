// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, chai, describe, it } from 'vitest';
import { field } from '@cratis/fundamentals';
import { ObserverRunningState } from '@cratis/chronicle.contracts';
import { ChronicleClient, ChronicleOptions, NamedTag, eventType, reactor, type AppendedEvent, type EventContext,
    type IClientArtifactsProvider, type IEventStore } from '../../../index.js';
import type { ChronicleConnection } from '../../../connection/index.js';

chai.should();
function should(value: unknown): ReturnType<typeof chai.expect> {
    return (value as { should: ReturnType<typeof chai.expect> }).should;
}
const connectionString = process.env.CHRONICLE_INTEGRATION_CONNECTION_STRING;

@eventType()
class NamedTagsItemImported {
    @field(String) sku = '';
}

const delivered = new Map<string, EventContext>();
@reactor()
class NamedTagsImportTracker {
    namedTagsItemImported(event: NamedTagsItemImported, context: EventContext) {
        delivered.set(event.sku, context);
    }
}

const artifacts: IClientArtifactsProvider = {
    eventTypes: [NamedTagsItemImported], reactors: [NamedTagsImportTracker], reducers: [], readModels: [], seeders: [],
    constraints: [], projections: [], webhooks: [], eventTypeMigrations: [], globalForHandlers: []
};

async function eventually(accept: () => boolean | Promise<boolean>, timeoutMs = 30_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (!await accept()) {
        if (Date.now() > deadline) throw new Error('Timed out waiting for the kernel');
        await new Promise(resolve => setTimeout(resolve, 250));
    }
}

const pairs = (context: { namedTags?: ReadonlyArray<NamedTag> }) => (context.namedTags ?? []).map(tag => `${tag.name}=${tag.value}`);
const item = (sku: string) => Object.assign(new NamedTagsItemImported(), { sku });

describe.skipIf(!connectionString && !process.env.CI)('when appending named tags against a kernel', () => {
    const storeName = `NamedTags${randomUUID().replaceAll('-', '').slice(0, 12)}`;
    const source = randomUUID();
    let client: ChronicleClient;
    let store: IEventStore;
    let stored: Map<string, AppendedEvent>;

    beforeAll(async () => {
        client = new ChronicleClient(ChronicleOptions.fromConnectionString(connectionString!, {
            discoveryPatterns: [], clientArtifactsProvider: artifacts
        }));
        store = await client.getEventStore(storeName);
        const connection = (store as unknown as { _connection: ChronicleConnection })._connection;
        await eventually(async () => {
            const observer = await connection.observers.getObserverInformation({ EventStore: storeName, Namespace: 'Default',
                ObserverId: NamedTagsImportTracker.name, EventSequenceId: 'event-log' });
            return observer.IsSubscribed && observer.RunningState === ObserverRunningState.Active;
        });

        const single = await store.eventLog.append(source, item('single'), {
            tags: ['import'],
            namedTags: [new NamedTag('import-batch', 'b-1'), new NamedTag('import-batch', 'B-1'), new NamedTag('empty', ''),
                new NamedTag('import-batch', 'b-1')]
        });
        should(single.isSuccess).be.true;
        const batch = await store.eventLog.appendMany([
            { eventSourceId: source, event: item('debit'), namedTags: [new NamedTag('side', 'debit')] },
            { eventSourceId: source, event: item('credit'), namedTags: [new NamedTag('side', 'credit'), new NamedTag('transfer', 't-1')] }
        ], { namedTags: [new NamedTag('transfer', 't-1')] });
        should(batch.every(result => result.isSuccess)).be.true;
        const untagged = await store.eventLog.append(source, item('untagged'));
        should(untagged.isSuccess).be.true;

        const unitOfWork = store.unitOfWorkManager.begin();
        await store.eventLog.transactional.append(source, item('transactional'), { namedTags: [new NamedTag('unit', 'u-1')] });
        await unitOfWork.commit();
        should(unitOfWork.isSuccess).be.true;

        const events = await store.eventLog.getForEventSourceIdAndEventTypes(source, [NamedTagsItemImported]);
        stored = new Map(events.map(event => [(event.content as { sku: string }).sku, event]));
        await eventually(() => delivered.has('transactional'));
    });
    afterAll(() => client?.dispose());

    it('should round-trip distinct single-append named tags in order through a read', () =>
        should(pairs(stored.get('single')!.context)).deep.equal(['import-batch=b-1', 'import-batch=B-1', 'empty=']));
    it('should keep plain tags beside named tags', () =>
        should(stored.get('single')!.context.tags.map(tag => tag.value)).deep.equal(['import']));
    it('should store each batch event with its own tags followed by the shared tags', () => {
        should(pairs(stored.get('debit')!.context)).deep.equal(['side=debit', 'transfer=t-1']);
        should(pairs(stored.get('credit')!.context)).deep.equal(['side=credit', 'transfer=t-1']);
    });
    it('should store an untagged event with no named tags', () => should(pairs(stored.get('untagged')!.context)).deep.equal([]));
    it('should store named tags added through a unit of work', () =>
        should(pairs(stored.get('transactional')!.context)).deep.equal(['unit=u-1']));
    it('should deliver the named tags to reactors in the event context', () => {
        should(pairs(delivered.get('single')!)).deep.equal(['import-batch=b-1', 'import-batch=B-1', 'empty=']);
        should(pairs(delivered.get('credit')!)).deep.equal(['side=credit', 'transfer=t-1']);
        should(pairs(delivered.get('untagged')!)).deep.equal([]);
    });
});
