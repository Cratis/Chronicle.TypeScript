// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import {
    ChronicleClient,
    ChronicleOptions,
    eventType,
    getEventTypeJsonSchemaFor,
    readModel,
    projection,
    modelBound,
    reactor,
    EventContext,
    IProjectionFor,
    IProjectionBuilderFor,
    fromEvent,
    setFrom,
    setFromContext,
    increment,
    childrenFrom,
    notRewindable,
    removedWith
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

/** Represents an employee leaving the organization. */
@eventType('dd0fdd58-dfe4-4bf7-d88b-049814f3f249', 1)
class EmployeeLeft {
    constructor(readonly reason: string) {}
}

/** Read model representing the current state of an employee. */
@readModel('employee-read-model')
class EmployeeReadModel {
    constructor(
        readonly firstName: string,
        readonly lastName: string,
        readonly title: string,
        readonly city: string,
        readonly promotionCount: number
    ) {}
}

// --- Declarative projection ---

/**
 * Declarative projection that builds an EmployeeReadModel from employee domain events.
 * Uses the fluent builder API to describe all property mappings explicitly.
 */
@projection('employees-declarative')
class EmployeesDeclarativeProjection implements IProjectionFor<EmployeeReadModel> {
    /** @inheritdoc */
    define(builder: IProjectionBuilderFor<EmployeeReadModel>): void {
        builder
            .from<EmployeeHired>(fromBuilder =>
                fromBuilder
                    .set(m => m.firstName).to(e => e.firstName)
                    .set(m => m.lastName).to(e => e.lastName)
                    .set(m => m.title).to(e => e.title)
            )
            .from<EmployeePromoted>(fromBuilder =>
                fromBuilder
                    .set(m => m.title).to(e => e.newTitle)
                    .increment(m => m.promotionCount)
            )
            .from<EmployeeMoved>(fromBuilder =>
                fromBuilder
                    .set(m => m.city).to(e => e.newCity)
            )
            .removedWith<EmployeeLeft>();
    }
}

// --- Model-bound projection ---

/**
 * Model-bound projection that maps employee domain events directly onto properties via decorators.
 * This style keeps all projection logic co-located with the read model shape.
 */
@modelBound('employees-model-bound')
@notRewindable
@removedWith(EmployeeLeft)
class EmployeesModelBoundProjection {
    @setFrom(EmployeeHired)
    firstName: string = '';

    @setFrom(EmployeeHired)
    lastName: string = '';

    @setFrom(EmployeeHired)
    @setFrom(EmployeePromoted, 'newTitle')
    title: string = '';

    @setFrom(EmployeeMoved, 'newCity')
    city: string = '';

    @increment(EmployeePromoted)
    promotionCount: number = 0;

    @setFromContext(EmployeeHired, 'occurred')
    lastUpdated: string = '';
}

// --- Model-bound projection with children ---

/** Represents a department assignment history entry. */
class DepartmentAssignment {
    constructor(
        readonly department: string,
        readonly assignedOn: string
    ) {}
}

/**
 * Model-bound projection that includes a child collection, demonstrating the childrenFrom decorator.
 */
@fromEvent(EmployeeHired)
@modelBound('employees-with-history')
class EmployeeWithHistoryProjection {
    @setFrom(EmployeeHired)
    firstName: string = '';

    @setFrom(EmployeeHired)
    lastName: string = '';

    @childrenFrom(EmployeePromoted, 'promotionCount', 'department')
    promotionHistory: DepartmentAssignment[] = [];
}

// --- Reactor ---

/** Reacts to employee events by logging them to the console. */
@reactor('hr-notification-reactor')
class HrNotificationReactor {
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
