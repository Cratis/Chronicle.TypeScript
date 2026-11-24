// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import {
    MultiplexedObserverKind,
    type EventsToObserve,
    type MultiplexedClientMessage,
    type MultiplexedServerMessage,
    type MultiplexedStreamMessage,
    type ReactorMessage,
    type ReduceOperationMessage,
    type ReducerMessage
} from '@cratis/chronicle.contracts';
import { ClientError, type Status } from 'nice-grpc-common';
import { createLogger } from '../../logging/createLogger.js';
import type { IChronicleLogger } from '../../logging/IChronicleLogger.js';
import { StreamBuffer } from './StreamBuffer.js';

/** The full name of the RPC every multiplexed stream shares, used when a stream ends with a status. */
const observePath = '/Cratis.Chronicle.Contracts.Observation.Multiplexed.MultiplexedObservation/Observe';

/** The part of the multiplexed observation service the channel needs, so it can be exercised without a kernel. */
export interface IMultiplexedObservationService {
    /** Opens the one bidirectional call every observer of the connection shares. */
    observe(request: AsyncIterable<MultiplexedClientMessage>, options?: { signal?: AbortSignal }): AsyncIterable<MultiplexedServerMessage>;
}

/** Tuning of how the channel batches what it writes to the shared call. */
export interface MultiplexedObservationChannelOptions {
    /** How long in milliseconds to wait for companions before writing what is ready. Defaults to 10, as the .NET client. */
    coalesceDelayMs?: number;

    /** The most stream messages one write carries. Defaults to 500, as the .NET client. */
    maxMessagesPerWrite?: number;
}

/** Options for opening one stream. */
export interface ObserveStreamOptions {
    /** Aborted to close the stream; its iterator then fails with an abort error, like a cancelled per-observer call. */
    signal?: AbortSignal;
}

const abortError = (): Error => Object.assign(new Error('The multiplexed observation stream was cancelled.'), { name: 'AbortError' });

const sleep = (milliseconds: number): Promise<void> => new Promise(resolve => setTimeout(resolve, milliseconds));

/** A queue of stream messages written to the shared call, in order, that a writer can wait on. */
class Outbound {
    private readonly _messages: MultiplexedStreamMessage[] = [];
    private _wake: (() => void) | undefined;
    private _completed = false;

    get completed(): boolean { return this._completed; }
    get count(): number { return this._messages.length; }

    send(message: MultiplexedStreamMessage): void {
        if (this._completed) return;
        this._messages.push(message);
        this.wakeWriter();
    }

    complete(): void {
        this._completed = true;
        this.wakeWriter();
    }

    /** Resolves once there is something to write, or the queue is completed. */
    async waitToRead(): Promise<boolean> {
        while (this._messages.length === 0) {
            if (this._completed) return false;
            await new Promise<void>(resolve => { this._wake = resolve; });
        }
        return true;
    }

    take(max: number): MultiplexedStreamMessage[] {
        return this._messages.splice(0, max);
    }

    private wakeWriter(): void {
        const wake = this._wake;
        this._wake = undefined;
        wake?.();
    }
}

/** One observer's side of the shared call: its inbound sequence check and its own ordered delivery buffer. */
class ClientStream {
    readonly buffer = new StreamBuffer<MultiplexedServerMessage>();
    private _sequence = 0n;

    /** Accepts a message only when it directly follows the previous one of this stream. */
    accept(message: MultiplexedServerMessage): boolean {
        if (BigInt(message.Sequence) !== this._sequence + 1n) return false;
        this._sequence = BigInt(message.Sequence);
        return true;
    }
}

/** The one bidirectional call shared by every stream opened on it, until it fails, ends or its last stream is gone. */
class SharedCall {
    private readonly _streams = new Map<bigint, ClientStream>();
    private readonly _outbound = new Outbound();
    private readonly _controller = new AbortController();
    private readonly _logger: ReturnType<typeof createLogger>;
    private _ended = false;

