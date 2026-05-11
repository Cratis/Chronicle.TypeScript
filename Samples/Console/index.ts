// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// Telemetry MUST be imported first so the OpenTelemetry SDK is fully
// initialized before any instrumented code runs.

import './telemetry';
import 'reflect-metadata';
import { diag } from '@opentelemetry/api';
import { ChronicleClient, ChronicleOptions, IEventStore } from '@cratis/chronicle';

import { EmployeeHired, EmployeeAddressSet, EmployeePromoted, EmployeeMoved } from './events';

const logger = diag.createComponentLogger({ namespace: 'chronicle-test-console' });

interface Person {
    readonly id: string;
    readonly firstName: string;
    readonly lastName: string;
}

const employees: Person[] = [
    { id: 'a0000001-0000-0000-0000-000000000000', firstName: 'Ada',   lastName: 'Lovelace' },
    { id: 'a0000002-0000-0000-0000-000000000000', firstName: 'Grace', lastName: 'Hopper'   },
    { id: 'a0000003-0000-0000-0000-000000000000', firstName: 'Alan',  lastName: 'Turing'   }
];

const titles = [
    'Software Engineer',
    'Senior Engineer',
    'Principal Engineer',
    'Engineering Manager',
    'Architect'
];

const addresses = [
    { address: '221B Baker Street',         city: 'London',        zipCode: 'NW1 6XE', country: 'UK'  },
    { address: '1600 Amphitheatre Parkway', city: 'Mountain View', zipCode: '94043',   country: 'USA' },
    { address: '1 Infinite Loop',           city: 'Cupertino',     zipCode: '95014',   country: 'USA' },
    { address: '5 Wall Street',             city: 'New York',      zipCode: '10005',   country: 'USA' }
];

/** Minimal seeded pseudo-random number generator (no external deps). */
class Random {
    private _seed: number;
    constructor() { this._seed = Date.now() & 0x7fffffff; }
    next(max: number): number {
        this._seed = (this._seed * 1664525 + 1013904223) & 0x7fffffff;
        return this._seed % max;
    }
}

async function seedEmployees(store: IEventStore): Promise<void> {
    const random = new Random();
    for (const employee of employees) {
        const hasEvents = await store.eventLog.hasEventsFor(employee.id);
        if (hasEvents) {
            logger.info('Employee already seeded, skipping', { id: employee.id });
            continue;
        }
        const title = titles[random.next(titles.length)];
        const addr  = addresses[random.next(addresses.length)];
        await store.eventLog.append(employee.id, new EmployeeHired(employee.firstName, employee.lastName, title));
        await store.eventLog.append(employee.id, new EmployeeAddressSet(addr.address, addr.city, addr.zipCode, addr.country));
        logger.info('Seeded employee', { name: `${employee.firstName} ${employee.lastName}`, title, city: addr.city });
    }
}

async function promote(store: IEventStore, person: Person, random: Random): Promise<void> {
    const title = titles[random.next(titles.length)];
    const result = await store.eventLog.append(person.id, new EmployeePromoted(title));
    console.log(`[${person.id}] Promoted ${person.firstName} ${person.lastName} to '${title}' at sequence ${result.sequenceNumber.value}`);
}

async function move(store: IEventStore, person: Person, random: Random): Promise<void> {
    const addr = addresses[random.next(addresses.length)];
    const result = await store.eventLog.append(person.id, new EmployeeMoved(addr.address, addr.city, addr.zipCode, addr.country));
    console.log(`[${person.id}] Moved ${person.firstName} ${person.lastName} to ${addr.address}, ${addr.city} at sequence ${result.sequenceNumber.value}`);
}

function writeInstructions(): void {
    console.log('\nUse 1-3 to select employee. P=Promote, A=Move, Q=Quit.\n');
}

function writeSelectedEmployee(index: number): void {
    const person = employees[index];
    console.log(`Selected [${index + 1}] ${person.firstName} ${person.lastName} (${person.id})`);
}

async function readKey(): Promise<string> {
    return new Promise(resolve => {
        process.stdin.once('data', (chunk: Buffer) => resolve(chunk.toString('utf8')));
    });
}

async function run(): Promise<void> {
    const options = process.env.CHRONICLE_CONNECTION
        ? ChronicleOptions.fromConnectionString(process.env.CHRONICLE_CONNECTION)
        : ChronicleOptions.development();

    logger.info('Connecting to Chronicle', { address: options.connectionString.toString() });
    const client = new ChronicleClient(options);

    try {
        const store = await client.getEventStore('TestStore');
        logger.info('Event store ready', { name: store.name.value, namespace: store.namespace.value });

        await seedEmployees(store);

        const random = new Random();
        let selectedIndex = 0;

        writeInstructions();
        writeSelectedEmployee(selectedIndex);

        if (process.stdin.isTTY) {
            process.stdin.setRawMode(true);
        }
        process.stdin.resume();

        while (true) {
            const key = (await readKey()).toLowerCase();

            if (key === '\u0003' || key === 'q') {
                console.log('Exiting...');
                break;
            }

            if (key === '1') { selectedIndex = 0; writeSelectedEmployee(selectedIndex); continue; }
            if (key === '2') { selectedIndex = 1; writeSelectedEmployee(selectedIndex); continue; }
            if (key === '3') { selectedIndex = 2; writeSelectedEmployee(selectedIndex); continue; }
            if (key === 'p') { await promote(store, employees[selectedIndex], random); continue; }
            if (key === 'a') { await move(store, employees[selectedIndex], random); continue; }
        }
    } catch (error) {
        logger.error('Unhandled error', { error: String(error) });
        process.exitCode = 1;
    } finally {
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(false);
        }
        process.stdin.pause();
        client.dispose();
        logger.info('Disconnected');
    }

    process.exit(process.exitCode ?? 0);
}

run().catch(error => {
    logger.error('Unhandled error', { error: String(error) });
    process.exit(1);
});
