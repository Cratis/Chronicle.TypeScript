// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// Telemetry MUST be imported first so the OpenTelemetry SDK is fully
// initialised before any instrumented code runs.
import './telemetry';
import 'reflect-metadata';
import { ChronicleClient, ChronicleOptions, getEventTypeJsonSchemaFor } from '@cratis/chronicle';

// Register all artifacts so their decorators fire before anything else runs.
import './events';
import './reactors';
import './reducers';

import { registerEmployeeListProjection } from './projections-declarative';
import { demonstrateModelBoundProjection } from './projections-model-bound';
import { registerConstraints } from './constraints';

import { EmployeeHired, EmployeePromoted, EmployeeMoved } from './events';

async function run(): Promise<void> {
    const options = process.env.CHRONICLE_CONNECTION
        ? ChronicleOptions.fromConnectionString(process.env.CHRONICLE_CONNECTION)
        : ChronicleOptions.development();

    console.log(`Connecting to Chronicle at ${options.connectionString}...`);
    const client = new ChronicleClient(options);

    const employeeHiredSchema = getEventTypeJsonSchemaFor(EmployeeHired);
    console.log(`EmployeeHired schema properties: ${Object.keys(employeeHiredSchema.properties ?? {}).join(', ')}`);

    try {
        const store = await client.getEventStore('TestStore');
        console.log(`Event store: ${store.name.value} / ${store.namespace.value}\n`);

        // --- Constraints ---
        console.log('=== Constraints ===');
        await registerConstraints(store);

        // --- Projections ---
        console.log('\n=== Declarative Projection ===');
        await registerEmployeeListProjection(store);

        console.log('\n=== Model-Bound Projection ===');
        await demonstrateModelBoundProjection(store);

        // --- Event appending ---
        console.log('\n=== Appending Events ===');
        const eventSourceId = `employee-${Date.now()}`;

        const hireResult = await store.eventLog.append(eventSourceId, new EmployeeHired('Jane', 'Doe', 'Software Engineer'));
        if (hireResult.isSuccess) {
            console.log(`  Hired at seq #${hireResult.sequenceNumber.value}`);
        } else {
            console.error('  Hire failed:', hireResult.constraintViolations, hireResult.errors);
        }

        const promoteResult = await store.eventLog.append(eventSourceId, new EmployeePromoted('Senior Software Engineer'));
        if (promoteResult.isSuccess) {
            console.log(`  Promoted at seq #${promoteResult.sequenceNumber.value}`);
        } else {
            console.error('  Promotion failed:', promoteResult.errors);
        }

        const moveResult = await store.eventLog.append(eventSourceId, new EmployeeMoved('San Francisco'));
        if (moveResult.isSuccess) {
            console.log(`  Relocated at seq #${moveResult.sequenceNumber.value}`);
        } else {
            console.error('  Move failed:', moveResult.errors);
        }

        // --- Read back ---
        console.log('\n=== Event Log State ===');
        const tail = await store.eventLog.getTailSequenceNumber(eventSourceId);
        const hasEvents = await store.eventLog.hasEventsFor(eventSourceId);
        console.log(`  Tail sequence : ${tail.value}`);
        console.log(`  Has events    : ${hasEvents}`);

        const namespaces = await store.getNamespaces();
        console.log(`  Namespaces    : ${namespaces.map(n => n.value).join(', ') || '(none)'}`);

        console.log('\nAll operations completed successfully.');
    } catch (error) {
        console.error('Error:', error);
        process.exitCode = 1;
    } finally {
        client.dispose();
        console.log('Disconnected.');
    }
}

run().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
});
