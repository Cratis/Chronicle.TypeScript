// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { field } from '@cratis/fundamentals';
import type { ChronicleClient } from '../../../../ChronicleClient.js';
import { ChronicleConnection } from '../../../../connection/ChronicleConnection.js';
import { ensureQuerySuccess } from '../../../../connection/callResults.js';
import { eventType } from '../../../index.js';
import { eventTypeMigration } from '../../eventTypeMigration.js';
import type { IEventMigrationBuilder } from '../../IEventMigrationBuilder.js';
import type { IEventTypeMigration } from '../../IEventTypeMigration.js';
import { connectionString, valueMappingClient } from './given/value_mapping_client.js';

// Runtime contract: cratis/chronicle:19.37.4-development, pinned by CI.
const eventTypeId = 'integration-value-map-downcast';
enum LegacyStatus { Open, Closed }

@eventType(eventTypeId, 1)
class LegacyStatusRecorded {
    @field(Number) status = LegacyStatus.Open;
}

@eventType(eventTypeId, 2)
class StatusRecorded {
    @field(String) status = '';
}

@eventTypeMigration(StatusRecorded, LegacyStatusRecorded)
class StatusValueMigration implements IEventTypeMigration<StatusRecorded, LegacyStatusRecorded> {
    upcast(_builder: IEventMigrationBuilder<StatusRecorded, LegacyStatusRecorded>): void {}
    downcast(builder: IEventMigrationBuilder<LegacyStatusRecorded, StatusRecorded>): void {
        builder.properties(properties => properties.mapValues('status', 'status', [
            { from: 'open', to: LegacyStatus.Open }, { from: 'closed', to: LegacyStatus.Closed }
        ]));
    }
}

// Never skip in CI: a missing connection string must fail rather than pass vacuously.
describe.skipIf(!connectionString && !process.env.CI)('when downcasting value mapped events against the pinned kernel', () => {
    let client: ChronicleClient;
    let probe: ChronicleConnection;
    let olderGeneration: unknown;
    let appendedGeneration: unknown;

    beforeAll(async () => {
        client = valueMappingClient({
            eventTypes: [LegacyStatusRecorded, StatusRecorded], eventTypeMigrations: [StatusValueMigration]
        });
        const store = await client.getEventStore(`Downcast${randomUUID().replaceAll('-', '')}`);
        const sourceId = randomUUID();
        const result = await store.eventLog.append(sourceId, Object.assign(new StatusRecorded(), { status: 'closed' }));
        expect(result.isSuccess).toBe(true);

        // The public read exposes Content only. Inspect the kernel's stored generation 1
        // explicitly through the pinned contract, not the append echo or latest Content.
        probe = new ChronicleConnection({ connectionString: connectionString! });
        await probe.connect();
        const response = await probe.eventSequences.forEventSourceIdAndEventTypes({
            EventStore: store.name.value, Namespace: store.namespace.value, EventSequenceId: store.eventLog.id.value,
            EventSourceId: sourceId, EventTypeIds: eventTypeId,
            EventStreamType: '', EventStreamId: '', EventSourceType: ''
        });
        const events = ensureQuerySuccess('read downcast generation', response);
        expect(events).toHaveLength(1);
        const first = events[0].GenerationalContent.find(content => content.Key === 1);
        const second = events[0].GenerationalContent.find(content => content.Key === 2);
        expect(first).toBeDefined();
        expect(second).toBeDefined();
        olderGeneration = JSON.parse(first!.Value);
        appendedGeneration = JSON.parse(second!.Value);
    }, 45_000);

    afterAll(() => {
        probe?.disconnect();
        client?.dispose();
    });

    it('should store the explicitly mapped numeric value for the older generation', () => {
        expect(olderGeneration).toEqual({ status: LegacyStatus.Closed });
    });
    it('should retain the string value in the appended generation', () => {
        expect(appendedGeneration).toEqual({ status: 'closed' });
    });
});
