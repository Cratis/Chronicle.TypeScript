// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { field } from '@cratis/fundamentals';
import type { ChronicleClient } from '../../../../ChronicleClient.js';
import type { IEventStore } from '../../../../IEventStore.js';
import { eventType } from '../../../index.js';
import { reactor } from '../../../../reactors/index.js';
import { eventTypeMigration } from '../../eventTypeMigration.js';
import type { IEventMigrationBuilder } from '../../IEventMigrationBuilder.js';
import type { IEventTypeMigration } from '../../IEventTypeMigration.js';
import { connectionString, valueMappingClient } from './given/value_mapping_client.js';

// Runtime contract: cratis/chronicle:19.37.4-development, pinned by CI.
const eventTypeId = 'integration-value-map-upcast';
enum LegacyStatus { Open, Closed }

class LegacyDetails {
    @field(Number) status = LegacyStatus.Open;
    @field(String) fullName = 'Ada Lovelace';
    @field(String) prefix = 'Dr';
}

class Details {
    @field(String) status = '';
    @field(String) note = '';
    @field(String) firstName = '';
    @field(String) lastName = '';
    @field(String) displayName = '';
    @field(String) alias = '';
}

@eventType(eventTypeId, 1)
class LegacyStatusRecorded {
    @field(Number) status = LegacyStatus.Open;
    @field(Number) unmappedCode = 99;
    @field(String) statusName = 'existing';
    @field(LegacyDetails) details = new LegacyDetails();
    // Kernel 19.37.4 compares object JSON text; the mapping must use this property order.
    @field(Object) payload = { code: 'old', active: true };
    @field(Boolean) flag = false;
}

@eventType(eventTypeId, 2)
class StatusRecorded {
    @field(String) statusName = '';
    @field(Number) unmappedCode = 0;
    @field(Details) details = new Details();
    @field(Object) payload = {};
    @field(Boolean) flag = false;
}

@eventTypeMigration(StatusRecorded, LegacyStatusRecorded)
class StatusValueMigration implements IEventTypeMigration<StatusRecorded, LegacyStatusRecorded> {
    upcast(builder: IEventMigrationBuilder<StatusRecorded, LegacyStatusRecorded>): void {
        builder.properties(properties => properties
            .mapValues('statusName', 'status', [
                { from: LegacyStatus.Open, to: 'open' }, { from: LegacyStatus.Closed, to: 'closed' }
            ])
            .mapValues('unmappedCode', 'unmappedCode', [{ from: 0, to: 10 }])
            .mapValues('details.status', 'details.status', [{ from: LegacyStatus.Open, to: 'open' }])
            .mapValues('payload', 'payload', [{ from: { code: 'old', active: true }, to: { code: 'new' } }])
            .mapValues('flag', 'flag', [{ from: false, to: true }])
            .defaultValue('details.note', 'default-note')
            .split('details.firstName', 'details.fullName', ' ', 0)
            .split('details.lastName', 'details.fullName', ' ', 1)
            .combine('details.displayName', ' ', 'details.prefix', 'details.fullName')
            .renamedFrom('details.alias', 'details.fullName'));
    }
    downcast(_builder: IEventMigrationBuilder<LegacyStatusRecorded, StatusRecorded>): void {}
}

const observed: StatusRecorded[] = [];

@reactor('integration-value-map-replay')
class StatusReplay {
    statusRecorded(event: StatusRecorded): void {
        observed.push(event);
    }
}

// Never skip in CI: a missing connection string must fail rather than pass vacuously.
describe.skipIf(!connectionString && !process.env.CI)('when replaying value mapped events against the pinned kernel', () => {
    const sourceValues = [LegacyStatus.Open, LegacyStatus.Closed];
    const clients: ChronicleClient[] = [];
    const storeName = `ValueMaps${randomUUID().replaceAll('-', '')}`;
    const sourceId = randomUUID();
    const migrations = { eventTypes: [LegacyStatusRecorded, StatusRecorded], eventTypeMigrations: [StatusValueMigration] };
    let store: IEventStore;

    beforeAll(async () => {
        const writer = valueMappingClient({ eventTypes: [LegacyStatusRecorded] });
        clients.push(writer);
        const oldStore = await writer.getEventStore(storeName);
        const sourceEvents = sourceValues.map(status => Object.assign(new LegacyStatusRecorded(), { status }));
        for (const event of sourceEvents) {
            expect((await oldStore.eventLog.append(sourceId, event)).isSuccess).toBe(true);
        }
        const history = await oldStore.eventLog.getForEventSourceIdAndEventTypes(sourceId, [LegacyStatusRecorded]);
        expect(history.map(event => event.content)).toEqual(JSON.parse(JSON.stringify(sourceEvents)));
        const migrator = valueMappingClient(migrations);
        clients.push(migrator);
        store = await migrator.getEventStore(storeName);
    }, 60_000);

    afterAll(() => clients.forEach(client => client.dispose()));

    it('should replay value maps and nested transformations from stored history', async () => {
        // The read returns the highest stored generation, not one selected by the constructor.
        // Wait for the background job to store generation 2 before replaying the history.
        await expect.poll(async () => {
            const events = await store.eventLog.getForEventSourceIdAndEventTypes(sourceId, [StatusRecorded]);
            return events.map(event => ({
                generation: event.context.eventType.generation.value,
                payload: (event.content as unknown as StatusRecorded).payload,
                status: (event.content as unknown as StatusRecorded).details?.status
            }));
        }, { timeout: 20_000 }).toEqual(sourceValues.map(() => ({ generation: 2, payload: { code: 'new' }, status: 'open' })));
        const reader = valueMappingClient({ ...migrations, reactors: [StatusReplay] });
        clients.push(reader);
        await reader.getEventStore(storeName);
        await expect.poll(() => observed.length, { timeout: 20_000 }).toBe(sourceValues.length);
        expect(observed.map(event => event.statusName)).toEqual(['open', 'closed']);
        expect(observed.map(event => event.unmappedCode)).toEqual([99, 99]);
        expect(observed.map(event => event.payload)).toEqual(sourceValues.map(() => ({ code: 'new' })));
        expect(observed.every(event => event.flag === true)).toBe(true);
        expect(observed.map(event => event.details.status)).toEqual(sourceValues.map(() => 'open'));
        expect(observed.map(event => event.details.note)).toEqual(sourceValues.map(() => 'default-note'));
        for (const event of observed) {
            expect(event.details).toMatchObject({ firstName: 'Ada', lastName: 'Lovelace', displayName: 'Dr Ada Lovelace', alias: 'Ada Lovelace' });
            expect(Object.keys(event).some(key => key.includes('.'))).toBe(false);
        }
    }, 60_000);
});
