// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { MultiplexedServerMessage, type MultiplexedClientMessage, type MultiplexedStreamMessage, type ReactorMessage, type ReducerMessage } from '@cratis/chronicle.contracts';
import type { IMultiplexedObservationService } from '../../MultiplexedObservationChannel.js';
import { StreamBuffer } from '../../StreamBuffer.js';

/** One call the channel opened on the fake service, which the specification drives like a kernel would. */
export class FakeCall {
    readonly writes: MultiplexedClientMessage[] = [];
    readonly responses: AsyncIterable<MultiplexedServerMessage>;
    aborted = false;
    private readonly _buffer = new StreamBuffer<MultiplexedServerMessage>();

    constructor(request: AsyncIterable<MultiplexedClientMessage>, signal: AbortSignal | undefined) {
        void (async () => { for await (const write of request) this.writes.push(write); })();
        signal?.addEventListener('abort', () => {
            this.aborted = true;
            this._buffer.fail(Object.assign(new Error('cancelled'), { name: 'AbortError' }));
        });
        this.responses = { [Symbol.asyncIterator]: () => StreamBuffer.iterate(this._buffer, item => item, () => {}) };
    }

    /** Every stream message written so far, in order. */
    get messages(): MultiplexedStreamMessage[] { return this.writes.flatMap(write => write.Messages); }

    /** Delivers a reactor payload to a stream. */
    reactor(streamId: bigint, sequence: bigint, partition: string): void {
        this._buffer.push(MultiplexedServerMessage.fromPartial({ StreamId: streamId, Sequence: sequence, Reactor: { Partition: partition } }));
    }

    /** Delivers a reducer payload to a stream. */
    reducer(streamId: bigint, sequence: bigint, partition: string): void {
        this._buffer.push(MultiplexedServerMessage.fromPartial({ StreamId: streamId, Sequence: sequence, Reducer: { Partition: partition } }));
    }

    /** Ends a stream, with a status code, as the kernel does. */
    end(streamId: bigint, sequence: bigint, statusCode = 0, detail = ''): void {
        this._buffer.push(MultiplexedServerMessage.fromPartial({ StreamId: streamId, Sequence: sequence, End: { StatusCode: statusCode, Detail: detail } }));
    }

    /** Fails the whole call. */
    fail(error: unknown): void { this._buffer.fail(error); }

    /** Ends the whole call without an error. */
    complete(): void { this._buffer.complete(); }
}

/** A multiplexed observation service that records the calls it is given. */
export class FakeMultiplexedService implements IMultiplexedObservationService {
    readonly calls: FakeCall[] = [];

    observe(request: AsyncIterable<MultiplexedClientMessage>, options?: { signal?: AbortSignal }): AsyncIterable<MultiplexedServerMessage> {
        const call = new FakeCall(request, options?.signal);
        this.calls.push(call);
        return call.responses;
    }
}

/** A message a reactor sends up, which the channel passes on without looking inside. */
export const reactorMessage = (marker: string): ReactorMessage => ({ marker } as unknown as ReactorMessage);

/** A message a reducer sends up, which the channel passes on without looking inside. */
export const reducerMessage = (marker: string): ReducerMessage => ({ marker } as unknown as ReducerMessage);

/** Waits until a condition holds, failing after a second. */
export async function until(condition: () => boolean): Promise<void> {
    const deadline = Date.now() + 1000;
    while (!condition()) {
        if (Date.now() > deadline) throw new Error('The condition did not hold within a second.');
        await new Promise(resolve => setTimeout(resolve, 1));
    }
}

/** Reads the next item of an iterator. */
export async function nextOf<T>(iterator: AsyncIterator<T>): Promise<T> {
    const result = await iterator.next();
    if (result.done) throw new Error('The stream ended.');
    return result.value;
}
