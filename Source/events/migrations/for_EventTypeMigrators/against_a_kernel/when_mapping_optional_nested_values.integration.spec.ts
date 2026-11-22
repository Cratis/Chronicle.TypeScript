// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { field } from '@cratis/fundamentals';
import type { ChronicleClient } from '../../../../ChronicleClient.js';
import type { IEventStore } from '../../../../IEventStore.js';
import { eventType, getEventTypeJsonSchemaFor } from '../../../index.js';
import { eventTypeMigration } from '../../eventTypeMigration.js';
import type { IEventMigrationBuilder } from '../../IEventMigrationBuilder.js';
import type { IEventTypeMigration } from '../../IEventTypeMigration.js';
import { connectionString, valueMappingClient } from './given/value_mapping_client.js';

// Runtime contract: cratis/chronicle:19.37.4-development, pinned by CI.
const eventTypeId = 'integration-value-map-optional-nested';
type ValueBag = { status?: string; result: string; note?: string };

@eventType(eventTypeId, 1)
class LegacyValuesRecorded {
    @field(Object) values: ValueBag = { result: 'existing' };
}

@eventType(eventTypeId, 2)
class ValuesRecorded {
    @field(Object) values: ValueBag = { result: 'existing' };
}

// EventTypeRegistrar.SchemaDeclaresPath requires every migration path segment to be declared.
// Declare optional strings explicitly: the generator makes all decorated properties required.
// ExpandoObjectConverter omits null scalar values, so this fixture only asserts absent values,
// not null persistence. Absent strings have no materialized default (JsonSchemaExtensions.GetDefaultValue).
for (const type of [LegacyValuesRecorded, ValuesRecorded]) {
    getEventTypeJsonSchemaFor(type).properties!.values = {
        type: 'object',
        additionalProperties: false,
        properties: { status: { type: 'string' }, result: { type: 'string' }, note: { type: 'string' } },
        required: ['result']
    };
}

@eventTypeMigration(ValuesRecorded, LegacyValuesRecorded)
class OptionalValueMigration implements IEventTypeMigration<ValuesRecorded, LegacyValuesRecorded> {
    upcast(builder: IEventMigrationBuilder<ValuesRecorded, LegacyValuesRecorded>): void {
        builder.properties(properties => properties
            .mapValues('values.result', 'values.status', [{ from: 'old', to: 'new' }])
            .defaultValue('values.note', 'default-note'));
    }
    downcast(_builder: IEventMigrationBuilder<LegacyValuesRecorded, ValuesRecorded>): void {}
}

// Never skip in CI: a missing connection string must fail rather than pass vacuously.
describe.skipIf(!connectionString && !process.env.CI)('when mapping optional nested values against the pinned kernel', () => {
    const sourceValues: ValueBag[] = [
        { status: 'old', result: 'existing', note: 'present' },
        { result: 'existing' }
    ];
    const expected = [
        { values: { status: 'old', result: 'new', note: 'present' } },
        { values: { result: 'existing', note: 'default-note' } }
    ];
    const clients: ChronicleClient[] = [];
    let originalContents: Record<string, unknown>[];
    let store: IEventStore;
    const sourceId = randomUUID();

    beforeAll(async () => {
        const storeName = `OptionalMaps${randomUUID().replaceAll('-', '')}`;
        const writer = valueMappingClient({ eventTypes: [LegacyValuesRecorded] });
        clients.push(writer);
        const oldStore = await writer.getEventStore(storeName);
        for (const values of sourceValues) {
            const event = Object.assign(new LegacyValuesRecorded(), { values });
            expect((await oldStore.eventLog.append(sourceId, event)).isSuccess).toBe(true);
        }
        const history = await oldStore.eventLog.getForEventSourceIdAndEventTypes(sourceId, [LegacyValuesRecorded]);
        originalContents = history.map(event => event.content);
        // Prove schema conversion has not materialized absent fields before migration.
        expect(originalContents).toStrictEqual(sourceValues.map(values => ({ values })));

        const migrator = valueMappingClient({
            eventTypes: [LegacyValuesRecorded, ValuesRecorded], eventTypeMigrations: [OptionalValueMigration]
        });
        clients.push(migrator);
        store = await migrator.getEventStore(storeName);
    }, 60_000);

    afterAll(() => clients.forEach(client => client.dispose()));

    it('should map and default declared optional paths while preserving present values and absent keys', async () => {
        expect(originalContents).toStrictEqual(sourceValues.map(values => ({ values })));
        await expect.poll(async () => {
            const events = await store.eventLog.getForEventSourceIdAndEventTypes(sourceId, [ValuesRecorded]);
            return events.map(event => event.content);
        }, { timeout: 20_000 }).toEqual(expected);
    }, 30_000);
});
