// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { createLogger } from '../logging/createLogger.js';
import { runInBackgroundContext } from '../telemetry/runInBackgroundContext.js';
import { Constructor } from '@cratis/fundamentals';
import { AppendedEvent, ReadModelObserverType, ReduceOperationMessage, ReducerMessage, ReplayState } from '@cratis/chronicle.contracts';
import { IClientArtifactsProvider } from '../artifacts/index.js';
import { ChronicleConnection } from '../connection/index.js';
import { ConnectionLifecycle } from '../connection/ConnectionLifecycle.js';
import { toClientEventContext } from '../events/toClientEventContext.js';
import { getTagsFor } from '../events/tagDecorator.js';
import { getFilterTagsFor } from '../events/filterEventsByTagDecorator.js';
import { getEventSourceTypeFor } from '../events/eventSourceTypeDecorator.js';
import { getEventStreamTypeFor } from '../events/eventStreamTypeDecorator.js';
import { EventSequenceId } from '../eventSequences/EventSequenceId.js';
import { notifyReplayLifecycle } from '../observation/notifyReplayLifecycle.js';
import { IReducers } from './IReducers.js';
import { getReducerMetadata } from './reducer.js';
import { ReducerEventDispatcher } from './ReducerEventDispatcher.js';
import { ReducerObservation } from './ReducerObservation.js';
import { ReducerObservationSession } from './ReducerObservationSession.js';
import { ReductionOutcome } from './ReductionOutcome.js';
import { getReadModelMetadata } from '../readModels/index.js';
import { getReadModelId } from '../readModels/readModel.js';
import { buildReadModelDefinition } from '../readModels/buildReadModelDefinition.js';
import type { ReadModelNamingPolicy } from '../readModels/ReadModelNamingPolicy.js';
import { assertUniqueReadModelIds } from '../readModels/assertUniqueReadModelIds.js';
import { JsonSchemaGenerator } from '../schemas/index.js';
import type { IEventStore } from '../IEventStore.js';
import type { ClientArtifactsActivator } from '../artifacts/ClientArtifactsActivator.js';
import type { ActivatedArtifact } from '../artifacts/ActivatedArtifact.js';
import { ArtifactKind } from '../artifacts/ArtifactKind.js';
import { ArtifactDelivery } from '../artifacts/ArtifactDelivery.js';
import { withActivatedArtifact, runActivated } from '../artifacts/withActivatedArtifact.js';

