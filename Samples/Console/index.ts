// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// Telemetry MUST be imported first so the OpenTelemetry SDK is fully
// initialized before any instrumented code runs.

import './telemetry';
import 'reflect-metadata';
import { diag } from '@opentelemetry/api';
import { ChronicleClient, ChronicleOptions, IEventStore } from '@cratis/chronicle';

import { EmployeePromoted, EmployeeMoved } from './events';
import { EmployeeState } from './reducers';

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

async function logSeededEmployeesStatus(store: IEventStore): Promise<void> {
    for (const employee of employees) {
        const hasEvents = await store.eventLog.hasEventsFor(employee.id);
        logger.info('Seeder status for employee', { id: employee.id, hasEvents });
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

async function transact(store: IEventStore, selectedIndex: number, random: Random): Promise<void> {
    const selected = employees[selectedIndex];
    const alsoUpdate = employees[(selectedIndex + 1) % employees.length];

    const selectedTitle = titles[random.next(titles.length)];
    const selectedAddress = addresses[random.next(addresses.length)];
    const secondTitle = titles[random.next(titles.length)];

    const unitOfWork = store.unitOfWorkManager.begin();
    await store.eventLog.transactional.append(selected.id, new EmployeePromoted(selectedTitle));
    await store.eventLog.transactional.appendMany(selected.id, [
        new EmployeeMoved(selectedAddress.address, selectedAddress.city, selectedAddress.zipCode, selectedAddress.country)
    ]);
    await store.eventLog.transactional.append(alsoUpdate.id, new EmployeePromoted(secondTitle));
    await unitOfWork.commit();

    console.log(`[transaction] Committed staged events for ${selected.firstName} ${selected.lastName} and ${alsoUpdate.firstName} ${alsoUpdate.lastName}`);
}

async function readModel(store: IEventStore, person: Person): Promise<void> {
    const state = await store.readModels.getInstanceById(EmployeeState, person.id);
    console.log(`[read-model] ${person.firstName} ${person.lastName}: ${state.title} @ ${state.address || 'no address yet'}`);
}

function writeInstructions(): void {
    console.log('\nUse 1-3 to select employee. P=Promote, A=Move, R=Read model, T=Transactional update, Q=Quit.\n');
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

        await logSeededEmployeesStatus(store);

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
            if (key === 'r') { await readModel(store, employees[selectedIndex]); continue; }
            if (key === 't') { await transact(store, selectedIndex, random); continue; }
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
