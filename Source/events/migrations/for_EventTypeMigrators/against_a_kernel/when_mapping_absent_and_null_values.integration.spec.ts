// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { field } from '@cratis/fundamentals';
import type { ChronicleClient } from '../../../../ChronicleClient.js';
import { eventType, getEventTypeJsonSchemaFor } from '../../../index.js';
import { eventTypeMigration } from '../../eventTypeMigration.js';
import type { IEventMigrationBuilder } from '../../IEventMigrationBuilder.js';
import type { IEventTypeMigration } from '../../IEventTypeMigration.js';
import { connectionString, valueMappingClient } from './given/value_mapping_client.js';

// Runtime contract: cratis/chronicle:19.37.4-development, pinned by CI.
const eventTypeId = 'integration-value-map-null-and-absent';
type ValueBag = { status?: string | null; result: string; note?: string | null };

@eventType(eventTypeId, 1)
class LegacyValuesRecorded {
    @field(Object) values: ValueBag = { result: 'existing' };
}

@eventType(eventTypeId, 2)
class ValuesRecorded {
    @field(Object) values: ValueBag = { result: 'existing' };
}

// The generator makes decorated members required and has no optional/nullable field option.
// Declare the fixture's value bag as a JSON dictionary, not decorated optional scalar fields.
// The pinned kernel's when_round_tripping_case_sensitive_dictionary_values spec proves that
// additionalProperties: {} preserves null entries and absent keys through schema conversion.
for (const type of [LegacyValuesRecorded, ValuesRecorded]) {
    getEventTypeJsonSchemaFor(type).properties!.values.additionalProperties = {};
}

@eventTypeMigration(ValuesRecorded, LegacyValuesRecorded)
class NullableValueMigration implements IEventTypeMigration<ValuesRecorded, LegacyValuesRecorded> {
    upcast(builder: IEventMigrationBuilder<ValuesRecorded, LegacyValuesRecorded>): void {
        builder.properties(properties => properties
            .mapValues('values.result', 'values.status', [{ from: null, to: 'not-set' }])
            .defaultValue('values.note', 'default-note'));
    }
    downcast(_builder: IEventMigrationBuilder<LegacyValuesRecorded, ValuesRecorded>): void {}
}

// Never skip in CI: a missing connection string must fail rather than pass vacuously.
describe.skipIf(!connectionString && !process.env.CI)('when mapping absent and null values against the pinned kernel', () => {
    const sourceValues: ValueBag[] = [
        { status: null, result: 'existing', note: null },
        { result: 'existing' }
    ];
    const expected = [
        { values: { status: null, result: 'not-set', note: null } },
        { values: { result: 'existing', note: 'default-note' } }
    ];
    const clients: ChronicleClient[] = [];
    let originalContents: Record<string, unknown>[];
    let migratedContents: Record<string, unknown>[];

    beforeAll(async () => {
        const storeName = `NullableMaps${randomUUID().replaceAll('-', '')}`;
        const sourceId = randomUUID();
        const writer = valueMappingClient({ eventTypes: [LegacyValuesRecorded] });
        clients.push(writer);
        const oldStore = await writer.getEventStore(storeName);
        for (const values of sourceValues) {
            const event = Object.assign(new LegacyValuesRecorded(), { values });
            expect((await oldStore.eventLog.append(sourceId, event)).isSuccess).toBe(true);
        }
        const history = await oldStore.eventLog.getForEventSourceIdAndEventTypes(sourceId, [LegacyValuesRecorded]);
        originalContents = history.map(event => event.content);
        // Prove the history has not lost null or materialized absent fields before migration.
        expect(originalContents).toStrictEqual(sourceValues.map(values => ({ values })));

        const migrator = valueMappingClient({
            eventTypes: [LegacyValuesRecorded, ValuesRecorded], eventTypeMigrations: [NullableValueMigration]
        });
        clients.push(migrator);
        const store = await migrator.getEventStore(storeName);
        await expect.poll(async () => {
            const events = await store.eventLog.getForEventSourceIdAndEventTypes(sourceId, [ValuesRecorded]);
            migratedContents = events.map(event => event.content);
            return migratedContents;
        }, { timeout: 20_000 }).toEqual(expected);
    }, 60_000);

    afterAll(() => clients.forEach(client => client.dispose()));

    it('should round-trip a present null and an absent key before migration', () => {
        expect(originalContents).toStrictEqual(sourceValues.map(values => ({ values })));
    });
    it('should map present null and leave the existing target untouched for an absent source', () => {
        expect(migratedContents.map(event => (event.values as ValueBag).result)).toEqual(['not-set', 'existing']);
    });
    it('should default an absent nested property without overwriting present null', () => {
        expect(migratedContents.map(event => (event.values as ValueBag).note)).toEqual([null, 'default-note']);
    });
});
