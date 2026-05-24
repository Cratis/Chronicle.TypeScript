// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { diag } from '@opentelemetry/api';
import { Constructor } from '@cratis/fundamentals';
import { ObservationState, ReadModelObserverType, ReducerMessage } from '@cratis/chronicle.contracts';
import { IClientArtifactsProvider } from '../artifacts';
import { ChronicleConnection } from '../connection';
import { toContractsGuid } from '../connection/Guid';
import { ConnectionLifecycle } from '../connection/ConnectionLifecycle';
import { getEventTypeMetadata } from '../Events/eventTypeDecorator';
import { EventSequenceId } from '../EventSequences/EventSequenceId';
import { WellKnownSinks } from '../sinks';
import { IReducers } from './IReducers';
import { getReducerMetadata } from './reducer';
import { getReadModelMetadata } from '../ReadModels';
import { JsonSchemaGenerator } from '../Schemas';

/** Expression used to partition reducer observations by event source ID. */
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
 * Implements {@link IReducers}, managing discovery and registration of reducers
 * with the Chronicle Kernel via bidirectional gRPC streaming.
 */
export class Reducers implements IReducers {
    private readonly _logger = diag.createComponentLogger({ namespace: '@cratis/chronicle/Reducers' });
    private readonly _lifecycle: ConnectionLifecycle;
    private readonly _reducers = new Map<string, Constructor>();
    private readonly _queues = new Map<string, AsyncQueue<ReducerMessage>>();
    private _registered = false;

    /**
     * Creates a new {@link Reducers} instance.
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
            this._logger.info('Disconnected — stopping all reducer observations');
            this._registered = false;
            this.disconnectAll();
        });
    }

    /** @inheritdoc */
    async discover(): Promise<void> {
        this._reducers.clear();
        for (const type of this._clientArtifacts.reducers) {
            const metadata = getReducerMetadata(type);
            if (metadata) {
                this._reducers.set(metadata.id.value, type);
                this._logger.debug('Discovered reducer', { reducerId: metadata.id.value, type: (type as Function).name });
            }
        }
    }

    /** @inheritdoc */
    async register(): Promise<void> {
        if (this._registered) {
            return;
        }

        if (this._reducers.size === 0) {
            await this.discover();
        }

        await this.registerReadModels();

        this._logger.info('Registering reducers', { count: this._reducers.size });
        for (const [id, reducerType] of this._reducers) {
            this.startObservation(id, reducerType);
        }

        this._registered = true;
    }

    private async registerReadModels(): Promise<void> {
        if (this._reducers.size === 0) {
            return;
        }

        const readModels = Array.from(this._reducers.entries()).map(([id, reducerType]) => {
            const readModelName = (reducerType as Function).name;
            return {
                Type: {
                    Identifier: readModelName,
                    Generation: 1
                },
                ContainerName: readModelName,
                DisplayName: readModelName,
                Sink: {
                    ConfigurationId: toContractsGuid(WellKnownSinks.Null),
                    TypeId: toContractsGuid(WellKnownSinks.MongoDB)
                },
                Schema: this.getReducerSchema(reducerType, readModelName),
                Indexes: [],
                ObserverType: ReadModelObserverType.Reducer,
                ObserverIdentifier: id,
                Owner: 1,
                Source: 1
            };
        });

        this._logger.info('Registering read models for reducers', { count: readModels.length });
        await this._connection.readModels.registerMany({
            EventStore: this._eventStoreName,
            Owner: 1,
            ReadModels: readModels,
            Source: 1
        });
    }

    private getReducerSchema(reducerType: Constructor, readModelName: string): string {
        const metadata = getReducerMetadata(reducerType);
        if (metadata?.readModel) {
            const readModelMeta = getReadModelMetadata(metadata.readModel);
            if (readModelMeta?.schema) {
                return JSON.stringify(readModelMeta.schema);
            }
            // No @readModel() decorator — generate from instance
            return JSON.stringify(JsonSchemaGenerator.generate(metadata.readModel));
        }

        // No read model type declared — generate from a minimal schema
        const minimalSchema = {
            ...JsonSchemaGenerator.createEmptySchema(readModelName),
            additionalProperties: true
        };
        return JSON.stringify(minimalSchema);
    }

