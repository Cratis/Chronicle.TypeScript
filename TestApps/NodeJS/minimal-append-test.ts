// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import './telemetry';
import 'reflect-metadata';
import { ChronicleClient, ChronicleOptions } from '@cratis/chronicle';
import './events';
import { EmployeeHired } from './events';

async function run(): Promise<void> {
    const options = process.env.CHRONICLE_CONNECTION
        ? ChronicleOptions.fromConnectionString(process.env.CHRONICLE_CONNECTION)
        : ChronicleOptions.development();

    console.log(`Connecting to Chronicle at ${options.connectionString}...`);
    const client = new ChronicleClient(options);

    try {
        const store = await client.getEventStore('MinimalStore');
        console.log(`Event store: ${store.name.value} / ${store.namespace.value}`);

        // Simple event append without any setup
        console.log('\n=== Minimal Event Append ===');
        const eventSourceId = 'test-employee-1';
        const event = new EmployeeHired('John', 'Doe', 'Engineer');

        console.log(`Event to append:`, event);
        const result = await store.eventLog.append(eventSourceId, event);
        console.log(`Append result:`, result);

        if (result.isSuccess) {
            console.log(`✓ Successfully appended at sequence #${result.sequenceNumber.value}`);
        } else {
            console.error('✗ Append failed:');
            console.error('  Constraint violations:', result.constraintViolations);
            console.error('  Errors:', result.errors);
        }
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
