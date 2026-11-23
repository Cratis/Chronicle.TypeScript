// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { describe, expect, it } from 'vitest';
import { MultiplexedObserverKind } from '@cratis/chronicle.contracts';
import { ClientError } from 'nice-grpc-common';
import { AsyncQueue } from '../../../reactors/AsyncQueue.js';
import { MultiplexedObservationChannel } from '../MultiplexedObservationChannel.js';
import { FakeMultiplexedService, nextOf, reactorMessage, reducerMessage, until } from './given/a_fake_multiplexed_service.js';

function aChannel(coalesceDelayMs = 0) {
    const service = new FakeMultiplexedService();
    return { service, channel: new MultiplexedObservationChannel(service, { coalesceDelayMs }) };
}

describe('when several observers register together', () => {
    it('should write all their registrations in one message to one call, naming the kind on the first message of each stream', async () => {
        const { service, channel } = aChannel(20);
        const first = new AsyncQueue<ReturnType<typeof reactorMessage>>();
        const second = new AsyncQueue<ReturnType<typeof reducerMessage>>();
        first.send(reactorMessage('register-reactor'));
        second.send(reducerMessage('register-reducer'));
        channel.observeReactor(first)[Symbol.asyncIterator]();
        channel.observeReducer(second)[Symbol.asyncIterator]();
        await until(() => service.calls[0]?.writes.length > 0);

        expect(service.calls).toHaveLength(1);
        expect(service.calls[0].writes).toHaveLength(1);
        const [reactor, reducer] = service.calls[0].messages;
        expect(reactor.Kind).toBe(MultiplexedObserverKind.Reactor);
        expect(reducer.Kind).toBe(MultiplexedObserverKind.Reducer);
        expect(reactor.StreamId).not.toBe(reducer.StreamId);
    });
});

describe('when an observer sends results after its registration', () => {
    it('should send them on the same stream without naming the kind again, in order', async () => {
        const { service, channel } = aChannel();
        const up = new AsyncQueue<ReturnType<typeof reactorMessage>>();
        up.send(reactorMessage('register'));
        channel.observeReactor(up)[Symbol.asyncIterator]();
        await until(() => service.calls[0]?.messages.length === 1);
        up.send(reactorMessage('result-1'));
        up.send(reactorMessage('result-2'));
        await until(() => service.calls[0].messages.length === 3);

        const messages = service.calls[0].messages;
        expect(new Set(messages.map(message => message.StreamId)).size).toBe(1);
        expect(messages.map(message => message.Kind)).toEqual([MultiplexedObserverKind.Reactor, MultiplexedObserverKind.Unspecified, MultiplexedObserverKind.Unspecified]);
        expect(messages.map(message => (message.Reactor as unknown as { marker: string }).marker)).toEqual(['register', 'result-1', 'result-2']);
    });
});

describe('when the kernel interleaves deliveries of several streams', () => {
    it('should give each observer its own deliveries in order', async () => {
        const { service, channel } = aChannel();
        const one = new AsyncQueue<ReturnType<typeof reactorMessage>>();
        const two = new AsyncQueue<ReturnType<typeof reducerMessage>>();
        one.send(reactorMessage('one'));
        two.send(reducerMessage('two'));
        const reactor = channel.observeReactor(one)[Symbol.asyncIterator]();
        const reducer = channel.observeReducer(two)[Symbol.asyncIterator]();
        await until(() => service.calls[0]?.messages.length === 2);
        const [reactorStream, reducerStream] = service.calls[0].messages.map(message => message.StreamId);

        service.calls[0].reactor(reactorStream, 1n, 'a');
        service.calls[0].reducer(reducerStream, 1n, 'x');
        service.calls[0].reactor(reactorStream, 2n, 'b');
        service.calls[0].reducer(reducerStream, 2n, 'y');

        expect([(await nextOf(reactor)).Partition, (await nextOf(reactor)).Partition]).toEqual(['a', 'b']);
        expect([(await nextOf(reducer)).Partition, (await nextOf(reducer)).Partition]).toEqual(['x', 'y']);
    });
});