    constructor(
        private readonly _service: IMultiplexedObservationService,
        private readonly _options: Required<MultiplexedObservationChannelOptions>,
        private readonly _release: (call: SharedCall) => void,
        logger: ReturnType<typeof createLogger>
    ) {
        this._logger = logger;
        void this.run();
    }

    get ended(): boolean { return this._ended; }

    add(streamId: bigint, stream: ClientStream): void {
        if (this._ended) {
            stream.buffer.fail(new Error('The multiplexed observation connection ended before the stream opened.'));
            return;
        }
        this._streams.set(streamId, stream);
    }

    send(streamId: bigint, message: MultiplexedStreamMessage): void {
        this._outbound.send({ ...message, StreamId: streamId });
    }

    close(streamId: bigint): void {
        if (!this._streams.delete(streamId)) return;
        this._outbound.send({ StreamId: streamId, Kind: MultiplexedObserverKind.Unspecified, Close: true, Reactor: undefined, Reducer: undefined });
        if (this._streams.size === 0) this.end(undefined);
    }

    private async run(): Promise<void> {
        try {
            for await (const message of this._service.observe(this.writes(), { signal: this._controller.signal })) {
                this.receive(message);
                if (this._ended) return;
            }
            this.end(undefined);
        } catch (error) {
            this.end(error);
        }
    }

    private async *writes(): AsyncGenerator<MultiplexedClientMessage> {
        while (await this._outbound.waitToRead()) {
            if (this._options.coalesceDelayMs > 0) await sleep(this._options.coalesceDelayMs);
            const messages = this._outbound.take(this._options.maxMessagesPerWrite);
            if (messages.length === 0) continue;
            this._logger.debug('Writing multiplexed observation messages', { count: messages.length });
            yield { Messages: messages };
        }
    }

    private receive(message: MultiplexedServerMessage): void {
        const streamId = BigInt(message.StreamId);
        const stream = this._streams.get(streamId);
        if (!stream) return;
        if (!stream.accept(message)) {
            this._logger.warn('A multiplexed observation stream delivered a message out of order', { streamId: Number(streamId), sequence: Number(message.Sequence) });
            this.end(new Error(`The multiplexed observation stream ${streamId} delivered message ${message.Sequence} out of order.`));
            return;
        }
        if (!message.End) {
            stream.buffer.push(message);
            return;
        }
        this._streams.delete(streamId);
        if (message.End.StatusCode === 0) {
            stream.buffer.complete();
        } else {
            stream.buffer.fail(new ClientError(observePath, message.End.StatusCode as Status, message.End.Detail));
        }
    }

    private end(error: unknown): void {
        if (this._ended) return;
        this._ended = true;
        const streams = [...this._streams.values()];
        this._streams.clear();
        this._release(this);
        this._outbound.complete();
        this._controller.abort();
        this._logger.debug('Multiplexed observation connection ended', { streams: streams.length, error });
        for (const stream of streams) {
            if (error === undefined) stream.buffer.complete();
            else stream.buffer.fail(error);
        }
    }
}

/**
 * Carries every reactor and reducer observation of a connection over one bidirectional call, instead of one call each.
 *
 * Each observer is a stream with an id the client chooses. The call is opened with the first stream, shared by the
 * ones that follow and closed with the last. When it fails or ends, every open stream fails or completes, which sends
 * each observer through its usual reconnect, and the next stream opens a new call.
 */
export class MultiplexedObservationChannel {
    private readonly _options: Required<MultiplexedObservationChannelOptions>;
    private readonly _logger: ReturnType<typeof createLogger>;
    private _current: SharedCall | undefined;
    private _nextStreamId = 0n;

    /**
     * Creates a new {@link MultiplexedObservationChannel}.
     * @param _service - The kernel's multiplexed observation service.
     * @param options - How writes are batched.
     * @param logger - The application log sink.
     */
    constructor(private readonly _service: IMultiplexedObservationService, options: MultiplexedObservationChannelOptions = {}, logger?: IChronicleLogger) {
        this._options = { coalesceDelayMs: options.coalesceDelayMs ?? 10, maxMessagesPerWrite: options.maxMessagesPerWrite ?? 500 };
        this._logger = createLogger('@cratis/chronicle/MultiplexedObservationChannel', logger);
    }

