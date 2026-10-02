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

// Without root all-event subscription, the shared All block needs a root From entry
// for ChildAdded as well as the child's creating entry.
@fromEvent(Started)
@fromEvent(ChildAdded)
class ChildOnlyMappings {
    @field(String) lastValue = '';
    @field(Array, { genericArguments: [AllMappedChild] }) @childrenFrom(ChildAdded, 'childId') children: AllMappedChild[] = [];
}

const artifacts: IClientArtifactsProvider = {
    eventTypes: [Started, ChildAdded, Unrelated],
    readModels: [AllOnly, AllWithChildren, RestrictedWithChildren, AllWithChildMappings, ChildOnlyMappings],
    projections: [], reactors: [], reducers: [], seeders: [], constraints: [], webhooks: [],
    eventTypeMigrations: [], globalForHandlers: []
};

async function eventually<T>(read: () => Promise<T>, accept: (value: T) => boolean): Promise<T> {
    const deadline = Date.now() + 20_000;
    let value = await read();
    while (!accept(value)) {
        if (Date.now() > deadline) {
            const state = JSON.stringify(value, (_key, member: unknown) => typeof member === 'bigint' ? member.toString() : member);
            throw new Error(`Timed out waiting for the projected state: ${state}`);
        }
        await new Promise(resolve => setTimeout(resolve, 100));
        value = await read();
    }
    return value;
}

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
    let childOnlyAfterChild: ChildOnlyMappings | null;
    let childOnlyAfterUnrelated: ChildOnlyMappings | null;
    let unrelatedChildOnly: ChildOnlyMappings | null;

    async function append(source: string, event: object): Promise<bigint> {
        const result = await store.eventLog.append(source, event);
        result.isSuccess.should.be.true;
        return result.sequenceNumber.value;
    }

    async function waitForObserver(observerId: string, sequenceNumber: bigint): Promise<void> {
        const connection = (store as unknown as { _connection: ChronicleConnection })._connection;
        await eventually(() => connection.observers.getObserverInformation({
            EventStore: storeName,
            Namespace: 'Default',
            ObserverId: observerId,
            EventSequenceId: 'event-log'
        }), observer => observer.IsSubscribed && observer.RunningState === ObserverRunningState.Active &&
            observer.LastHandledEventSequenceNumber >= sequenceNumber);
    }

    beforeAll(async () => {
        client = new ChronicleClient(ChronicleOptions.fromConnectionString(connectionString!, {
            discoveryPatterns: [], clientArtifactsProvider: artifacts
        }));
        store = await client.getEventStore(storeName);

        await append(knownSource, Object.assign(new Started(), { value: 'started' }));
        allAfterStarted = await eventually(() => store.readModels.findInstanceById(AllWithChildren, knownSource), model => model?.lastValue === 'started');
        await eventually(() => store.readModels.findInstanceById(RestrictedWithChildren, knownSource), model => model?.lastValue === 'started');
        await append(knownSource, Object.assign(new ChildAdded(), { childId: 'child-one', value: 'child-value' }));
        allAfterChild = await eventually(() => store.readModels.findInstanceById(AllWithChildren, knownSource), model => model?.children?.length === 1);
        restrictedAfterChild = await eventually(() => store.readModels.findInstanceById(RestrictedWithChildren, knownSource), model => model?.children?.length === 1);
        childOnlyAfterChild = await eventually(() => store.readModels.findInstanceById(ChildOnlyMappings, knownSource), model => model?.children?.length === 1);
        allChildMappingsAfterChild = await eventually(() => store.readModels.findInstanceById(AllWithChildMappings, knownSource), model => model?.children?.length === 1);

        await append(knownSource, Object.assign(new Unrelated(), { marker: 'no-value' }));
        allAfterUnrelated = await eventually(() => store.readModels.findInstanceById(AllWithChildren, knownSource),
            model => model !== null && (model.lastValue === null || model.lastValue === undefined));

        await append(unrelatedSource, Object.assign(new Unrelated(), { marker: 'new-source' }));
        allOnly = await eventually(() => store.readModels.findInstanceById(AllOnly, unrelatedSource), model => model !== null);
        unrelatedAll = await eventually(() => store.readModels.findInstanceById(AllWithChildren, unrelatedSource), model => model !== null);
        // A subscribed sentinel advances each restricted observer past both unrelated events.
        // Progress on an all-event projection is not a barrier for another observer.
        const sentinelSequenceNumber = await append(sentinelSource, Object.assign(new Started(), { value: 'sentinel' }));
        await waitForObserver('RestrictedWithChildren', sentinelSequenceNumber);
        await waitForObserver('ChildOnlyMappings', sentinelSequenceNumber);
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
    it('should apply the root all-event mapping to a child', () => {
        allAfterChild!.children.should.have.lengthOf(1);
        allAfterChild!.children[0].id.should.equal('child-one');
        allAfterChild!.children[0].lastValue.should.equal('child-value');
    });
    it('should not propagate the deprecated restricted alias mapping to children', () => {
        restrictedAfterChild!.children.should.have.lengthOf(1);
        (restrictedAfterChild!.children[0].lastValue !== 'child-value').should.be.true;
    });
    it('should clear the mapped root property on an unrelated event without that value', () => {
        (allAfterUnrelated!.lastValue === null || allAfterUnrelated!.lastValue === undefined).should.be.true;
    });
    it('should leave the restricted alias unchanged on an unrelated event', () => restrictedAfterUnrelated!.lastValue.should.equal(restrictedAfterChild!.lastValue));
    it('should apply a child-declared all-event mapping through the shared root All block', () => {
        allChildMappingsAfterChild!.children[0].lastValue.should.equal('child-value');
        // The child event's key routes the all-event fallback to the child, not the root.
        allChildMappingsAfterChild!.lastValue.should.equal('started');
    });
    it('should keep the root subscription restricted when only the child declares fromAllEvents', () => {
        childOnlyAfterChild!.lastValue.should.equal('child-value');
        childOnlyAfterUnrelated!.lastValue.should.equal('child-value');
        (unrelatedChildOnly === null).should.be.true;
    });
});