    private startObservation(id: string, reducerType: Constructor): void {
        const metadata = getReducerMetadata(reducerType)!;
        const eventSequenceId = metadata.eventSequenceId ?? EventSequenceId.eventLog.value;
        const eventTypes = this.getEventTypesFor(reducerType);
        const readModelName = (reducerType as Function).name;

        this._logger.info('Starting reducer observation', {
            reducerId: id,
            eventSequenceId,
            readModel: readModelName,
            handlerCount: eventTypes.length,
            handlers: eventTypes.map(e => e.methodName)
        });

        this.observeReducer(id, reducerType, eventSequenceId, eventTypes, readModelName).catch(err => {
            this._logger.error('Reducer observation loop exited with error', { reducerId: id, error: String(err) });
        });
    }

    private async observeReducer(
        id: string,
        reducerType: Constructor,
        eventSequenceId: string,
        eventTypes: EventTypeEntry[],
        readModelName: string
    ): Promise<void> {
        const queue = new AsyncQueue<ReducerMessage>();
        this._queues.set(id, queue);

        queue.send({
            Content: {
                Value0: {
                    ConnectionId: this._lifecycle.connectionId,
                    EventStore: this._eventStoreName,
                    Namespace: this._namespace,
                    Reducer: {
                        ReducerId: id,
                        EventSequenceId: eventSequenceId,
                        EventTypes: eventTypes.map(et => ({
                            EventType: { Id: et.id, Generation: et.generation, Tombstone: false },
                            Key: EVENT_SOURCE_ID_KEY
                        })),
                        ReadModel: readModelName,
                        IsActive: true,
                        Sink: {
                            TypeId: toContractsGuid(WellKnownSinks.MongoDB),
                            ConfigurationId: toContractsGuid(WellKnownSinks.Null)
                        },
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
            const reducerInstance = new (reducerType as new () => Record<string, Function>)();

            for await (const operation of this._connection.reducers.observe(queue)) {
                let lastSuccessfullyObservedEvent = SEQUENCE_NUMBER_UNAVAILABLE;
                let state = ObservationState.Success;
                const exceptionMessages: string[] = [];
                let exceptionStackTrace = '';
                let readModelState: string | undefined;

                this._logger.debug('Received reduce operation', {
                    reducerId: id,
                    partition: operation.Partition,
                    count: operation.Events.length,
                    hasInitialState: operation.InitialState !== ''
                });

                let currentState: unknown = operation.InitialState
                    ? JSON.parse(operation.InitialState) as unknown
                    : undefined;

                for (const event of operation.Events) {
                    try {
                        const eventTypeId = event.Context?.EventType?.Id;
                        if (!eventTypeId) {
                            this._logger.warn('Event missing event type context', { reducerId: id });
                            continue;
                        }

                        const entry = eventTypes.find(et => et.id === eventTypeId);
                        if (!entry) {
                            this._logger.debug('No handler registered for event type — skipping', { reducerId: id, eventTypeId });
                            lastSuccessfullyObservedEvent = event.Context!.SequenceNumber;
                            continue;
                        }

                        const content = JSON.parse(event.Content) as Record<string, unknown>;

                        this._logger.info('Invoking reducer handler', {
                            reducerId: id,
                            method: entry.methodName,
                            sequenceNumber: event.Context!.SequenceNumber,
                            eventTypeId,
                            hasState: currentState !== undefined
                        });

                        currentState = await reducerInstance[entry.methodName](content, currentState);
                        lastSuccessfullyObservedEvent = event.Context!.SequenceNumber;
                    } catch (err) {
                        this._logger.error('Error handling event in reducer', { reducerId: id, error: String(err) });
                        exceptionMessages.push(String(err));
                        exceptionStackTrace = err instanceof Error ? (err.stack ?? '') : '';
                        state = ObservationState.Failed;
                        break;
                    }
                }

                if (state === ObservationState.Success && currentState !== undefined) {
                    readModelState = JSON.stringify(currentState);
                }

                queue.send({
                    Content: {
                        Value0: undefined,
                        Value1: {
                            Partition: operation.Partition,
                            State: state,
                            LastSuccessfulObservation: lastSuccessfullyObservedEvent,
                            ExceptionMessages: exceptionMessages,
                            ExceptionStackTrace: exceptionStackTrace,
                            ReadModelState: readModelState ?? ''
                        }
                    }
                });
            }
        } catch (err) {
            if (!this._queues.has(id)) {
                this._logger.debug('Reducer observation stream closed cleanly', { reducerId: id });
            } else {
                this._logger.error('Reducer observation stream ended unexpectedly', { reducerId: id, error: String(err) });
            }
        } finally {
            this._queues.delete(id);
        }
    }

    private getEventTypesFor(reducerType: Constructor): EventTypeEntry[] {
        const proto = reducerType.prototype as Record<string, unknown>;
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
