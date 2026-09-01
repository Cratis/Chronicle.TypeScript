// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { diag } from '@opentelemetry/api';
import { Constructor, Guid } from '@cratis/fundamentals';
import { ObservationState, ReadModelObserverType, ReducerMessage } from '@cratis/chronicle.contracts';
import { IClientArtifactsProvider } from '../artifacts';
import { ChronicleConnection } from '../connection';
import { toContractsGuid } from '../connection/Guid';
import { ConnectionLifecycle } from '../connection/ConnectionLifecycle';
import { getEventTypeMetadata } from '../events/eventTypeDecorator';
import { EventContext } from '../events/EventContext';
import { EventTypeId } from '../events/EventTypeId';
import { EventTypeGeneration } from '../events/EventTypeGeneration';
import { Tag } from '../events/Tag';
import { getTagsFor } from '../events/tagDecorator';
import { getFilterTagsFor } from '../events/filterEventsByTagDecorator';
import { EventSequenceId } from '../eventSequences/EventSequenceId';
import { notifyReplayLifecycle } from '../observation/notifyReplayLifecycle';
import { IReducers } from './IReducers';
import { getReducerMetadata } from './reducer';
import { getReadModelMetadata } from '../readModels';
import { JsonSchemaGenerator } from '../schemas';

/** Expression used to partition reducer observations by event source ID. */
const EVENT_SOURCE_ID_KEY = '$eventSourceId';

/** Sentinel sequence number sent back when no event was successfully processed. */
const SEQUENCE_NUMBER_UNAVAILABLE = 4294967295n;

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
    /** How long to wait before re-establishing an observation whose stream ended. */
    private static readonly _reobserveDelayMs = 2000;

    private readonly _logger = diag.createComponentLogger({ namespace: '@cratis/chronicle/reducers' });
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
     * @param _defaultSinkTypeId - The default sink type identifier used when registering read models.
     */
    constructor(
        private readonly _clientArtifacts: IClientArtifactsProvider,
        private readonly _connection: ChronicleConnection,
        private readonly _eventStoreName: string,
        private readonly _namespace: string,
        lifecycle: ConnectionLifecycle,
        private readonly _defaultSinkTypeId: string
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
            const readModelName = this.getReducerReadModelIdentifier(reducerType);
            return {
                Type: {
                    Identifier: readModelName,
                    Generation: 1
                },
                ContainerName: readModelName,
                DisplayName: readModelName,
                Sink: {
                    ConfigurationId: toContractsGuid(Guid.empty),
                    TypeId: this._defaultSinkTypeId
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
        const readModelName = this.getReducerReadModelIdentifier(reducerType);

        this._logger.info('Starting reducer observation', {
            reducerId: id,
            eventSequenceId,
            readModel: readModelName,
            handlerCount: eventTypes.length,
            handlers: eventTypes.map(e => e.methodName)
        });

        void this.runObservation(id, reducerType, eventSequenceId, eventTypes, readModelName);
    }

    private async runObservation(
        id: string,
        reducerType: Constructor,
        eventSequenceId: string,
        eventTypes: EventTypeEntry[],
        readModelName: string
    ): Promise<void> {
        try {
            await this.observeReducer(id, reducerType, eventSequenceId, eventTypes, readModelName);
        } catch (error) {
            this._logger.error('Reducer observation loop exited with error', { reducerId: id, error: String(error) });
        }

        this.scheduleReobserve(id, reducerType);
    }

    /**
     * Re-establishes an observation whose stream ended.
     *
     * The stream ending without an error is not proof that all is well — the kernel
     * closes a cross-store (inbox) observation's stream rather than tailing it
     * forever, so a reducer that does not re-subscribe there silently stops
     * observing until the whole client reconnects. Both endings are therefore
     * retried, and the delay keeps a stream that keeps ending from becoming a hot
     * loop.
     */
    private scheduleReobserve(id: string, reducerType: Constructor): void {
        // A disconnect clears the registration; the reconnect re-registers every
        // reducer from scratch, so retrying here as well would double up.
        if (!this._registered) {
            return;
        }

        const handle = setTimeout(() => {
            if (!this._registered) {
                return;
            }

            this._logger.info('Re-establishing reducer observation', { reducerId: id });
            this.startObservation(id, reducerType);
        }, Reducers._reobserveDelayMs);

        handle.unref?.();
    }

    private getReducerReadModelIdentifier(reducerType: Constructor): string {
        const metadata = getReducerMetadata(reducerType);
        if (metadata?.readModel) {
            return getReadModelMetadata(metadata.readModel)?.id.value ?? metadata.readModel.name;
        }

        return (reducerType as Function).name;
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
        const isActive = getReducerMetadata(reducerType)?.isActive ?? true;

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
                        IsActive: isActive,
                        Tags: getTagsFor(reducerType).map(t => t.value),
                        Filters: {
                            FilterTags: getFilterTagsFor(reducerType).map(t => t.value),
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
                    hasInitialState: operation.InitialState !== '',
                    replayState: operation.ReplayState
                });

                try {
                    await notifyReplayLifecycle(reducerInstance, operation.ReplayState, operation.Partition);
                } catch (err) {
                    this._logger.error('Error notifying reducer of replay lifecycle transition', { reducerId: id, error: String(err) });
                    exceptionMessages.push(String(err));
                    exceptionStackTrace = err instanceof Error ? (err.stack ?? '') : '';
                    state = ObservationState.Failed;
                }

                let currentState: unknown = operation.InitialState
                    ? JSON.parse(operation.InitialState) as unknown
                    : undefined;

                for (const event of state === ObservationState.Failed ? [] : operation.Events) {
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
                            causation: [],
                            tags: (event.Context!.Tags ?? []).map(value => new Tag(value))
                        };

                        this._logger.info('Invoking reducer handler', {
                            reducerId: id,
                            method: entry.methodName,
                            sequenceNumber: event.Context!.SequenceNumber.toString(),
                            eventTypeId,
                            hasState: currentState !== undefined
                        });

                        currentState = await reducerInstance[entry.methodName](content, currentState, context);
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
            // Only retire our own queue: a reconnect can already have replaced it,
            // and deleting the new one would leave that observation untracked and
            // leak a duplicate stream on every reconnect.
            if (this._queues.get(id) === queue) {
                this._queues.delete(id);
            }
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
