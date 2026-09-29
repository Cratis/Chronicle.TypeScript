// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, chai, describe, it } from 'vitest';
import { field } from '@cratis/fundamentals';
import { ChronicleClient } from '../../../../ChronicleClient.js';
import { ChronicleOptions } from '../../../../ChronicleOptions.js';
import type { IClientArtifactsProvider } from '../../../../artifacts/index.js';
import type { AppendResult } from '../../../../eventSequences/index.js';
import type { IEventStore } from '../../../../IEventStore.js';
import { eventType } from '../../../eventTypeDecorator.js';
import { constraint } from '../../constraint.js';
import type { IConstraint } from '../../IConstraint.js';
import type { IConstraintBuilder } from '../../IConstraintBuilder.js';
import { unique } from '../../unique.js';

chai.should();

// Runs against a real Chronicle kernel; skipped locally unless the connection string is set (see vitest.integration.config.ts).
// In CI it never skips, so a missing connection string or unreachable kernel fails instead of passing vacuously.
const connectionString = process.env.CHRONICLE_INTEGRATION_CONNECTION_STRING;

const constraintName = 'UniqueUserName';
const constraintMessage = 'The user name is already taken';

@eventType()
class UserRegistered {
    @field(String) userName = '';
}

@eventType()
class UserRemoved {
    @field(String) userName = '';
}

@eventType()
@unique('OneAccountPerUser', 'The user already has an account')
class AccountOpened {
    @field(String) accountName = '';
}

@constraint(constraintName)
class UniqueUserName implements IConstraint {
    define(builder: IConstraintBuilder): void {
        builder.unique(_ => _
            .on(UserRegistered, e => e.userName)
            .removedWith(UserRemoved)
            .withMessage(constraintMessage));
    }
}

const artifacts: IClientArtifactsProvider = {
    eventTypes: [UserRegistered, UserRemoved, AccountOpened],
    readModels: [],
    reactors: [],
    reducers: [],
    seeders: [],
    constraints: [UniqueUserName],
    projections: [],
    webhooks: [],
    eventTypeMigrations: [],
    globalForHandlers: []
};

const registered = (userName: string) => Object.assign(new UserRegistered(), { userName });
const opened = (accountName: string) => Object.assign(new AccountOpened(), { accountName });
const createClient = () => new ChronicleClient(ChronicleOptions.fromConnectionString(connectionString!, {
    discoveryPatterns: [],
    clientArtifactsProvider: artifacts
}));

function shouldHaveExactlyOneWinner(results: AppendResult[], name: string, message: string) {
    results.filter(_ => _.isSuccess).length.should.equal(1);
    const losers = results.filter(_ => !_.isSuccess);
    losers.length.should.equal(results.length - 1);
    for (const loser of losers) {
        loser.constraintViolations.length.should.equal(1);
        loser.constraintViolations[0].constraintId.should.equal(name);
        loser.constraintViolations[0].message.should.equal(message);
    }
}

describe.skipIf(!connectionString && !process.env.CI)('when appending unique values concurrently against a kernel', () => {
    const storeName = `Unique${randomUUID().replaceAll('-', '').slice(0, 12)}`;
    let first: ChronicleClient;
    let second: ChronicleClient;
    let store: IEventStore;
    let otherClientStore: IEventStore;

    beforeAll(async () => {
        first = createClient();
        second = createClient();
        store = await first.getEventStore(storeName);
        otherClientStore = await second.getEventStore(storeName);
    });

    afterAll(() => {
        first?.dispose();
        second?.dispose();
    });

    it('lets exactly one of two clients claim the same value on different event sources', async () => {
        const results = await Promise.all([
            store.eventLog.append(randomUUID(), registered('alice')),
            otherClientStore.eventLog.append(randomUUID(), registered('alice'))
        ]);
        shouldHaveExactlyOneWinner(results, constraintName, constraintMessage);
    });

    it('lets exactly one of many parallel appends claim the same value', async () => {
        const results = await Promise.all(Array.from({ length: 10 }, () => store.eventLog.append(randomUUID(), registered('bob'))));
        shouldHaveExactlyOneWinner(results, constraintName, constraintMessage);
    });

    it('lets exactly one of two parallel appends open an account on the same event source', async () => {
        const eventSourceId = randomUUID();
        const results = await Promise.all([
            store.eventLog.append(eventSourceId, opened('checking')),
            otherClientStore.eventLog.append(eventSourceId, opened('savings'))
        ]);
        shouldHaveExactlyOneWinner(results, 'OneAccountPerUser', 'The user already has an account');
    });

    it('lets parallel appends open accounts on separate event sources', async () => {
        const results = await Promise.all([
            store.eventLog.append(randomUUID(), opened('checking')),
            otherClientStore.eventLog.append(randomUUID(), opened('checking'))
        ]);
        results.every(_ => _.isSuccess).should.be.true;
    });

    it('lets the same value be claimed once in each namespace', async () => {
        const [tenantA, tenantB] = await Promise.all([
            first.getEventStore(storeName, `a${randomUUID().slice(0, 8)}`),
            second.getEventStore(storeName, `b${randomUUID().slice(0, 8)}`)
        ]);
        const results = await Promise.all([
            tenantA.eventLog.append(randomUUID(), registered('carol')),
            tenantB.eventLog.append(randomUUID(), registered('carol'))
        ]);
        results.every(_ => _.isSuccess).should.be.true;
    });

    it('lets a released value be claimed again', async () => {
        const owner = randomUUID();
        (await store.eventLog.append(owner, registered('dave'))).isSuccess.should.be.true;
        (await otherClientStore.eventLog.append(randomUUID(), registered('dave'))).isSuccess.should.be.false;

        (await store.eventLog.append(owner, Object.assign(new UserRemoved(), { userName: 'dave' }))).isSuccess.should.be.true;

        const results = await Promise.all([
            store.eventLog.append(randomUUID(), registered('dave')),
            otherClientStore.eventLog.append(randomUUID(), registered('dave'))
        ]);
        shouldHaveExactlyOneWinner(results, constraintName, constraintMessage);
    });

    it('commits no part of a batch that loses a race', async () => {
        const batchSource = randomUUID();
        const singleSource = randomUUID();
        const [batch, single] = await Promise.all([
            store.eventLog.appendMany([
                { eventSourceId: batchSource, event: registered(`erin-${batchSource}`) },
                { eventSourceId: batchSource, event: registered('erin') }
            ]),
            otherClientStore.eventLog.append(singleSource, registered('erin'))
        ]);

        const batchSucceeded = batch.every(_ => _.isSuccess);
        batchSucceeded.should.not.equal(single.isSuccess);

        const committed = await store.eventLog.getForEventSourceIdAndEventTypes(batchSource, [UserRegistered]);
        committed.length.should.equal(batchSucceeded ? 2 : 0);
    });

    it('rejects a batch where two event sources claim the same value without committing any of it', async () => {
        const firstSource = randomUUID();
        const secondSource = randomUUID();
        const results = await store.eventLog.appendMany([
            { eventSourceId: firstSource, event: registered('frank') },
            { eventSourceId: secondSource, event: registered('frank') }
        ]);
        results.some(_ => !_.isSuccess).should.be.true;
        (await store.eventLog.getForEventSourceIdAndEventTypes(firstSource, [UserRegistered])).length.should.equal(0);
        (await store.eventLog.getForEventSourceIdAndEventTypes(secondSource, [UserRegistered])).length.should.equal(0);
        (await store.eventLog.append(randomUUID(), registered('frank'))).isSuccess.should.be.true;
    });
});
