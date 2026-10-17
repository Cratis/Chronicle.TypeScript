// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { randomUUID } from 'node:crypto';
import { field } from '@cratis/fundamentals';
import { ObserverRunningState } from '@cratis/chronicle.contracts';
import { afterAll, beforeAll, chai, describe, it } from 'vitest';
import { ChronicleClient } from '../../../ChronicleClient.js';
import { ChronicleOptions } from '../../../ChronicleOptions.js';
import type { IClientArtifactsProvider } from '../../../artifacts/index.js';
import type { ChronicleConnection } from '../../../connection/index.js';
import { eventType } from '../../../events/index.js';
import type { IEventStore } from '../../../IEventStore.js';
import { childrenFrom, fromAll, fromAllEvents, fromEvery, fromEvent } from '../../index.js';

chai.should();

const connectionString = process.env.CHRONICLE_INTEGRATION_CONNECTION_STRING;

@eventType()
class Started {
    @field(String) value = '';
}

@eventType()
class ChildAdded {
    @field(String) childId = '';
    @field(String) value = '';
}

@eventType()
class Unrelated {
    @field(String) marker = '';
}

class Child {
    @field(String) id = '';
    @field(String) lastValue = '';
}

class AllOnly {
    @field(String) @fromAllEvents(undefined, 'eventSourceId') source = '';
}

@fromEvent(Started)
class AllWithChildren {
    @field(String) @fromEvery('ignored') @fromAllEvents('value') lastValue = '';
    @field(Array, { genericArguments: [Child] }) @childrenFrom(ChildAdded, 'childId') children: Child[] = [];
}

@fromEvent(Started)
class RestrictedWithChildren {
    @field(String) @fromAll('value') lastValue = '';
    @field(Array, { genericArguments: [Child] }) @childrenFrom(ChildAdded, 'childId') children: Child[] = [];
}

class AllMappedChild {
    @field(String) id = '';
    @field(String) @fromAllEvents('value') lastValue = '';
}

class AllWithChildMappings {
    @field(String) @fromAllEvents(undefined, 'eventSourceId') source = '';
    @field(String) lastValue = '';
    @field(Array, { genericArguments: [AllMappedChild] }) @childrenFrom(ChildAdded, 'childId') children: AllMappedChild[] = [];
}

// The root fromEvery mapping handles ChildAdded only because the root explicitly
// subscribes to it; the child's All mapping belongs to the child independently.
@fromEvent(Started)
@fromEvent(ChildAdded)
class ChildOnlyMappings {
    @field(String) @fromEvery('value') rootValue = '';
    @field(Array, { genericArguments: [AllMappedChild] }) @childrenFrom(ChildAdded, 'childId') children: AllMappedChild[] = [];
}

const artifacts: IClientArtifactsProvider = {
    eventTypes: [Started, ChildAdded, Unrelated],
    readModels: [AllOnly, AllWithChildren, RestrictedWithChildren, AllWithChildMappings, ChildOnlyMappings],
    projections: [], reactors: [], reducers: [], seeders: [], constraints: [], webhooks: [],
    eventTypeMigrations: [], globalForHandlers: []
};