    /**
     * Observes a reactor on its own stream of the shared call. The first message is its registration.
     * @param messages - What the reactor sends the kernel; ending it closes the stream.
     * @param options - The {@link ObserveStreamOptions}.
     * @returns What the kernel delivers to the reactor.
     */
    observeReactor(messages: AsyncIterable<ReactorMessage>, options: ObserveStreamOptions = {}): AsyncIterable<EventsToObserve> {
        return this.open(MultiplexedObserverKind.Reactor, messages, (message, kind) => ({ Kind: kind, Reactor: message } as MultiplexedStreamMessage),
            server => server.Reactor as EventsToObserve | undefined, options);
    }

    /**
     * Observes a reducer on its own stream of the shared call. The first message is its registration.
     * @param messages - What the reducer sends the kernel; ending it closes the stream.
     * @param options - The {@link ObserveStreamOptions}.
     * @returns What the kernel delivers to the reducer.
     */
    observeReducer(messages: AsyncIterable<ReducerMessage>, options: ObserveStreamOptions = {}): AsyncIterable<ReduceOperationMessage> {
        return this.open(MultiplexedObserverKind.Reducer, messages, (message, kind) => ({ Kind: kind, Reducer: message } as MultiplexedStreamMessage),
            server => server.Reducer as ReduceOperationMessage | undefined, options);
    }

    private open<TIn, TOut>(kind: MultiplexedObserverKind, messages: AsyncIterable<TIn>,
        toStreamMessage: (message: TIn, kind: MultiplexedObserverKind) => MultiplexedStreamMessage,
        payload: (server: MultiplexedServerMessage) => TOut | undefined, options: ObserveStreamOptions): AsyncIterable<TOut> {
        const channel = this;
        return {
            [Symbol.asyncIterator](): AsyncIterator<TOut> {
                const { signal } = options;
                const stream = new ClientStream();
                if (signal?.aborted) {
                    stream.buffer.fail(abortError());
                    return StreamBuffer.iterate(stream.buffer, payload, () => {});
                }
                if (!channel._current || channel._current.ended) channel._current = new SharedCall(channel._service, channel._options, call => channel.release(call), channel._logger);
                const call = channel._current;
                const streamId = ++channel._nextStreamId;
                call.add(streamId, stream);
                channel._logger.debug('Opening multiplexed observation stream', { streamId: Number(streamId), kind: MultiplexedObserverKind[kind] });

                let closed = false;
                function close() {
                    if (closed) return;
                    closed = true;
                    signal?.removeEventListener('abort', onAbort);
                    call.close(streamId);
                }
                function onAbort() {
                    close();
                    stream.buffer.fail(abortError());
                }
                signal?.addEventListener('abort', onAbort, { once: true });
                void channel.pump(messages, kind, streamId, call, toStreamMessage, close);
                return StreamBuffer.iterate(stream.buffer, payload, close);
            }
        };
    }

    private async pump<TIn>(messages: AsyncIterable<TIn>, kind: MultiplexedObserverKind, streamId: bigint, call: SharedCall,
        toStreamMessage: (message: TIn, kind: MultiplexedObserverKind) => MultiplexedStreamMessage, close: () => void): Promise<void> {
        let first = true;
        try {
            for await (const message of messages) {
                call.send(streamId, toStreamMessage(message, first ? kind : MultiplexedObserverKind.Unspecified));
                first = false;
            }
        } catch (error) {
            this._logger.warn('The messages of a multiplexed observation stream failed', { streamId: Number(streamId), error });
        } finally {
            close();
        }
    }

    private release(call: SharedCall): void {
        if (this._current === call) this._current = undefined;
    }
}