/** Expression used to partition reducer observations by event source ID. */
const EVENT_SOURCE_ID_KEY = '$eventSourceId';

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

    private readonly _logger: ReturnType<typeof createLogger>;
    private readonly _lifecycle: ConnectionLifecycle;
    private readonly _unsubscribeDisconnected: () => void;
    private readonly _reducers = new Map<string, Constructor>();
    private readonly _queues = new Map<string, AsyncQueue<ReducerMessage>>();
    private readonly _observations = new Map<string, AbortController>();
    private _registered = false;
    private _disposed = false;

    /**
     * Creates a new {@link Reducers} instance.
     * @param _clientArtifacts - Provider for discovered client artifact types.
     * @param _connection - The Chronicle gRPC connection.
     * @param _eventStoreName - The name of the event store.
     * @param _namespace - The namespace within the event store.
     * @param lifecycle - The connection lifecycle used to react to disconnect events.
     * @param _defaultSinkTypeId - The default sink type identifier used when registering read models.
     * @param _eventStore - The event store handed to reducers that request it.
     * @param _artifactActivator - Optional per-delivery activator.
     * @param _readModelNamingPolicy - Optional policy naming the container of each read model.
     */
    constructor(
        private readonly _clientArtifacts: IClientArtifactsProvider,
        private readonly _connection: ChronicleConnection,
        private readonly _eventStoreName: string,
        private readonly _namespace: string,
        lifecycle: ConnectionLifecycle,
        private readonly _defaultSinkTypeId: string,
        private readonly _eventStore?: IEventStore,
        private readonly _artifactActivator?: ClientArtifactsActivator,
        private readonly _readModelNamingPolicy?: ReadModelNamingPolicy
    ) {
        this._logger = createLogger('@cratis/chronicle/reducers', _connection.logger);
        this._lifecycle = lifecycle;
        this._unsubscribeDisconnected = lifecycle.onDisconnected(async () => {
            this._logger.info('Disconnected — stopping all reducer observations');
            this._registered = false;
            this.disconnectAll();
        });
    }

    /** Stops observations permanently when the owning client is disposed. */
    dispose(): void {
        this._unsubscribeDisconnected();
        this._disposed = true;
        this._registered = false;
        this.disconnectAll();
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
        if (this._registered || this._disposed) {
            return;
        }

        if (this._reducers.size === 0) {
            await this.discover();
        }

        const registrations = [...this._reducers].map(([id, type]) => ({
            id, type, dispatcher: new ReducerEventDispatcher(type, this._clientArtifacts.eventTypes)
        }));
        assertUniqueReadModelIds(this._clientArtifacts.readModels);
        await this.registerReadModels();

        if (this._disposed) return;
        this._logger.info('Registering reducers', { count: this._reducers.size });
        for (const { id, type, dispatcher } of registrations) {
            this.startObservation(id, type, dispatcher);
        }

        this._registered = true;
    }

    private async registerReadModels(): Promise<void> {
        if (this._reducers.size === 0) {
            return;
        }

        const readModels = Array.from(this._reducers.entries()).map(([id, reducerType]) => {
            const readModelName = this.getReducerReadModelIdentifier(reducerType);
            return buildReadModelDefinition({
                identifier: readModelName,
                type: getReducerMetadata(reducerType)?.readModel,
                schema: this.getReducerSchema(reducerType, readModelName),
                sinkTypeId: this._defaultSinkTypeId,
                observerType: ReadModelObserverType.Reducer,
                observerIdentifier: id,
                namingPolicy: this._readModelNamingPolicy
            });
        });

        const identifiers = new Set<string>();
        for (const definition of readModels) {
            const identifier = definition.Type.Identifier;
            if (identifiers.has(identifier)) throw new Error(`Read model id '${identifier}' has multiple reducers.`);
            identifiers.add(identifier);
        }
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
            // Generate the schema directly from the inferred model type.
            return JSON.stringify(JsonSchemaGenerator.generate(metadata.readModel));
        }

        // No read model type declared — generate from a minimal schema
        const minimalSchema = {
            ...JsonSchemaGenerator.createEmptySchema(readModelName),
            additionalProperties: true
        };
        return JSON.stringify(minimalSchema);
    }

    private startObservation(id: string, reducerType: Constructor,
        dispatcher: ReducerEventDispatcher): void {
        runInBackgroundContext(() => {
            if (this._disposed) return;
            const metadata = getReducerMetadata(reducerType)!;
            const eventSequenceId = metadata.eventSequenceId ?? EventSequenceId.eventLog.value;
            const readModelName = this.getReducerReadModelIdentifier(reducerType);

            this._logger.info('Starting reducer observation', {
                reducerId: id,
                eventSequenceId,
                readModel: readModelName,
                handlerCount: dispatcher.handlers.length,
                handlers: dispatcher.handlers.map(e => e.methodName)
            });

            void this.runObservation({ id, reducerType, eventSequenceId, readModelName, dispatcher });
        });
    }

    private async runObservation(observation: ReducerObservation): Promise<void> {
        try {
            await this.observeReducer(observation);
        } catch (error) {
            this._logger.error('Reducer observation loop exited with error', { reducerId: observation.id, error });
        }

        this.scheduleReobserve(observation.id, observation.reducerType, observation.dispatcher);
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
    private scheduleReobserve(id: string, reducerType: Constructor, dispatcher: ReducerEventDispatcher): void {
        // A disconnect clears the registration; the reconnect re-registers every
        // reducer from scratch, so retrying here as well would double up.
        if (!this._registered || this._disposed) {
            return;
        }

        const handle = runInBackgroundContext(() => setTimeout(() => {
            if (!this._registered || this._disposed) {
                return;
            }

            this._logger.info('Re-establishing reducer observation', { reducerId: id });
            this.startObservation(id, reducerType, dispatcher);
        }, Reducers._reobserveDelayMs));

        handle.unref?.();
    }

    private getReducerReadModelIdentifier(reducerType: Constructor): string {
        const metadata = getReducerMetadata(reducerType);
        if (metadata?.readModel) {
            return getReadModelId(metadata.readModel);
        }

        return (reducerType as Function).name;
    }

    private async observeReducer(observation: ReducerObservation): Promise<void> {
        const { id, reducerType } = observation;
        const queue = new AsyncQueue<ReducerMessage>();
        const controller = new AbortController();
        this._queues.set(id, queue);
        this._observations.set(id, controller);

        queue.send(this.createRegistrationMessage(observation));

        try {
            const reducerInstance = this._artifactActivator ? undefined : new (reducerType as new () => Record<string, Function>)();
            if (reducerInstance) observation.dispatcher.validateInstance(reducerInstance);
            const session: ReducerObservationSession = { ...observation, signal: controller.signal, reducerInstance };

            for await (const operation of this._connection.reducers.observe(queue, { signal: controller.signal })) {
                queue.send(await this.reduce(session, operation));
            }
        } catch (err) {
            if (!this._queues.has(id)) {
                this._logger.debug('Reducer observation stream closed cleanly', { reducerId: id });
            } else {
                this._logger.error('Reducer observation stream ended unexpectedly', { reducerId: id, error: err });
            }
        } finally {
            // Only retire our own queue: a reconnect can already have replaced it,
            // and deleting the new one would leave that observation untracked and
            // leak a duplicate stream on every reconnect.
            if (this._queues.get(id) === queue) {
                this._queues.delete(id);
                this._observations.delete(id);
            }
            queue.complete();
        }
    }

    private createRegistrationMessage({ id, reducerType, eventSequenceId, readModelName, dispatcher }: ReducerObservation): ReducerMessage {
        return {
            Content: {
                Value0: {
                    ConnectionId: this._lifecycle.connectionId,
                    EventStore: this._eventStoreName,
                    Namespace: this._namespace,
                    Reducer: {
                        ReducerId: id,
                        EventSequenceId: eventSequenceId,
                        EventTypes: dispatcher.handlers.map(et => ({
                            EventType: { Id: et.id, Generation: et.generation, Tombstone: false },
                            Key: EVENT_SOURCE_ID_KEY
                        })),
                        ReadModel: readModelName,
                        Hash: '',
                        IsActive: getReducerMetadata(reducerType)?.isActive ?? true,
                        Tags: getTagsFor(reducerType).map(t => t.value),
                        Filters: {
                            FilterTags: getFilterTagsFor(reducerType).map(t => t.value),
                            EventSourceType: getEventSourceTypeFor(reducerType),
                            EventStreamType: getEventStreamTypeFor(reducerType)
                        }
                    }
                },
                Value1: undefined
            }
        };
    }

    private async reduce(session: ReducerObservationSession, operation: ReduceOperationMessage): Promise<ReducerMessage> {
        const outcome = new ReductionOutcome();

        this._logger.debug('Received reduce operation', {
            reducerId: session.id,
            count: operation.Events.length,
            hasInitialState: operation.InitialState !== '',
            replayState: operation.ReplayState
        });

        await this.notifyReplayTransition(session, operation, outcome);

        outcome.currentState = operation.InitialState
            ? JSON.parse(operation.InitialState) as unknown
            : undefined;

        await this.reduceEvents(session, operation, outcome);

        return outcome.toMessage(operation.Partition);
    }

    private async notifyReplayTransition(
        session: ReducerObservationSession,
        operation: ReduceOperationMessage,
        outcome: ReductionOutcome
    ): Promise<void> {
        try {
            if (this._artifactActivator && operation.ReplayState !== ReplayState.REPLAY_STATE_None) {
                await this.notifyActivatedReplayTransition(session, operation, this._artifactActivator);
            } else if (session.reducerInstance) {
                await notifyReplayLifecycle(session.reducerInstance, operation.ReplayState, operation.Partition);
            }
        } catch (err) {
            this._logger.error('Error notifying reducer of replay lifecycle transition', { reducerId: session.id, error: err });
            outcome.recordReplayNotificationFailure(err);
        }
    }

    private async notifyActivatedReplayTransition(
        { id, reducerType, eventSequenceId, dispatcher, signal }: ReducerObservationSession,
        operation: ReduceOperationMessage,
        activator: ClientArtifactsActivator
    ): Promise<void> {
        const eventStore = this.requireEventStore();
        await withActivatedArtifact(reducerType, {
            kind: ArtifactKind.Reducer, artifactId: id, eventStore,
            readModels: eventStore.readModels, eventSequenceId, partition: operation.Partition,
            signal, delivery: ArtifactDelivery.ReplayNotification,
            replayState: operation.ReplayState
        }, activator, artifact => {
            dispatcher.validateInstance(artifact.instance);
            return runActivated(artifact, () =>
                notifyReplayLifecycle(artifact.instance, operation.ReplayState, operation.Partition),
                { delivery: ArtifactDelivery.ReplayNotification, replayState: operation.ReplayState });
        }, this._connection.logger);
    }

    private requireEventStore(): IEventStore {
        if (!this._eventStore) throw new Error('Reducer activation requires the owning event store.');
        return this._eventStore;
    }

    private async reduceEvents(
        session: ReducerObservationSession,
        operation: ReduceOperationMessage,
        outcome: ReductionOutcome
    ): Promise<void> {
        const { id, reducerType, eventSequenceId, dispatcher, signal, reducerInstance } = session;
        const firstInvocableEvent = this._artifactActivator && !outcome.failed
            ? operation.Events.find(event =>
                !!event.Context?.EventType?.Id && !!dispatcher.handlerFor(event.Context.EventType.Id))
            : undefined;
        if (!firstInvocableEvent || !this._artifactActivator) {
            await this.processEvents(session, operation, outcome, { instance: reducerInstance ?? {} });
            return;
        }

        try {
            const eventStore = this.requireEventStore();
            await withActivatedArtifact(reducerType as new () => Record<string, Function>, {
                kind: ArtifactKind.Reducer, artifactId: id, eventStore,
                readModels: eventStore.readModels, eventSequenceId, partition: operation.Partition,
                signal, delivery: ArtifactDelivery.Events,
                eventContext: toClientEventContext(firstInvocableEvent.Context!)
            }, this._artifactActivator, artifact => {
                dispatcher.validateInstance(artifact.instance);
                return this.processEvents(session, operation, outcome, artifact);
            }, this._connection.logger);
        } catch (err) {
            this._logger.error('Error activating reducer', { reducerId: id, error: err });
            outcome.recordActivationFailure(err);
        }
    }

    private async processEvents(
        session: ReducerObservationSession,
        operation: ReduceOperationMessage,
        outcome: ReductionOutcome,
        artifact: ActivatedArtifact<Record<string, Function>>
    ): Promise<void> {
        for (const event of outcome.failed ? [] : operation.Events) {
            try {
                // Skipped events stay synchronous; only an actual handler invocation is awaited.
                const pending = this.processEvent(session, event, outcome, artifact);
                if (pending) await pending;
            } catch (err) {
                this._logger.error('Error handling event in reducer', { reducerId: session.id, error: err });
                outcome.recordFailure(err);
                break;
            }
        }
    }

    private processEvent(
        { id, dispatcher }: ReducerObservationSession,
        event: AppendedEvent,
        outcome: ReductionOutcome,
        artifact: ActivatedArtifact<Record<string, Function>>
    ): Promise<void> | undefined {
        const eventTypeId = event.Context?.EventType?.Id;
        if (!eventTypeId) {
            this._logger.warn('Event missing event type context', { reducerId: id });
            return;
        }

        const entry = dispatcher.handlerFor(eventTypeId);
        if (!entry) {
            this._logger.debug('No handler registered for event type — skipping', { reducerId: id, eventTypeId });
            outcome.lastSuccessfullyObservedEvent = event.Context!.SequenceNumber;
            return;
        }

        const content = JSON.parse(event.Content) as Record<string, unknown>;
        const context = toClientEventContext(event.Context!);

        this._logger.info('Invoking reducer handler', {
            reducerId: id,
            method: entry.methodName,
            sequenceNumber: event.Context!.SequenceNumber.toString(),
            eventTypeId,
            hasState: outcome.currentState !== undefined
        });

        return this.invokeHandler(
            () => runActivated(artifact, () => dispatcher.invoke(artifact.instance, entry, content, outcome.currentState, context),
                { delivery: ArtifactDelivery.Events, eventContext: context, methodName: entry.methodName }),
            outcome,
            event.Context!.SequenceNumber);
    }

    private async invokeHandler(invoke: () => Promise<unknown>, outcome: ReductionOutcome, sequenceNumber: bigint): Promise<void> {
        outcome.currentState = await invoke();
        outcome.lastSuccessfullyObservedEvent = sequenceNumber;
    }

    private disconnectAll(): void {
        for (const controller of this._observations.values()) controller.abort();
        for (const queue of this._queues.values()) queue.complete();
        this._observations.clear();
        this._queues.clear();
    }
}