describe.skipIf(!connectionString && !process.env.CI)('when opting into fromAllEvents against a kernel', () => {
    const knownSource = randomUUID();
    const unrelatedSource = randomUUID();
    const sentinelSource = randomUUID();
    const storeName = `AllEvents${randomUUID().replaceAll('-', '').slice(0, 12)}`;
    let client: ChronicleClient;
    let store: IEventStore;
    let allOnly: AllOnly | null;
    let unrelatedAll: AllWithChildren | null;
    let unrelatedRestricted: RestrictedWithChildren | null;
    let allAfterStarted: AllWithChildren | null;
    let allAfterChild: AllWithChildren | null;
    let restrictedAfterChild: RestrictedWithChildren | null;
    let allAfterUnrelated: AllWithChildren | null;
    let restrictedAfterUnrelated: RestrictedWithChildren | null;
    let allChildMappingsAfterChild: AllWithChildMappings | null;
    let allChildMappingsAfterUpdate: AllWithChildMappings | null;
    let childOnlyAfterChild: ChildOnlyMappings | null;
    let childOnlyAfterUnrelated: ChildOnlyMappings | null;
    let unrelatedChildOnly: ChildOnlyMappings | null;

    async function append(source: string, event: object, waitForObservers = true): Promise<bigint> {
        const result = await store.eventLog.append(source, event);
        result.isSuccess.should.be.true;
        if (waitForObservers) {
            const completion = await result.waitForCompletion(20_000);
            completion.isSuccess.should.equal(true, `Observer completion failed: ${JSON.stringify(completion.failedPartitions)}`);
        }
        return result.sequenceNumber.value;
    }

    async function waitForObserver(observerId: string, sequenceNumber: bigint): Promise<void> {
        const connection = (store as unknown as { _connection: ChronicleConnection })._connection;
        const observer = await connection.observers.getObserverInformation({
            EventStore: storeName,
            Namespace: 'Default',
            ObserverId: observerId,
            EventSequenceId: 'event-log'
        }, { signal: AbortSignal.timeout(5_000) });
        observer.IsSubscribed.should.equal(true, `${observerId} must be subscribed`);
        observer.RunningState.should.equal(ObserverRunningState.Active);
        (observer.LastHandledEventSequenceNumber >= sequenceNumber).should.equal(true, `${observerId} must have handled ${sequenceNumber}`);
    }

    beforeAll(async () => {
        client = new ChronicleClient(ChronicleOptions.fromConnectionString(connectionString!, {
            discoveryPatterns: [], clientArtifactsProvider: artifacts
        }));
        store = await client.getEventStore(storeName);

        const startedSequenceNumber = await append(knownSource, Object.assign(new Started(), { value: 'started' }));
        await waitForObserver('AllWithChildren', startedSequenceNumber);
        allAfterStarted = await store.readModels.findInstanceById(AllWithChildren, knownSource);
        const childSequenceNumber = await append(knownSource, Object.assign(new ChildAdded(), { childId: 'child-one', value: 'child-value' }));
        for (const observerId of ['AllWithChildren', 'RestrictedWithChildren', 'ChildOnlyMappings', 'AllWithChildMappings']) {
            await waitForObserver(observerId, childSequenceNumber);
        }
        allAfterChild = await store.readModels.findInstanceById(AllWithChildren, knownSource);
        restrictedAfterChild = await store.readModels.findInstanceById(RestrictedWithChildren, knownSource);
        childOnlyAfterChild = await store.readModels.findInstanceById(ChildOnlyMappings, knownSource);
        allChildMappingsAfterChild = await store.readModels.findInstanceById(AllWithChildMappings, knownSource);

        const updatedSequenceNumber = await append(knownSource, Object.assign(new ChildAdded(), { childId: 'child-one', value: 'updated-child-value' }));
        await waitForObserver('AllWithChildMappings', updatedSequenceNumber);
        allChildMappingsAfterUpdate = await store.readModels.findInstanceById(AllWithChildMappings, knownSource);

        // This client's completion request carries only a global tail, so restricted
        // observers cannot complete an unrelated append until a subscribed sentinel follows.
        await append(knownSource, Object.assign(new Unrelated(), { marker: 'no-value' }), false);
        await append(unrelatedSource, Object.assign(new Unrelated(), { marker: 'new-source' }), false);
        const sentinelSequenceNumber = await append(sentinelSource, Object.assign(new Started(), { value: 'sentinel' }));
        for (const observerId of ['AllOnly', 'AllWithChildren', 'RestrictedWithChildren', 'ChildOnlyMappings']) {
            await waitForObserver(observerId, sentinelSequenceNumber);
        }
        allAfterUnrelated = await store.readModels.findInstanceById(AllWithChildren, knownSource);
        allOnly = await store.readModels.findInstanceById(AllOnly, unrelatedSource);
        unrelatedAll = await store.readModels.findInstanceById(AllWithChildren, unrelatedSource);
        restrictedAfterUnrelated = await store.readModels.findInstanceById(RestrictedWithChildren, knownSource);
        unrelatedRestricted = await store.readModels.findInstanceById(RestrictedWithChildren, unrelatedSource);
        childOnlyAfterUnrelated = await store.readModels.findInstanceById(ChildOnlyMappings, knownSource);
        unrelatedChildOnly = await store.readModels.findInstanceById(ChildOnlyMappings, unrelatedSource);
    });

    afterAll(() => client?.dispose());

    it('should subscribe a model with only fromAllEvents and map event context', () => allOnly!.source.should.equal(unrelatedSource));
    it('should create a row for an unrelated event source only after opting in', () => {
        (unrelatedAll !== null).should.be.true;
        (unrelatedRestricted === null).should.be.true;
    });
    it('should give the explicit all-event mapping precedence over fromEvery', () => allAfterStarted!.lastValue.should.equal('started'));
    it('should update the root on a child event without copying its mapping into the child', () => {
        allAfterChild!.lastValue.should.equal('child-value');
        allAfterChild!.children.should.have.lengthOf(1);
        allAfterChild!.children[0].id.should.equal('child-one');
        allAfterChild!.children[0].lastValue.should.equal('');
    });
    it('should not propagate the deprecated restricted alias mapping to children', () => {
        restrictedAfterChild!.children.should.have.lengthOf(1);
        (restrictedAfterChild!.children[0].lastValue !== 'child-value').should.be.true;
    });
    it('should clear the mapped root property on an unrelated event without that value', () => {
        allAfterUnrelated!.lastValue.should.equal('');
    });
    it('should leave the restricted alias unchanged on an unrelated event', () => restrictedAfterUnrelated!.lastValue.should.equal(restrictedAfterChild!.lastValue));
    it('should apply a child-declared mapping on creation without changing an unmapped same-named root property', () => {
        allChildMappingsAfterChild!.children[0].lastValue.should.equal('child-value');
        allChildMappingsAfterChild!.source.should.equal(knownSource);
        allChildMappingsAfterChild!.lastValue.should.equal('');
    });
    it('should update the existing child through its own All mapping on subsequent child events', () => {
        allChildMappingsAfterUpdate!.children.should.have.lengthOf(1);
        allChildMappingsAfterUpdate!.children[0].lastValue.should.equal('updated-child-value');
        allChildMappingsAfterUpdate!.lastValue.should.equal('');
    });
    it('should keep the root subscription restricted when only the child declares fromAllEvents', () => {
        childOnlyAfterChild!.rootValue.should.equal('child-value');
        childOnlyAfterChild!.children[0].id.should.equal('child-one');
        childOnlyAfterChild!.children[0].lastValue.should.equal('child-value');
        childOnlyAfterUnrelated!.rootValue.should.equal('updated-child-value');
        (unrelatedChildOnly === null).should.be.true;
    });
});
