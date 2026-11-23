// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, beforeEach, chai, describe, it, vi } from 'vitest';
import { createServer, ServerError, Status, type ServiceImplementation } from 'nice-grpc';
import {
    ConnectionServiceDefinition, MultiplexedObservationDefinition, MultiplexedObserverKind, ReactorsDefinition, ReducersDefinition,
    type MultiplexedClientMessage, type MultiplexedServerMessage
} from '@cratis/chronicle.contracts';
import { ChronicleConnection } from '../../ChronicleConnection.js';
import { multiplexedObservationCapability } from '../../MultiplexedObservation.js';

chai.should();

/** An open call to the multiplexed service: what it was sent, and how to answer it. */
type Call = { received: MultiplexedClientMessage[]; answer: (message: Partial<MultiplexedServerMessage>) => void };

/** A stream of what an observer sends up: its registration, then it stays open until cancelled. */
async function* registration(message: object, signal: AbortSignal) {
    yield message;
    await new Promise<void>(resolve => signal.addEventListener('abort', () => resolve(), { once: true }));
}

describe('when observing against a kernel', () => {
    let server: ReturnType<typeof createServer>;
    let connection: ChronicleConnection | undefined;
    let capabilities: string[];
    let address: string;
    let multiplexedCalls: Call[];
    let perReactorCalls: number;
    let perReducerCalls: number;
    const unsupported = async () => { throw new ServerError(Status.UNIMPLEMENTED, 'Unexpected RPC in specification'); };
    const untilThen = (condition: () => boolean) => vi.waitFor(() => { if (!condition()) throw new Error('not yet'); }, { timeout: 3000, interval: 10 });

    beforeEach(async () => {
        capabilities = [];
        multiplexedCalls = [];
        perReactorCalls = 0;
        perReducerCalls = 0;
        server = createServer();
        const connectionMethods = Object.fromEntries(Object.keys(ConnectionServiceDefinition.methods).map(name => [name, unsupported]));
        server.add(ConnectionServiceDefinition, {
            ...connectionMethods,
            checkCompatibility: vi.fn(async () => ({ IsCompatible: true, Incompatibilities: [], ServerVersion: '20.0.0', Capabilities: capabilities }))
        } as ServiceImplementation<typeof ConnectionServiceDefinition>);
        server.add(ReactorsDefinition, {
            ...Object.fromEntries(Object.keys(ReactorsDefinition.methods).map(name => [name, unsupported])),
            async* observe(request: AsyncIterable<unknown>, context: { signal: AbortSignal }) {
                perReactorCalls++;
                void (async () => { for await (const _ of request) { /* the registration */ } })().catch(() => undefined);
                await new Promise<void>(resolve => context.signal.addEventListener('abort', () => resolve(), { once: true }));
            }
        } as unknown as ServiceImplementation<typeof ReactorsDefinition>);
        server.add(ReducersDefinition, {
            ...Object.fromEntries(Object.keys(ReducersDefinition.methods).map(name => [name, unsupported])),
            async* observe(request: AsyncIterable<unknown>, context: { signal: AbortSignal }) {
                perReducerCalls++;
                void (async () => { for await (const _ of request) { /* the registration */ } })().catch(() => undefined);
                await new Promise<void>(resolve => context.signal.addEventListener('abort', () => resolve(), { once: true }));
            }
        } as unknown as ServiceImplementation<typeof ReducersDefinition>);
        server.add(MultiplexedObservationDefinition, {
            async* observe(request: AsyncIterable<MultiplexedClientMessage>, context: { signal: AbortSignal }) {
                const answers: Partial<MultiplexedServerMessage>[] = [];
                let wake: (() => void) | undefined;
                const call: Call = { received: [], answer: message => { answers.push(message); wake?.(); } };
                multiplexedCalls.push(call);
                void (async () => { for await (const message of request) call.received.push(message); })().catch(() => undefined);
                context.signal.addEventListener('abort', () => wake?.(), { once: true });
                while (!context.signal.aborted) {
                    if (answers.length === 0) await new Promise<void>(resolve => { wake = resolve; });
                    while (answers.length > 0) yield answers.shift() as MultiplexedServerMessage;
                }
            }
        } as unknown as ServiceImplementation<typeof MultiplexedObservationDefinition>);
        const port = await server.listen('127.0.0.1:0');
        address = `chronicle://127.0.0.1:${port}/?disableTls=true&apiKey=test-key`;
    });

    afterEach(async () => {
        connection?.dispose();
        connection = undefined;
        await server.shutdown();
    });

    const startObserving = async (multiplexObservation?: boolean) => {
        connection = new ChronicleConnection({ connectionString: address, multiplexObservation });
        await connection.connect();
        const controller = new AbortController();
        const { signal } = controller;
        const reactor = connection.reactors.observe(registration({ Content: { Value0: { Reactor: { ReactorId: 'a-reactor' } } } }, signal) as never, { signal })[Symbol.asyncIterator]();
        const reducer = connection.reducers.observe(registration({ Content: { Value0: { Reducer: { ReducerId: 'a-reducer' } } } }, signal) as never, { signal })[Symbol.asyncIterator]();
        const reactorDelivery = reactor.next().catch(() => undefined);
        void reducer.next().catch(() => undefined);
        return { controller, reactorDelivery };
    };

    describe('that advertises multiplexed observation', () => {
        it('should observe every reactor and reducer over one multiplexed call and not over the per-observer calls', async () => {
            capabilities = [multiplexedObservationCapability];
            const { controller } = await startObserving();
            await untilThen(() => multiplexedCalls[0]?.received.flatMap(message => message.Messages).length === 2);
            controller.abort();
            multiplexedCalls.should.have.lengthOf(1);
            multiplexedCalls[0].received.flatMap(message => message.Messages).map(message => message.Kind).sort()
                .should.deep.equal([MultiplexedObserverKind.Reactor, MultiplexedObserverKind.Reducer]);
            perReactorCalls.should.equal(0);
            perReducerCalls.should.equal(0);
        });

        it('should deliver what the kernel sends on a stream to the observer of that stream', async () => {
            capabilities = [multiplexedObservationCapability];
            const { controller, reactorDelivery } = await startObserving();
            await untilThen(() => multiplexedCalls[0]?.received.flatMap(message => message.Messages).length === 2);
            const reactorStream = multiplexedCalls[0].received.flatMap(message => message.Messages).find(message => message.Kind === MultiplexedObserverKind.Reactor)!.StreamId;
            multiplexedCalls[0].answer({ StreamId: reactorStream, Sequence: 1n, Reactor: { Partition: 'delivered' } as never });
            ((await reactorDelivery) as IteratorResult<{ Partition: string }>).value!.Partition.should.equal('delivered');
            controller.abort();
        });
    });

    describe('that does not advertise multiplexed observation', () => {
        it('should observe with one call per reactor and reducer', async () => {
            const { controller } = await startObserving();
            await untilThen(() => perReactorCalls === 1 && perReducerCalls === 1);
            controller.abort();
            multiplexedCalls.should.have.lengthOf(0);
        });
    });

    describe('that advertises it while the client has turned it off', () => {
        it('should observe with one call per reactor and reducer', async () => {
            capabilities = [multiplexedObservationCapability];
            const { controller } = await startObserving(false);
            await untilThen(() => perReactorCalls === 1 && perReducerCalls === 1);
            controller.abort();
            multiplexedCalls.should.have.lengthOf(0);
        });
    });
});
