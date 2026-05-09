// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// Telemetry MUST be imported first so the OpenTelemetry SDK is fully
// initialised before any instrumented code runs.
import './telemetry';
import 'reflect-metadata';
import { ChronicleClient, ChronicleOptions, getEventTypeJsonSchemaFor } from '@cratis/chronicle';

// Import all artifacts so their decorators register them with the discoverer.
import './Events';
import './ReadModels';
import './Projections';
import './ModelBoundProjections';
import './Constraints';
import './Reactors';

import { EmployeeHired, EmployeeMoved, EmployeePromoted } from './Events';

async function run(): Promise<void> {
    const connectionString = process.env.CHRONICLE_CONNECTION ?? 'chronicle://localhost:35000';
    console.log(`Connecting to Chronicle at ${connectionString}...`);

    const options = ChronicleOptions.fromConnectionString(connectionString);
    const client = new ChronicleClient(options);

    const employeeHiredSchema = getEventTypeJsonSchemaFor(EmployeeHired);
    console.log(`EmployeeHired schema properties: ${Object.keys(employeeHiredSchema.properties ?? {}).join(', ')}`);

    try {
        console.log('Getting event store...');
        const store = await client.getEventStore('TestStore');
        console.log(`Event store obtained: ${store.name.value} / ${store.namespace.value}`);

        const eventSourceId = `employee-${Date.now()}`;

        // Append a hire event
        console.log('\nAppending EmployeeHired event...');
        const hireResult = await store.eventLog.append(eventSourceId, new EmployeeHired('Jane', 'Doe', 'Software Engineer'));
        if (hireResult.isSuccess) {
            console.log(`  Appended at sequence number: ${hireResult.sequenceNumber.value}`);
        } else {
            console.error('  Failed to append hire event:', hireResult.errors);
        }

        // Append a promotion event
        console.log('\nAppending EmployeePromoted event...');
        const promoteResult = await store.eventLog.append(eventSourceId, new EmployeePromoted('Senior Software Engineer'));
        if (promoteResult.isSuccess) {
            console.log(`  Appended at sequence number: ${promoteResult.sequenceNumber.value}`);
        } else {
            console.error('  Failed to append promotion event:', promoteResult.errors);
        }

        // Append a move event
        console.log('\nAppending EmployeeMoved event...');
        const moveResult = await store.eventLog.append(eventSourceId, new EmployeeMoved('San Francisco'));
        if (moveResult.isSuccess) {
            console.log(`  Appended at sequence number: ${moveResult.sequenceNumber.value}`);
        } else {
            console.error('  Failed to append move event:', moveResult.errors);
        }

        // Check tail sequence number
        console.log('\nChecking tail sequence number...');
        const tailSequenceNumber = await store.eventLog.getTailSequenceNumber(eventSourceId);
        console.log(`  Tail sequence number for ${eventSourceId}: ${tailSequenceNumber.value}`);

        // Check if events exist
        console.log('\nChecking if events exist...');
        const hasEvents = await store.eventLog.hasEventsFor(eventSourceId);
        console.log(`  Has events for ${eventSourceId}: ${hasEvents}`);

        // Get namespaces
        console.log('\nListing namespaces...');
        const namespaces = await store.getNamespaces();
        console.log(`  Namespaces: ${namespaces.map(namespace => namespace.value).join(', ') || '(none)'}`);

        console.log('\n✅ All operations completed successfully!');
    } catch (error) {
        console.error('❌ Error:', error);
        process.exitCode = 1;
    } finally {
        client.dispose();
        console.log('\nDisconnected from Chronicle.');
    }
}

run().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
});
