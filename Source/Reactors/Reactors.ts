// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { diag } from '@opentelemetry/api';
import { Constructor } from '@cratis/fundamentals';
import { ObservationState, ReactorMessage } from '@cratis/chronicle.contracts';
import { IClientArtifactsProvider } from '../artifacts';
import { ChronicleConnection } from '../connection';
import { ConnectionLifecycle } from '../connection/ConnectionLifecycle';
import { getEventTypeMetadata } from '../Events/eventTypeDecorator';
import { EventContext } from '../Events/EventContext';
import { EventTypeId } from '../Events/EventTypeId';
import { EventTypeGeneration } from '../Events/EventTypeGeneration';
import { EventSequenceId } from '../EventSequences/EventSequenceId';
import { IReactors } from './IReactors';
import { getReactorMetadata } from './reactor';

/** Expression used to partition reactor observations by event source ID. */
const EVENT_SOURCE_ID_KEY = '$eventSourceId';

/** Sentinel sequence number sent back when no event was successfully processed. */
const SEQUENCE_NUMBER_UNAVAILABLE = 4294967295;

interface EventTypeEntry {
    readonly id: string;
    readonly generation: number;
    readonly methodName: string;
}

/**
 * A push-based async queue that implements {@link AsyncIterable} for use with nice-grpc
 * bidirectional streaming. Values pushed via {@link send} are yielded in order to
 * any consumer that iterates the queue.
 */
class AsyncQueue<T> {
    private readonly _queue: T[] = [];
    private _resolve: ((result: IteratorResult<T, undefined>) => void) | undefined = undefined;
    private _done = false;

    /** Pushes a value into the queue. No-op if the queue has been completed. */
    send(value: T): void {
        if (this._done) return;
        if (this._resolve) {
            const resolve = this._resolve;
            this._resolve = undefined;
            resolve({ value, done: false });
        } else {
            this._queue.push(value);
        }
    }

    /** Signals that no more values will be pushed, causing consumers to finish iteration. */
    complete(): void {
        this._done = true;
        if (this._resolve) {
            this._resolve({ value: undefined, done: true });
            this._resolve = undefined;
        }
    }

    [Symbol.asyncIterator](): AsyncIterator<T, undefined> {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;
        return {
            next(): Promise<IteratorResult<T, undefined>> {
                if (self._queue.length > 0) {
                    return Promise.resolve({ value: self._queue.shift()!, done: false });
                }
                if (self._done) {
                    return Promise.resolve({ value: undefined, done: true });
                }
                return new Promise(resolve => {
                    self._resolve = resolve as (result: IteratorResult<T, undefined>) => void;
                });
            },
            return(): Promise<IteratorResult<T, undefined>> {
                self._done = true;
                if (self._resolve) {
                    self._resolve({ value: undefined, done: true });
                    self._resolve = undefined;
                }
                return Promise.resolve({ value: undefined, done: true });
            }
        };
    }
}

/**
 * Implements {@link IReactors}, managing discovery and registration of reactors
 * with the Chronicle Kernel via bidirectional gRPC streaming.
 */
export class Reactors implements IReactors {
    private readonly _logger = diag.createComponentLogger({ namespace: '@cratis/chronicle/Reactors' });
    private readonly _lifecycle: ConnectionLifecycle;
    private readonly _reactors = new Map<string, Constructor>();
    private readonly _queues = new Map<string, AsyncQueue<ReactorMessage>>();
    private _registered = false;

    /**
     * Creates a new {@link Reactors} instance.
     * @param _clientArtifacts - Provider for discovered client artifact types.
     * @param _connection - The Chronicle gRPC connection.
     * @param _eventStoreName - The name of the event store.
     * @param _namespace - The namespace within the event store.
     * @param lifecycle - The connection lifecycle used to react to disconnect events.
     */
    constructor(
        private readonly _clientArtifacts: IClientArtifactsProvider,
        private readonly _connection: ChronicleConnection,
        private readonly _eventStoreName: string,
        private readonly _namespace: string,
        lifecycle: ConnectionLifecycle
    ) {
        this._lifecycle = lifecycle;
        lifecycle.onDisconnected(async () => {
            this._logger.info('Disconnected — stopping all reactor observations');
            this._registered = false;
            this.disconnectAll();
        });
    }

    /** @inheritdoc */
    async discover(): Promise<void> {
        this._reactors.clear();
        for (const type of this._clientArtifacts.reactors) {
            const metadata = getReactorMetadata(type);
            if (metadata) {
                this._reactors.set(metadata.id.value, type);
                this._logger.debug('Discovered reactor', { reactorId: metadata.id.value, type: (type as Function).name });
            }
        }
    }

    /** @inheritdoc */
    async register(): Promise<void> {
        if (this._registered) {
            return;
        }

        if (this._reactors.size === 0) {
            await this.discover();
        }

        this._logger.info('Registering reactors', { count: this._reactors.size });
        for (const [id, reactorType] of this._reactors) {
            this.startObservation(id, reactorType);
        }

        this._registered = true;
    }

    private startObservation(id: string, reactorType: Constructor): void {
        const metadata = getReactorMetadata(reactorType)!;
        const eventSequenceId = metadata.eventSequenceId ?? EventSequenceId.eventLog.value;
        const eventTypes = this.getEventTypesFor(reactorType);

        this._logger.info('Starting reactor observation', {
            reactorId: id,
            eventSequenceId,
            handlerCount: eventTypes.length,
            handlers: eventTypes.map(e => e.methodName)
        });

        this.observeReactor(id, reactorType, eventSequenceId, eventTypes).catch(err => {
            this._logger.error('Reactor observation loop exited with error', { reactorId: id, error: String(err) });
        });
    }

