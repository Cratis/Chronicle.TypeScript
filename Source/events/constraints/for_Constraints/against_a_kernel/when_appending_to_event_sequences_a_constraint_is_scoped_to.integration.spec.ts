// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, chai, describe, it } from 'vitest';
import { field } from '@cratis/fundamentals';
import { ChronicleClient } from '../../../../ChronicleClient.js';
import { ChronicleOptions } from '../../../../ChronicleOptions.js';
import type { IClientArtifactsProvider } from '../../../../artifacts/index.js';
import { EventSequenceId } from '../../../../eventSequences/EventSequenceId.js';
import type { IEventSequence } from '../../../../eventSequences/IEventSequence.js';
import type { IEventStore } from '../../../../IEventStore.js';
import { eventType } from '../../../eventTypeDecorator.js';
import { constraint } from '../../constraint.js';
import type { IConstraint } from '../../IConstraint.js';
import type { IConstraintBuilder } from '../../IConstraintBuilder.js';
import { unique } from '../../unique.js';

chai.should();

// Runs against a real Chronicle kernel; skipped locally unless the connection string is set (see vitest.integration.config.ts).
const connectionString = process.env.CHRONICLE_INTEGRATION_CONNECTION_STRING;

@eventType()
class HandleClaimed {
    @field(String) handle = '';
}

@eventType()
class NicknameClaimed {
    @field(String) nickname = '';
}

@eventType()
@unique({ name: 'OneProfilePerUser', eventSequences: [EventSequenceId.eventLog] })
class ProfileCreated {
    @field(String) label = '';
}

@constraint('UniqueHandleOnEventLog')
class UniqueHandleOnEventLog implements IConstraint {
    define(builder: IConstraintBuilder): void {
        builder.forEventLog().unique(_ => _.on(HandleClaimed, e => e.handle));
    }
}

@constraint('UniqueNicknameEverywhere')
class UniqueNicknameEverywhere implements IConstraint {
    define(builder: IConstraintBuilder): void {
        builder.unique(_ => _.on(NicknameClaimed, e => e.nickname));
    }
}

const artifacts: IClientArtifactsProvider = {
    eventTypes: [HandleClaimed, NicknameClaimed, ProfileCreated],
    readModels: [],
    reactors: [],
    reducers: [],
    seeders: [],
    constraints: [UniqueHandleOnEventLog, UniqueNicknameEverywhere],
    projections: [],
    webhooks: [],
    eventTypeMigrations: [],
    globalForHandlers: []
};

const handle = (value: string) => Object.assign(new HandleClaimed(), { handle: value });
const nickname = (value: string) => Object.assign(new NicknameClaimed(), { nickname: value });

describe.skipIf(!connectionString && !process.env.CI)('when appending to event sequences a constraint is scoped to against a kernel', () => {
    const storeName = `Sequenced${randomUUID().replaceAll('-', '').slice(0, 12)}`;
    let client: ChronicleClient;
    let store: IEventStore;
    let outbox: IEventSequence;

    beforeAll(async () => {
        client = new ChronicleClient(ChronicleOptions.fromConnectionString(connectionString!, {
            discoveryPatterns: [],
            clientArtifactsProvider: artifacts
        }));
        store = await client.getEventStore(storeName);
        outbox = store.getEventSequence(new EventSequenceId('outbox'));
    });

    afterAll(() => client?.dispose());

    it('validates an event-log constraint on the event log', async () => {
        (await store.eventLog.append(randomUUID(), handle('ada'))).isSuccess.should.be.true;
        const rejected = await store.eventLog.append(randomUUID(), handle('ada'));
        rejected.isSuccess.should.be.false;
        rejected.constraintViolations[0].constraintId.should.equal('UniqueHandleOnEventLog');
    });

    it('neither validates nor claims an event-log constraint in the outbox', async () => {
        (await store.eventLog.append(randomUUID(), handle('grace'))).isSuccess.should.be.true;
        (await outbox.append(randomUUID(), handle('grace'))).isSuccess.should.be.true;
        (await outbox.append(randomUUID(), handle('grace'))).isSuccess.should.be.true;
    });

    it('keeps a forwarded value from claiming the event-log value', async () => {
        (await outbox.append(randomUUID(), handle('linus'))).isSuccess.should.be.true;
        (await store.eventLog.append(randomUUID(), handle('linus'))).isSuccess.should.be.true;
    });

    it('validates a decorated event-log constraint only on the event log', async () => {
        const source = randomUUID();
        (await store.eventLog.append(source, new ProfileCreated())).isSuccess.should.be.true;
        (await store.eventLog.append(source, new ProfileCreated())).isSuccess.should.be.false;
        (await outbox.append(source, new ProfileCreated())).isSuccess.should.be.true;
        (await outbox.append(source, new ProfileCreated())).isSuccess.should.be.true;
    });

    it('validates an unscoped constraint in the outbox against its own index', async () => {
        (await store.eventLog.append(randomUUID(), nickname('margaret'))).isSuccess.should.be.true;
        (await outbox.append(randomUUID(), nickname('margaret'))).isSuccess.should.be.true;
        (await outbox.append(randomUUID(), nickname('margaret'))).isSuccess.should.be.false;
    });
});
