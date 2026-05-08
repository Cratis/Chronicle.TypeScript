// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import {
    ChronicleClient,
    ChronicleOptions,
    eventType,
    reactor,
    IReactor,
    EventContext
} from '@cratis/chronicle';

// --- Event type definitions ---

/** Represents an employee being hired into the organization. */
@eventType('aa7faa25-afc1-48d1-8558-716581c0e916', 1)
class EmployeeHired {
    constructor(
        readonly firstName: string,
        readonly lastName: string,
        readonly title: string
    ) {}
}

/** Represents an employee receiving a promotion to a new title. */
@eventType('bb8fbb36-bfd2-49e5-b669-827692d1f027', 1)
class EmployeePromoted {
    constructor(readonly newTitle: string) {}
}

/** Represents an employee relocating to a new city. */
@eventType('cc9fcc47-cfe3-4af6-c77a-938703e2f138', 1)
class EmployeeMoved {
    constructor(readonly newCity: string) {}
}

// --- Reactor ---

/** Reacts to employee events by logging them to the console. */
@reactor('hr-notification-reactor')
class HrNotificationReactor implements IReactor {
    /**
     * Reacts to an employee being hired.
     * @param event - The EmployeeHired event.
     * @param context - The event context.
     */
    async employeeHired(event: EmployeeHired, context: EventContext): Promise<void> {
        console.log(`[Reactor] ${event.firstName} ${event.lastName} was hired as ${event.title} (seq: ${context.sequenceNumber})`);
    }

    /**
     * Reacts to an employee being promoted.
     * @param event - The EmployeePromoted event.
     * @param context - The event context.
     */
    async employeePromoted(event: EmployeePromoted, context: EventContext): Promise<void> {
        console.log(`[Reactor] Promotion to ${event.newTitle} (seq: ${context.sequenceNumber})`);
    }
}

// --- Main test flow ---

async function run(): Promise<void> {
    const connectionString = process.env.CHRONICLE_CONNECTION ?? 'chronicle://localhost:35000';
    console.log(`Connecting to Chronicle at ${connectionString}...`);

    const options = ChronicleOptions.fromConnectionString(connectionString);
    const client = new ChronicleClient(options);

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