describe('when one stream ends with a failure status', () => {
    it('should fail that observer with the status and detail, and leave the other running', async () => {
        const { service, channel } = aChannel();
        const one = new AsyncQueue<ReturnType<typeof reactorMessage>>();
        const two = new AsyncQueue<ReturnType<typeof reactorMessage>>();
        one.send(reactorMessage('one'));
        two.send(reactorMessage('two'));
        const failing = channel.observeReactor(one)[Symbol.asyncIterator]();
        const healthy = channel.observeReactor(two)[Symbol.asyncIterator]();
        await until(() => service.calls[0]?.messages.length === 2);
        const [failingStream, healthyStream] = service.calls[0].messages.map(message => message.StreamId);

        service.calls[0].end(failingStream, 1n, 14, 'kernel is stopping');
        service.calls[0].reactor(healthyStream, 1n, 'still-here');

        const error = await failing.next().catch(thrown => thrown) as ClientError;
        expect(error).toBeInstanceOf(ClientError);
        expect(error.code).toBe(14);
        expect(error.details).toBe('kernel is stopping');
        expect((await nextOf(healthy)).Partition).toBe('still-here');
        expect(service.calls).toHaveLength(1);
    });
});

describe('when one stream ends with status zero', () => {
    it('should complete that observer', async () => {
        const { service, channel } = aChannel();
        const up = new AsyncQueue<ReturnType<typeof reactorMessage>>();
        up.send(reactorMessage('register'));
        const stream = channel.observeReactor(up)[Symbol.asyncIterator]();
        await until(() => service.calls[0]?.messages.length === 1);
        service.calls[0].end(service.calls[0].messages[0].StreamId, 1n);
        expect((await stream.next()).done).toBe(true);
    });
});

describe('when an observer stops observing', () => {
    it('should send a close for its stream and cancel the shared call once the last one is gone', async () => {
        const { service, channel } = aChannel();
        const up = new AsyncQueue<ReturnType<typeof reactorMessage>>();
        up.send(reactorMessage('register'));
        const stream = channel.observeReactor(up)[Symbol.asyncIterator]();
        await until(() => service.calls[0]?.messages.length === 1);

        await stream.return!();

        expect(service.calls[0].aborted).toBe(true);
    });

    it('should open a new call for the next observer', async () => {
        const { service, channel } = aChannel();
        const first = new AsyncQueue<ReturnType<typeof reactorMessage>>();
        first.send(reactorMessage('register'));
        const stream = channel.observeReactor(first)[Symbol.asyncIterator]();
        await until(() => service.calls[0]?.messages.length === 1);
        await stream.return!();

        const second = new AsyncQueue<ReturnType<typeof reactorMessage>>();
        second.send(reactorMessage('register-again'));
        channel.observeReactor(second)[Symbol.asyncIterator]();
        await until(() => service.calls[1]?.messages.length === 1);

        expect(service.calls).toHaveLength(2);
    });

    it('should keep the call for the observers that remain, sending a close for the one that stopped', async () => {
        const { service, channel } = aChannel();
        const one = new AsyncQueue<ReturnType<typeof reactorMessage>>();
        const two = new AsyncQueue<ReturnType<typeof reactorMessage>>();
        one.send(reactorMessage('one'));
        two.send(reactorMessage('two'));
        const stopped = channel.observeReactor(one)[Symbol.asyncIterator]();
        channel.observeReactor(two)[Symbol.asyncIterator]();
        await until(() => service.calls[0]?.messages.length === 2);
        const stoppedStream = service.calls[0].messages[0].StreamId;

        await stopped.return!();
        await until(() => service.calls[0].messages.length === 3);

        expect(service.calls[0].messages[2]).toMatchObject({ StreamId: stoppedStream, Close: true });
        expect(service.calls[0].aborted).toBe(false);
    });
});

describe('when the messages an observer sends end', () => {
    it('should close its stream', async () => {
        const { service, channel } = aChannel();
        const one = new AsyncQueue<ReturnType<typeof reactorMessage>>();
        const two = new AsyncQueue<ReturnType<typeof reactorMessage>>();
        one.send(reactorMessage('one'));
        two.send(reactorMessage('two'));
        channel.observeReactor(one)[Symbol.asyncIterator]();
        channel.observeReactor(two)[Symbol.asyncIterator]();
        await until(() => service.calls[0]?.messages.length === 2);

        one.complete();
        await until(() => service.calls[0].messages.length === 3);

        expect(service.calls[0].messages[2]).toMatchObject({ StreamId: service.calls[0].messages[0].StreamId, Close: true });
    });
});

describe('when the observer is cancelled', () => {
    it('should fail it with an abort error and close its stream', async () => {
        const { service, channel } = aChannel();
        const up = new AsyncQueue<ReturnType<typeof reactorMessage>>();
        up.send(reactorMessage('register'));
        const controller = new AbortController();
        const stream = channel.observeReactor(up, { signal: controller.signal })[Symbol.asyncIterator]();
        await until(() => service.calls[0]?.messages.length === 1);

        controller.abort();

        const error = await stream.next().catch(thrown => thrown);
        expect(error.name).toBe('AbortError');
        expect(service.calls[0].aborted).toBe(true);
    });
});
