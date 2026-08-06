// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// Telemetry MUST be imported first so the OpenTelemetry SDK is fully
// initialized before any instrumented code runs.

import './telemetry';
import 'reflect-metadata';
import { diag } from '@opentelemetry/api';
import { ChronicleClient, ChronicleOptions, IEventStore, Identity, identityProvider, causationManager, CausationType } from '@cratis/chronicle';

import { EmployeePromoted, EmployeeMoved, EmployeeEmailSet } from './events';
import { EmployeeState } from './reducers';
import { Person, employees, emailFor } from './employees';
import { registerCustomerWithPii, showCustomerReadModel } from './compliance';
import { registerCustomersApi } from './externalServices';
import { redactLastEmailChange, eraseEmployee } from './redaction';
import { viewAuditLog } from './reactors';

// Side-effect imports so the @constraint and @seeder decorators run and are
// discovered and registered with the event store on connect.
import './constraints';
import './seeding';

const logger = diag.createComponentLogger({ namespace: 'chronicle-test-console' });

// Three mock users whose identity is attached to every append they trigger.
// Press I in the console to cycle through them.
const users = [
    new Identity('u0000001-0000-0000-0000-000000000000', 'Alice Smith', 'alice.smith'),
    new Identity('u0000002-0000-0000-0000-000000000000', 'Bob Jones',   'bob.jones'),
    Identity.system
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

function setupCausation(user: Identity, commandName: string, properties: Record<string, string>): void {
    identityProvider.setCurrentIdentity(user);
    causationManager.defineRoot({ source: 'console-sample' });
    causationManager.add(new CausationType(commandName), properties);
}

async function logSeededEmployeesStatus(store: IEventStore): Promise<void> {
    for (const employee of employees) {
        const hasEvents = await store.eventLog.hasEventsFor(employee.id);
        logger.info('Seeder status for employee', { id: employee.id, hasEvents });
    }
}

async function promote(store: IEventStore, person: Person, user: Identity, random: Random): Promise<void> {
    const title = titles[random.next(titles.length)];
    setupCausation(user, 'ConsoleSample.Commands.Promote', { employeeId: person.id });
    const result = await store.eventLog.append(person.id, new EmployeePromoted(title));
    console.log(`[${person.id}] Promoted ${person.firstName} ${person.lastName} to '${title}' at sequence ${result.sequenceNumber.value}  [caused-by: ${user.userName}]`);
}

// Promotes the employee, then waits for every observer affected by the append (the
// EmployeeState reducer, the model-bound and declarative projections, the reactor) to
// either catch up to the appended sequence number or fail, before reading the read
// model back. Reading immediately after append without waiting can race the read
// model's asynchronous processing and observe stale state; waitForCompletion removes
// that race by default with a 5 second timeout.
async function promoteAndConfirm(store: IEventStore, person: Person, user: Identity, random: Random): Promise<void> {
    const title = titles[random.next(titles.length)];
    setupCausation(user, 'ConsoleSample.Commands.PromoteAndConfirm', { employeeId: person.id });
    const result = await store.eventLog.append(person.id, new EmployeePromoted(title));

    const completion = await result.waitForCompletion();
    if (!completion.isSuccess) {
        console.log(`[wait-for-completion] ${completion.failedPartitions.length} observer partition(s) failed while catching up on the promotion.`);
        return;
    }

    const state = await store.readModels.getInstanceById(EmployeeState, person.id);
    console.log(`[wait-for-completion] Promoted ${person.firstName} ${person.lastName} to '${title}' and confirmed the read model shows it: '${state.title}'  [caused-by: ${user.userName}]`);
}

async function move(store: IEventStore, person: Person, user: Identity, random: Random): Promise<void> {
    const addr = addresses[random.next(addresses.length)];
    setupCausation(user, 'ConsoleSample.Commands.Move', { employeeId: person.id });
    const result = await store.eventLog.append(person.id, new EmployeeMoved(addr.address, addr.city, addr.zipCode, addr.country));
    console.log(`[${person.id}] Moved ${person.firstName} ${person.lastName} to ${addr.address}, ${addr.city} at sequence ${result.sequenceNumber.value}  [caused-by: ${user.userName}]`);
}

// Sets the selected employee's own unique email address. Succeeds because the email
// belongs to that employee (re-setting the same value for the same event source is allowed).
async function setEmail(store: IEventStore, person: Person, user: Identity): Promise<void> {
    const email = emailFor(person);
    setupCausation(user, 'ConsoleSample.Commands.SetEmail', { employeeId: person.id });
    const result = await store.eventLog.append(person.id, new EmployeeEmailSet(email));
    if (result.isSuccess) {
        console.log(`[${person.id}] Set ${person.firstName} ${person.lastName}'s email to ${email} at sequence ${result.sequenceNumber.value}  [caused-by: ${user.userName}]`);
    } else {
        console.log(`[${person.id}] Could not set email: ${result.constraintViolations.map(v => v.message).join('; ')}`);
    }
}

// Attempts to give the selected employee the next employee's email address, which the
// UniqueEmployeeEmail constraint rejects because that email is already owned elsewhere.
async function stealEmail(store: IEventStore, selectedIndex: number, user: Identity): Promise<void> {
    const person = employees[selectedIndex];
    const victim = employees[(selectedIndex + 1) % employees.length];
    const email = emailFor(victim);
    setupCausation(user, 'ConsoleSample.Commands.SetEmail', { employeeId: person.id });
    const result = await store.eventLog.append(person.id, new EmployeeEmailSet(email));
    if (result.isSuccess) {
        console.log(`[${person.id}] Unexpectedly took ${email} at sequence ${result.sequenceNumber.value}  [caused-by: ${user.userName}]`);
    } else {
        console.log(`[${person.id}] Rejected taking ${victim.firstName}'s email (${email}): ${result.constraintViolations.map(v => v.message).join('; ')}`);
    }
}

async function transact(store: IEventStore, selectedIndex: number, user: Identity, random: Random): Promise<void> {
    const selected = employees[selectedIndex];
    const alsoUpdate = employees[(selectedIndex + 1) % employees.length];

    const selectedTitle = titles[random.next(titles.length)];
    const selectedAddress = addresses[random.next(addresses.length)];
    const secondTitle = titles[random.next(titles.length)];

    setupCausation(user, 'ConsoleSample.Commands.BulkUpdate', { employees: `${selected.id},${alsoUpdate.id}` });

    const unitOfWork = store.unitOfWorkManager.begin();
    await store.eventLog.transactional.append(selected.id, new EmployeePromoted(selectedTitle));
    await store.eventLog.transactional.appendMany(selected.id, [
        new EmployeeMoved(selectedAddress.address, selectedAddress.city, selectedAddress.zipCode, selectedAddress.country)
    ]);
    await store.eventLog.transactional.append(alsoUpdate.id, new EmployeePromoted(secondTitle));
    await unitOfWork.commit();

    console.log(`[transaction] Committed staged events for ${selected.firstName} ${selected.lastName} and ${alsoUpdate.firstName} ${alsoUpdate.lastName}  [caused-by: ${user.userName}]`);
}

async function readModel(store: IEventStore, person: Person): Promise<void> {
    const state = await store.readModels.getInstanceById(EmployeeState, person.id);
    console.log(`[read-model] ${person.firstName} ${person.lastName}: ${state.title} <${state.email || 'no email yet'}> @ ${state.address || 'no address yet'}`);
}

function writeInstructions(): void {
    console.log([
        '',
        'Use 1-3 to select an employee. Then:',
        '  P = Promote          A = Move (change address)',
        '  E = Set email        U = Try to take the next employee\'s email (constraint violation)',
        '  R = Read model       T = Transactional update',
        '  W = Promote and wait for the read model to catch up (waitForCompletion)',
        '  D = Redact last email change (single-event, destructive)',
        '  G = Erase employee entirely (GDPR erasure, destructive)',
        '  L = View HR audit log (reactor side-effect events)',
        '  C = Register customer with PII   V = View customer PII read model',
        '  X = Register external HTTP service (bearer token)',
        '  I = Switch user (cycle: Alice Smith → Bob Jones → System)',
        '  H or ? = Show this menu          Q = Quit',
        ''
    ].join('\n'));
}

function writeSelectedEmployee(employeeIndex: number, userIndex: number): void {
    const person = employees[employeeIndex];
    const user = users[userIndex];
    console.log(`Selected  [${employeeIndex + 1}] ${person.firstName} ${person.lastName} (${person.id})`);
    console.log(`Acting as [${userIndex + 1}] ${user.name} (@${user.userName})`);
}

function writeSelectedUser(userIndex: number): void {
    const user = users[userIndex];
    console.log(`\nSwitched to user [${userIndex + 1}] ${user.name} (@${user.userName})`);
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
        const store = await client.getEventStore('TestStoreTS');
        logger.info('Event store ready', { name: store.name.value, namespace: store.namespace.value });

        await logSeededEmployeesStatus(store);

        const random = new Random();
        let selectedIndex = 0;
        let userIndex = 0;

        writeInstructions();
        writeSelectedEmployee(selectedIndex, userIndex);

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

            if (key === '1') { selectedIndex = 0; writeSelectedEmployee(selectedIndex, userIndex); continue; }
            if (key === '2') { selectedIndex = 1; writeSelectedEmployee(selectedIndex, userIndex); continue; }
            if (key === '3') { selectedIndex = 2; writeSelectedEmployee(selectedIndex, userIndex); continue; }
            if (key === 'i') { userIndex = (userIndex + 1) % users.length; writeSelectedUser(userIndex); continue; }
            if (key === 'p') { await promote(store, employees[selectedIndex], users[userIndex], random); continue; }
            if (key === 'a') { await move(store, employees[selectedIndex], users[userIndex], random); continue; }
            if (key === 'e') { await setEmail(store, employees[selectedIndex], users[userIndex]); continue; }
            if (key === 'u') { await stealEmail(store, selectedIndex, users[userIndex]); continue; }
            if (key === 'r') { await readModel(store, employees[selectedIndex]); continue; }
            if (key === 't') { await transact(store, selectedIndex, users[userIndex], random); continue; }
            if (key === 'w') { await promoteAndConfirm(store, employees[selectedIndex], users[userIndex], random); continue; }
            if (key === 'd') { await redactLastEmailChange(store, employees[selectedIndex]); continue; }
            if (key === 'g') { await eraseEmployee(store, employees[selectedIndex]); continue; }
            if (key === 'l') { await viewAuditLog(store); continue; }
            if (key === 'c') { await registerCustomerWithPii(store); continue; }
            if (key === 'v') { await showCustomerReadModel(store); continue; }
            if (key === 'x') { await registerCustomersApi(store); continue; }
            if (key === 'h' || key === '?') { writeInstructions(); continue; }
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