    private async observeReactor(
        id: string,
        reactorType: Constructor,
        eventSequenceId: string,
        eventTypes: EventTypeEntry[]
    ): Promise<void> {
        const queue = new AsyncQueue<ReactorMessage>();
        this._queues.set(id, queue);

        queue.send({
            Content: {
                Value0: {
                    ConnectionId: this._lifecycle.connectionId,
                    EventStore: this._eventStoreName,
                    Namespace: this._namespace,
                    Reactor: {
                        ReactorId: id,
                        EventSequenceId: eventSequenceId,
                        EventTypes: eventTypes.map(et => ({
                            EventType: { Id: et.id, Generation: et.generation, Tombstone: false },
                            Key: EVENT_SOURCE_ID_KEY
                        })),
                        IsReplayable: false,
                        Tags: [],
                        Filters: {
                            FilterTags: [],
                            EventSourceType: '',
                            EventStreamType: 'All'
                        }
                    }
                },
                Value1: undefined
            }
        });

        try {
            const reactorInstance = new (reactorType as new () => Record<string, Function>)();

            for await (const eventsToObserve of this._connection.reactors.observe(queue)) {
                let lastSuccessfullyObservedEvent = SEQUENCE_NUMBER_UNAVAILABLE;
                let state = ObservationState.Success;
                const exceptionMessages: string[] = [];
                let exceptionStackTrace = '';

                this._logger.debug('Received events to observe', {
                    reactorId: id,
                    partition: eventsToObserve.Partition,
                    count: eventsToObserve.Events.length
                });

                for (const event of eventsToObserve.Events) {
                    try {
                        const eventTypeId = event.Context?.EventType?.Id;
                        if (!eventTypeId) {
                            this._logger.warn('Event missing event type context', { reactorId: id });
                            continue;
                        }

                        const entry = eventTypes.find(et => et.id === eventTypeId);
                        if (!entry) {
                            this._logger.debug('No handler registered for event type — skipping', { reactorId: id, eventTypeId });
                            lastSuccessfullyObservedEvent = event.Context!.SequenceNumber;
                            continue;
                        }

                        const content = JSON.parse(event.Content) as Record<string, unknown>;
                        const context: EventContext = {
                            sequenceNumber: event.Context!.SequenceNumber,
                            eventSourceId: event.Context!.EventSourceId,
                            eventType: {
                                id: new EventTypeId(event.Context!.EventType!.Id),
                                generation: new EventTypeGeneration(event.Context!.EventType!.Generation),
                                tombstone: event.Context!.EventType!.Tombstone
                            },
                            occurred: new Date(event.Context!.Occurred?.Value ?? ''),
                            correlationId: event.Context?.CorrelationId ? `${event.Context.CorrelationId.lo}-${event.Context.CorrelationId.hi}` : '',
                            causation: []
                        };

                        this._logger.info('Invoking reactor handler', {
                            reactorId: id,
                            method: entry.methodName,
                            sequenceNumber: event.Context!.SequenceNumber,
                            eventTypeId
                        });

                        await reactorInstance[entry.methodName](content, context);
                        lastSuccessfullyObservedEvent = event.Context!.SequenceNumber;
                    } catch (err) {
                        this._logger.error('Error handling event in reactor', { reactorId: id, error: String(err) });
                        exceptionMessages.push(String(err));
                        exceptionStackTrace = err instanceof Error ? (err.stack ?? '') : '';
                        state = ObservationState.Failed;
                        break;
                    }
                }

                queue.send({
                    Content: {
                        Value0: undefined,
                        Value1: {
                            Partition: eventsToObserve.Partition,
                            State: state,
                            LastSuccessfulObservation: lastSuccessfullyObservedEvent,
                            ExceptionMessages: exceptionMessages,
                            ExceptionStackTrace: exceptionStackTrace
                        }
                    }
                });
            }
        } catch (err) {
            if (!this._queues.has(id)) {
                this._logger.debug('Reactor observation stream closed cleanly', { reactorId: id });
            } else {
                this._logger.error('Reactor observation stream ended unexpectedly', { reactorId: id, error: String(err) });
            }
        } finally {
            this._queues.delete(id);
        }
    }

    private getEventTypesFor(reactorType: Constructor): EventTypeEntry[] {
        const proto = reactorType.prototype as Record<string, unknown>;
        const entries: EventTypeEntry[] = [];

        for (const eventTypeClass of this._clientArtifacts.eventTypes) {
            const eventTypeMeta = getEventTypeMetadata(eventTypeClass);
            if (!eventTypeMeta) continue;

            const className = (eventTypeClass as Function).name;
            const methodName = className.charAt(0).toLowerCase() + className.slice(1);

            if (typeof proto[methodName] === 'function') {
                entries.push({
                    id: eventTypeMeta.eventType.id.value,
                    generation: eventTypeMeta.eventType.generation.value,
                    methodName
                });
            }
        }

        return entries;
    }

    private disconnectAll(): void {
        for (const queue of this._queues.values()) {
            queue.complete();
        }
        this._queues.clear();
    }
}
