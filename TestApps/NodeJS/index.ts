// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// Telemetry MUST be imported first so the OpenTelemetry SDK is fully
// initialized before any instrumented code runs.

import './telemetry';
import 'reflect-metadata';
import { diag } from '@opentelemetry/api';
import { ChronicleClient, ChronicleOptions } from '@cratis/chronicle';

import { EmployeeHired, EmployeePromoted, EmployeeMoved } from './events';

const logger = diag.createComponentLogger({ namespace: 'chronicle-test-console' });

async function run(): Promise<void> {
    const options = process.env.CHRONICLE_CONNECTION
        ? ChronicleOptions.fromConnectionString(process.env.CHRONICLE_CONNECTION)
        : ChronicleOptions.development();

    logger.info(`Connecting to Chronicle`, { address: options.connectionString.toString() });
    const client = new ChronicleClient(options);

    try {
        const store = await client.getEventStore('TestStore');
        logger.info(`Event store ready`, { name: store.name.value, namespace: store.namespace.value });
        logger.info('Client lifecycle auto-discovery/auto-registration is enabled');

        // --- Event appending ---
        const eventSourceId = `employee-${Date.now()}`;
        logger.info('Appending events', { eventSourceId });

        let appendSucceeded = false;
        try {
            const hireResult = await store.eventLog.append(eventSourceId, new EmployeeHired('Jane', 'Doe', 'Software Engineer'));
            if (hireResult.isSuccess) {
                logger.info(`Hired`, { sequenceNumber: hireResult.sequenceNumber.value });
            } else {
                logger.error('Hire failed', { constraintViolations: hireResult.constraintViolations, errors: hireResult.errors });
            }

            const promoteResult = await store.eventLog.append(eventSourceId, new EmployeePromoted('Senior Software Engineer'));
            if (promoteResult.isSuccess) {
                logger.info(`Promoted`, { sequenceNumber: promoteResult.sequenceNumber.value });
            } else {
                logger.error('Promotion failed', { errors: promoteResult.errors });
            }

            const moveResult = await store.eventLog.append(eventSourceId, new EmployeeMoved('San Francisco'));
            if (moveResult.isSuccess) {
                logger.info(`Relocated`, { sequenceNumber: moveResult.sequenceNumber.value });
            } else {
                logger.error('Move failed', { errors: moveResult.errors });
            }
            appendSucceeded = true;
        } catch (error) {
            logger.warn('Append operations unavailable, continuing with connectivity checks', { error: String(error) });
        }

        // --- Read back ---
        if (appendSucceeded) {
            const tail = await store.eventLog.getTailSequenceNumber(eventSourceId);
            const hasEvents = await store.eventLog.hasEventsFor(eventSourceId);
            logger.info('Event log state', { tailSequence: tail.value, hasEvents });
        } else {
            logger.info('Skipped tail lookup because append did not complete');
        }

        const namespaces = await store.getNamespaces();
        logger.info('Namespaces', { namespaces: namespaces.map(n => n.value).join(', ') || '(none)' });

        logger.info('All operations completed successfully');
        logger.info('Waiting for observers to process events...');
        await new Promise(resolve => setTimeout(resolve, 8000));
    } catch (error) {
        logger.error('Unhandled error', { error: String(error) });
        process.exitCode = 1;
    } finally {
        client.dispose();
        logger.info('Disconnected');
    }
}

run().catch(error => {
    logger.error('Unhandled error', { error: String(error) });
    process.exit(1);
});
