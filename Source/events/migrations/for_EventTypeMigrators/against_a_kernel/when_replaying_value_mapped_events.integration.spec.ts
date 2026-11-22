// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { field } from '@cratis/fundamentals';
import type { ChronicleClient } from '../../../../ChronicleClient.js';
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
    @field(String) note?: string | null;
    @field(String) fullName = 'Ada Lovelace';
    @field(String) prefix = 'Dr';
}

class Details {
    @field(String) status = '';
    @field(String) note?: string | null;
    @field(String) firstName = '';
    @field(String) lastName = '';
    @field(String) displayName = '';
    @field(String) alias = '';
}

@eventType(eventTypeId, 1)
class LegacyStatusRecorded {
    @field(Number) status?: number | null;
    @field(String) statusName = 'existing';
    @field(LegacyDetails) details = new LegacyDetails();
    @field(Object) payload = { code: 'old', active: true };
    @field(Boolean) flag = false;
}

@eventType(eventTypeId, 2)
class StatusRecorded {
    @field(String) statusName = '';
    @field(Details) details = new Details();
    @field(Object) payload = {};
    @field(Boolean) flag = false;
}

@eventTypeMigration(StatusRecorded, LegacyStatusRecorded)
class StatusValueMigration implements IEventTypeMigration<StatusRecorded, LegacyStatusRecorded> {
    upcast(builder: IEventMigrationBuilder<StatusRecorded, LegacyStatusRecorded>): void {
        builder.properties(properties => properties
            .mapValues('statusName', 'status', [
                { from: LegacyStatus.Open, to: 'open' }, { from: LegacyStatus.Closed, to: 'closed' }, { from: null, to: 'not-set' }
            ])
            .mapValues('details.status', 'details.status', [{ from: LegacyStatus.Open, to: 'open' }])
            .mapValues('payload', 'payload', [{ from: { active: true, code: 'old' }, to: { code: 'new' } }])
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
    const sourceValues = [LegacyStatus.Open, LegacyStatus.Closed, 99, null, undefined];
    const clients: ChronicleClient[] = [];
    const storeName = `ValueMaps${randomUUID().replaceAll('-', '')}`;
    const sourceId = randomUUID();

    beforeAll(async () => {
        const writer = valueMappingClient({ eventTypes: [LegacyStatusRecorded] });
        clients.push(writer);
        const oldStore = await writer.getEventStore(storeName);
        for (const status of sourceValues) {
            const event = Object.assign(new LegacyStatusRecorded(), { status });
            if (status === null) event.details.note = null;
            expect((await oldStore.eventLog.append(sourceId, event)).isSuccess).toBe(true);
        }
        const migrations = { eventTypes: [LegacyStatusRecorded, StatusRecorded], eventTypeMigrations: [StatusValueMigration] };
        const migrator = valueMappingClient(migrations);
        clients.push(migrator);
        const store = await migrator.getEventStore(storeName);
        // Wait for background migration before any observer replays the old history.
        await expect.poll(async () => {
            const events = await store.eventLog.getForEventSourceIdAndEventTypes(sourceId, [StatusRecorded]);
            return events.map(event => (event.content as unknown as StatusRecorded).details?.status);
        }, { timeout: 20_000 }).toEqual(sourceValues.map(() => 'open'));
        const reader = valueMappingClient({ ...migrations, reactors: [StatusReplay] });
        clients.push(reader);
        await reader.getEventStore(storeName);
        await expect.poll(() => observed.length, { timeout: 20_000 }).toBe(sourceValues.length);
    }, 60_000);

    afterAll(() => clients.forEach(client => client.dispose()));

    it('should map serialized numeric enums, carry unmapped values, map null and preserve the target for an absent source', () => {
        expect(observed.map(event => event.statusName)).toEqual(['open', 'closed', 99, 'not-set', 'existing']);
    });
    it('should compare object values structurally, not by key order', () => {
        expect(observed.map(event => event.payload)).toEqual(sourceValues.map(() => ({ code: 'new' })));
    });
    it('should map boolean payload values', () => expect(observed.every(event => event.flag === true)).toBe(true));
    it('should apply nested maps and defaults without overwriting present null', () => {
        expect(observed.map(event => event.details.status)).toEqual(sourceValues.map(() => 'open'));
        expect(observed.map(event => event.details.note)).toEqual(['default-note', 'default-note', 'default-note', null, 'default-note']);
    });
    it('should split, combine and rename nested properties without literal dotted payload keys', () => {
        for (const event of observed) {
            expect(event.details).toMatchObject({ firstName: 'Ada', lastName: 'Lovelace', displayName: 'Dr Ada Lovelace', alias: 'Ada Lovelace' });
            expect(Object.keys(event).some(key => key.includes('.'))).toBe(false);
        }
    });
});
