// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { describe, expect, it } from 'vitest';
import { AsyncQueue } from '../../../reactors/AsyncQueue.js';
import { MultiplexedObservationChannel } from '../MultiplexedObservationChannel.js';
import { FakeMultiplexedService, nextOf, reactorMessage, until } from './given/a_fake_multiplexed_service.js';

function twoObservers() {
    const service = new FakeMultiplexedService();
    const channel = new MultiplexedObservationChannel(service, { coalesceDelayMs: 0 });
    const one = new AsyncQueue<ReturnType<typeof reactorMessage>>();
    const two = new AsyncQueue<ReturnType<typeof reactorMessage>>();
    one.send(reactorMessage('one'));
    two.send(reactorMessage('two'));
    const first = channel.observeReactor(one)[Symbol.asyncIterator]();
    const second = channel.observeReactor(two)[Symbol.asyncIterator]();
    return { service, channel, first, second };
}

describe('when the shared call fails', () => {
    it('should fail every open observer with the failure', async () => {
        const { service, first, second } = twoObservers();
        await until(() => service.calls[0]?.messages.length === 2);
        const failure = new Error('connection reset');

        service.calls[0].fail(failure);

        expect(await first.next().catch(error => error)).toBe(failure);
        expect(await second.next().catch(error => error)).toBe(failure);
    });

    it('should open a new call for an observer that registers again', async () => {
        const { service, channel, first } = twoObservers();
        await until(() => service.calls[0]?.messages.length === 2);
        service.calls[0].fail(new Error('connection reset'));
        await first.next().catch(() => undefined);

        const again = new AsyncQueue<ReturnType<typeof reactorMessage>>();
        again.send(reactorMessage('again'));
        const stream = channel.observeReactor(again)[Symbol.asyncIterator]();
        await until(() => service.calls[1]?.messages.length === 1);
        service.calls[1].reactor(service.calls[1].messages[0].StreamId, 1n, 'on-the-new-call');

        expect(service.calls).toHaveLength(2);
        expect((await nextOf(stream)).Partition).toBe('on-the-new-call');
    });
});

describe('when the shared call ends without an error', () => {
    it('should complete every open observer', async () => {
        const { service, first, second } = twoObservers();
        await until(() => service.calls[0]?.messages.length === 2);

        service.calls[0].complete();

        expect((await first.next()).done).toBe(true);
        expect((await second.next()).done).toBe(true);
    });
});

describe('when a stream delivers a message out of order', () => {
    it('should fail every observer of the call, because the kernel and the client no longer agree', async () => {
        const { service, first, second } = twoObservers();
        await until(() => service.calls[0]?.messages.length === 2);
        const [firstStream] = service.calls[0].messages.map(message => message.StreamId);

        service.calls[0].reactor(firstStream, 1n, 'a');
        service.calls[0].reactor(firstStream, 3n, 'gap');

        expect((await nextOf(first)).Partition).toBe('a');
        expect((await first.next().catch(error => error)).message).toContain('out of order');
        expect((await second.next().catch(error => error)).message).toContain('out of order');
        expect(service.calls[0].aborted).toBe(true);
    });
});

describe('when one observer is slow to handle what it was delivered', () => {
    it('should not hold up the deliveries of another', async () => {
        const { service, first, second } = twoObservers();
        await until(() => service.calls[0]?.messages.length === 2);
        const [firstStream, secondStream] = service.calls[0].messages.map(message => message.StreamId);

        // The first observer never reads; the second still gets all of its deliveries.
        service.calls[0].reactor(firstStream, 1n, 'unread-1');
        service.calls[0].reactor(firstStream, 2n, 'unread-2');
        for (let sequence = 1n; sequence <= 5n; sequence++) service.calls[0].reactor(secondStream, sequence, `fast-${sequence}`);

        const delivered: string[] = [];
        for (let count = 0; count < 5; count++) delivered.push((await nextOf(second)).Partition);
        expect(delivered).toEqual(['fast-1', 'fast-2', 'fast-3', 'fast-4', 'fast-5']);
        expect((await nextOf(first)).Partition).toBe('unread-1');
    });
});
