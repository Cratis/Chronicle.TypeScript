// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, chai, describe, it, vi } from 'vitest';
import { field, type Constructor } from '@cratis/fundamentals';
import { ChronicleClient } from '../../../ChronicleClient.js';
import { ChronicleOptions } from '../../../ChronicleOptions.js';
import type { IClientArtifactsProvider } from '../../../artifacts/index.js';
import type { IEventStore } from '../../../IEventStore.js';
import { eventType, type EventContext } from '../../../events/index.js';
import { eventTypeMigration, type IEventMigrationBuilder, type IEventTypeMigration } from '../../../events/migrations/index.js';
import { EventGenerationDelivery } from '../../../observation/index.js';
import { readModel } from '../../../readModels/index.js';
import { reducer } from '../../../reducers/reducer.js';

chai.should();

// Runtime contract: cratis/chronicle:19.188.0-development, pinned by CI.
const eventTypeId = 'integration-pinned-generation';

@eventType(eventTypeId, 1)
class LegacyNameRecorded {
    @field(String) legacyName = '';
}

@eventType(eventTypeId, 2)
class NameRecorded {
    @field(String) name = '';
}

@eventTypeMigration(NameRecorded, LegacyNameRecorded)
class NameMigration implements IEventTypeMigration<NameRecorded, LegacyNameRecorded> {
    upcast(builder: IEventMigrationBuilder<NameRecorded, LegacyNameRecorded>): void {
        builder.properties(properties => properties.renamedFrom('name', 'legacyName'));
    }
    downcast(builder: IEventMigrationBuilder<LegacyNameRecorded, NameRecorded>): void {
        builder.properties(properties => properties.renamedFrom('legacyName', 'name'));
    }
}

type Delivery = { content: LegacyNameRecorded; context: EventContext };
const reducedDeliveries: Delivery[] = [];

@readModel()
class PinnedName {
    @field(String) legacyName = '';
}

@reducer('pinned-generation-reducer', undefined, PinnedName, true, EventGenerationDelivery.Pinned)
class PinnedNameReducer {
    legacyNameRecorded(content: LegacyNameRecorded, _state: PinnedName | undefined, context: EventContext): PinnedName {
        reducedDeliveries.push({ content, context });
        return Object.assign(new PinnedName(), { legacyName: content.legacyName });
    }
}

function assertDelivery(delivery: Delivery): void {
    JSON.parse(JSON.stringify(delivery.content)).should.deep.equal({ legacyName: 'Ada' });
    delivery.context.eventType.generation.value.should.equal(1);
    delivery.context.appendedGeneration!.value.should.equal(2);
}

const connectionString = process.env.CHRONICLE_INTEGRATION_CONNECTION_STRING;

// Never skip in CI: absent configuration must fail, not pass vacuously.
describe.skipIf(!connectionString && !process.env.CI)('when delivering released content in a pinned generation', () => {
    const clients: ChronicleClient[] = [];
    const deliveries: Delivery[] = [];
    const storeName = `PinnedGeneration${randomUUID().replaceAll('-', '')}`;
    const source = randomUUID();
    let compatibilityDeliveries = 0;
    let reader: IEventStore;

    function client(eventTypes: Constructor[], eventTypeMigrations: Constructor[] = [], withReducer = false): ChronicleClient {
        const artifacts: IClientArtifactsProvider = {
            eventTypes, eventTypeMigrations, readModels: withReducer ? [PinnedName] : [],
            reactors: [], reducers: withReducer ? [PinnedNameReducer] : [], seeders: [],
            constraints: [], projections: [], webhooks: [], globalForHandlers: []
        };
        const result = new ChronicleClient(ChronicleOptions.fromConnectionString(connectionString!, {
            discoveryPatterns: [], clientArtifactsProvider: artifacts
        }));
        clients.push(result);
        return result;
    }

    beforeAll(async () => {
        const writer = await client([LegacyNameRecorded, NameRecorded], [NameMigration]).getEventStore(storeName);
        reader = await client([LegacyNameRecorded], [], true).getEventStore(storeName);
        await reader.reactors.register('pinned-generation', builder => builder
            .on(LegacyNameRecorded, (content, context) => { deliveries.push({ content, context }); })
            .withEventGenerationDelivery(EventGenerationDelivery.Pinned));
        await reader.reactors.register('compatibility-control', builder => builder
            .on(LegacyNameRecorded, () => { compatibilityDeliveries++; }));
        await reader.reactors.waitTillSubscribed('pinned-generation', { timeout: 30_000 });
        await reader.reactors.waitTillSubscribed('compatibility-control', { timeout: 30_000 });
        await vi.waitFor(async () => (await reader.reducers.getStateFor(PinnedNameReducer)).isSubscribed.should.be.true,
            { timeout: 30_000 });
        const result = await writer.eventLog.append(source, Object.assign(new NameRecorded(), { name: 'Ada' }));
        result.isSuccess.should.be.true;
        await vi.waitFor(() => [deliveries.length, reducedDeliveries.length, compatibilityDeliveries].should.deep.equal([1, 1, 1]),
            { timeout: 30_000 });
        await vi.waitFor(async () => (await reader.readModels.getInstanceById(PinnedName, source)).legacyName.should.equal('Ada'),
            { timeout: 30_000 });
    }, 60_000);

    afterAll(() => clients.forEach(client => client.dispose()));

    it('should preserve the original appended generation while delivering generation one live and on replay', async () => {
        assertDelivery(deliveries[0]);
        assertDelivery(reducedDeliveries[0]);
        await reader.reactors.waitTillSubscribed('pinned-generation');
        (await reader.reactors.replay('pinned-generation')).started.should.be.true;
        (await reader.reducers.replay(PinnedNameReducer)).started.should.be.true;
        await vi.waitFor(() => [deliveries.length, reducedDeliveries.length].should.deep.equal([2, 2]), { timeout: 30_000 });
        assertDelivery(deliveries[1]);
        assertDelivery(reducedDeliveries[1]);
    }, 60_000);
});
