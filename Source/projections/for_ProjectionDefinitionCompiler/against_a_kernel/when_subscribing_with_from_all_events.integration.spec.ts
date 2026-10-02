// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { randomUUID } from 'node:crypto';
import { field } from '@cratis/fundamentals';
import { afterAll, beforeAll, chai, describe, it } from 'vitest';
import { ChronicleClient } from '../../../ChronicleClient.js';
import { ChronicleOptions } from '../../../ChronicleOptions.js';
import type { IClientArtifactsProvider } from '../../../artifacts/index.js';
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

const artifacts: IClientArtifactsProvider = {
    eventTypes: [Started, ChildAdded, Unrelated],
    readModels: [AllOnly, AllWithChildren, RestrictedWithChildren],
    projections: [], reactors: [], reducers: [], seeders: [], constraints: [], webhooks: [],
    eventTypeMigrations: [], globalForHandlers: []
};

async function eventually<T>(read: () => Promise<T>, accept: (value: T) => boolean): Promise<T> {
    const deadline = Date.now() + 20_000;
    let value = await read();
    while (!accept(value)) {
        if (Date.now() > deadline) throw new Error(`Timed out waiting for the projected state: ${JSON.stringify(value)}`);
        await new Promise(resolve => setTimeout(resolve, 100));
        value = await read();
    }
    return value;
}

describe.skipIf(!connectionString && !process.env.CI)('when opting into fromAllEvents against a kernel', () => {
    const knownSource = randomUUID();
    const unrelatedSource = randomUUID();
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

    async function append(source: string, event: object): Promise<void> {
        const result = await store.eventLog.append(source, event);
        result.isSuccess.should.be.true;
    }

    beforeAll(async () => {
        client = new ChronicleClient(ChronicleOptions.fromConnectionString(connectionString!, {
            discoveryPatterns: [], clientArtifactsProvider: artifacts
        }));
        store = await client.getEventStore(`AllEvents${randomUUID().replaceAll('-', '').slice(0, 12)}`);

        await append(knownSource, Object.assign(new Started(), { value: 'started' }));
        allAfterStarted = await eventually(() => store.readModels.findInstanceById(AllWithChildren, knownSource), model => model?.lastValue === 'started');
        await eventually(() => store.readModels.findInstanceById(RestrictedWithChildren, knownSource), model => model?.lastValue === 'started');
        await append(knownSource, Object.assign(new ChildAdded(), { childId: 'child-one', value: 'child-value' }));
        allAfterChild = await eventually(() => store.readModels.findInstanceById(AllWithChildren, knownSource), model => model?.children?.length === 1);
        restrictedAfterChild = await eventually(() => store.readModels.findInstanceById(RestrictedWithChildren, knownSource), model => model?.children?.length === 1);

        await append(knownSource, Object.assign(new Unrelated(), { marker: 'no-value' }));
        allAfterUnrelated = await eventually(() => store.readModels.findInstanceById(AllWithChildren, knownSource),
            model => model !== null && (model.lastValue === null || model.lastValue === undefined));
        restrictedAfterUnrelated = await store.readModels.findInstanceById(RestrictedWithChildren, knownSource);

        await append(unrelatedSource, Object.assign(new Unrelated(), { marker: 'new-source' }));
        allOnly = await eventually(() => store.readModels.findInstanceById(AllOnly, unrelatedSource), model => model !== null);
        unrelatedAll = await eventually(() => store.readModels.findInstanceById(AllWithChildren, unrelatedSource), model => model !== null);
        unrelatedRestricted = await store.readModels.findInstanceById(RestrictedWithChildren, unrelatedSource);
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
});
