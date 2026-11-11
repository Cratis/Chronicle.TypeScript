// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { createLogger } from '../logging/createLogger.js';
import { runInBackgroundContext } from '../telemetry/runInBackgroundContext.js';
import { Constructor } from '@cratis/fundamentals';
import { EventGenerationDelivery, ReactorMessage } from '@cratis/chronicle.contracts';
import { IClientArtifactsProvider } from '../artifacts/index.js';
import { ChronicleConnection } from '../connection/index.js';
import { ConnectionLifecycle } from '../connection/ConnectionLifecycle.js';
import { getTagsFor } from '../events/tagDecorator.js';
import { getFilterTagsFor } from '../events/filterEventsByTagDecorator.js';
import { getEventSourceTypeFor } from '../events/eventSourceTypeDecorator.js';
import { getEventStreamTypeFor } from '../events/eventStreamTypeDecorator.js';
import { EventSequenceId } from '../eventSequences/EventSequenceId.js';
import type { IEventLog } from '../eventSequences/IEventLog.js';
import { createHandlerInstanceValidator } from '../observation/createHandlerInstanceValidator.js';
import { IReactors } from './IReactors.js';
import { getReactorMetadata } from './reactor.js';
import { isOnceOnly } from './onceOnly.js';
import { isStartAtTail } from './startAtTail.js';
import { getReactorBatchMethods, getReactorEventTypes } from './ReactorDispatcher.js';
import { ReactorPageDispatcher } from './ReactorPageDispatcher.js';
import { toPageDelivery } from '../observation/batches/batchSize.js';
import type { ReactorEventTypeEntry } from './ReactorDispatcher.js';
import type { ReactorResultHandler } from './ReactorResultHandler.js';
import type { ReactorServices } from './ReactorServices.js';
import type { IEventStore } from '../IEventStore.js';
import type { ClientArtifactsActivator } from '../artifacts/ClientArtifactsActivator.js';
import { refuseClientHostedObservers } from '../artifacts/refuseClientHostedObservers.js';
import { ObservationReconnectBackoff, type ObservationReconnectBackoffOptions } from '../observation/ObservationReconnectBackoff.js';
import { classifyStreamError, StreamErrorKind } from '../observation/classifyStreamError.js';

/** Expression used to partition reactor observations by event source ID. */
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
 * Implements {@link IReactors}, managing discovery and registration of reactors
 * with the Chronicle Kernel via bidirectional gRPC streaming.
 */
export class Reactors implements IReactors {
    private readonly _logger: ReturnType<typeof createLogger>;
    private readonly _lifecycle: ConnectionLifecycle;
    private readonly _unsubscribeDisconnected: () => void;
    private readonly _reactors = new Map<string, Constructor>();
    private readonly _queues = new Map<string, AsyncQueue<ReactorMessage>>();
    private readonly _observations = new Map<string, AbortController>();
    private readonly _reconnectBackoffs = new Map<string, ObservationReconnectBackoff>();
    private _registered = false;
    private _disposed = false;

    /**
     * Creates a new {@link Reactors} instance.
     * @param _clientArtifacts - Provider for discovered client artifact types.
     * @param _connection - The Chronicle gRPC connection.
     * @param _eventStoreName - The name of the event store.
     * @param _namespace - The namespace within the event store.
     * @param lifecycle - The connection lifecycle used to react to disconnect events.
     * @param _eventLog - The event log used to append side-effect events a reactor handler returns.
     * @param _resultHandler - Optional handler for values a reactor handler returns.
     * @param _eventStore - Optional event store handed to reactor handlers.
     * @param _artifactActivator - Optional activator creating reactor instances.
     * @param _skipKeepAlive - Whether the client runs without a keep-alive, which refuses client-hosted reactors.
     * @param _reconnectBackoff - How a reactor waits before opening its observation stream again after it ended.
     */
    constructor(
        private readonly _clientArtifacts: IClientArtifactsProvider,
        private readonly _connection: ChronicleConnection,
        private readonly _eventStoreName: string,
        private readonly _namespace: string,
        lifecycle: ConnectionLifecycle,
        private readonly _eventLog: IEventLog,
        private readonly _resultHandler?: ReactorResultHandler,
        private readonly _eventStore?: IEventStore,
        private readonly _artifactActivator?: ClientArtifactsActivator,
        private readonly _skipKeepAlive: boolean = false,
        private readonly _reconnectBackoff: ObservationReconnectBackoffOptions = {}
    ) {
        this._logger = createLogger('@cratis/chronicle/reactors', _connection.logger);
        this._lifecycle = lifecycle;
        this._unsubscribeDisconnected = lifecycle.onDisconnected(async () => {
            this._logger.info('Disconnected — stopping all reactor observations');
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
        if (this._skipKeepAlive) refuseClientHostedObservers({ reactors: this._clientArtifacts.reactors, reducers: [] });
        if (this._registered || this._disposed) {
            return;
        }

        if (this._reactors.size === 0) {
            await this.discover();
        }

        if (this._disposed) return;
        const registrations = [...this._reactors].map(([id, type]) => ({
            id, type, eventTypes: getReactorEventTypes(type, this._clientArtifacts.eventTypes),
            batchMethods: getReactorBatchMethods(type, this._clientArtifacts.eventTypes)
        })).map(registration => ({ ...registration, validateInstance: createHandlerInstanceValidator(registration.type, [
            ...registration.eventTypes.flatMap(entry => [entry.methodName, entry.replayMethodName].filter((name): name is string => !!name)),
            ...registration.batchMethods.map(method => method.methodName)
        ]) }));
        this._logger.info('Registering reactors', { count: this._reactors.size });
        for (const { id, type, eventTypes, validateInstance } of registrations) {
            this.startObservation(id, type, eventTypes, validateInstance);
        }

        this._registered = true;
    }

    private startObservation(id: string, reactorType: Constructor,
        eventTypes: ReactorEventTypeEntry[], validateInstance: (instance: object) => void): void {
        runInBackgroundContext(() => {
            if (this._disposed) return;
            const metadata = getReactorMetadata(reactorType)!;
            const eventSequenceId = metadata.eventSequenceId ?? EventSequenceId.eventLog.value;

            this._logger.info('Starting reactor observation', {
                reactorId: id,
                eventSequenceId,
                handlerCount: eventTypes.length,
                handlers: eventTypes.map(e => e.methodName)
            });

            void this.runObservation(id, reactorType, eventSequenceId, eventTypes, validateInstance);
        });
    }

    private async runObservation(
        id: string,
        reactorType: Constructor,
        eventSequenceId: string,
        eventTypes: ReactorEventTypeEntry[],
        validateInstance: (instance: object) => void
    ): Promise<void> {
        try {
            const sessionLost = await this.observeReactor(id, reactorType, eventSequenceId, eventTypes, validateInstance);
            if (sessionLost) return;
        } catch (error) {
            this._logger.error('Reactor observation loop exited with error', { reactorId: id, error });
        }

        this.scheduleReobserve(id, reactorType, eventTypes, validateInstance);
    }

    private reconnectBackoffFor(id: string): ObservationReconnectBackoff {
        let backoff = this._reconnectBackoffs.get(id);
        if (!backoff) {
            backoff = new ObservationReconnectBackoff(this._reconnectBackoff);
            this._reconnectBackoffs.set(id, backoff);
        }
        return backoff;
    }

    /**
     * Re-establishes an observation whose stream ended.
     *
     * The stream ending without an error is not proof that all is well — the kernel
     * closes a cross-store (inbox) reactor's stream rather than tailing it forever,
     * so a reactor that does not re-subscribe there silently stops observing until
     * the whole client reconnects. Both endings are therefore retried. The delay keeps
     * a stream that keeps ending from becoming a hot loop, and grows with jitter while
     * it does (see {@link ObservationReconnectBackoff}).
     */
    private scheduleReobserve(id: string, reactorType: Constructor, eventTypes: ReactorEventTypeEntry[], validateInstance: (instance: object) => void): void {
        // A disconnect clears the registration; the reconnect re-registers every
        // reactor from scratch, so retrying here as well would double up.
        if (!this._registered || this._disposed) {
            return;
        }

        const delayMs = this.reconnectBackoffFor(id).nextDelayMs();
        this._logger.debug('Waiting before re-establishing reactor observation', { reactorId: id, delayMs });
        const handle = runInBackgroundContext(() => setTimeout(() => {
            if (!this._registered || this._disposed) {
                return;
            }

            this._logger.info('Re-establishing reactor observation', { reactorId: id });
            this.startObservation(id, reactorType, eventTypes, validateInstance);
        }, delayMs));

        handle.unref?.();
    }

    private async observeReactor(
        id: string,
        reactorType: Constructor,
        eventSequenceId: string,
        eventTypes: ReactorEventTypeEntry[],
        validateInstance: (instance: object) => void
    ): Promise<boolean> {
        const batchMethods = getReactorBatchMethods(reactorType, this._clientArtifacts.eventTypes);
        const queue = new AsyncQueue<ReactorMessage>();
        const controller = new AbortController();
        this._queues.set(id, queue);
        this._observations.set(id, controller);
        const connectionId = this._lifecycle.connectionId;
        const backoff = this.reconnectBackoffFor(id);
        backoff.streamOpened();

        queue.send({
            Content: {
                Value0: {
                    ConnectionId: connectionId,
                    EventStore: this._eventStoreName,
                    Namespace: this._namespace,
                    Reactor: {
                        ReactorId: id,
                        EventSequenceId: eventSequenceId,
                        EventTypes: [...eventTypes, ...batchMethods.flatMap(method => [...method.eventTypes.values()])].map(et => ({
                            EventType: { Id: et.id, Generation: et.generation, Tombstone: false },
                            Key: EVENT_SOURCE_ID_KEY
                        })),
                        IsReplayable: !isOnceOnly(reactorType),
                        IsNotReplayable: isOnceOnly(reactorType),
                        StartAtTail: isStartAtTail(reactorType),
                        GenerationDelivery: EventGenerationDelivery.Compatibility,
                        Tags: getTagsFor(reactorType).map(t => t.value),
                        Filters: {
                            FilterTags: getFilterTagsFor(reactorType).map(t => t.value),
                            EventSourceType: getEventSourceTypeFor(reactorType),
                            EventStreamType: getEventStreamTypeFor(reactorType)
                        }
                    },
                    PageDelivery: toPageDelivery(reactorType)
                },
                Value1: undefined
            }
        });

        try {
            const reactorInstance = this._artifactActivator ? undefined : new (reactorType as new () => Record<string, Function>)();
            if (reactorInstance) validateInstance(reactorInstance);
            const services: ReactorServices | undefined = this._eventStore && {
                eventStore: this._eventStore, readModels: this._eventStore.readModels, signal: controller.signal
            };

            const dispatcher = new ReactorPageDispatcher({
                id, reactorType, eventSequenceId, eventStoreName: this._eventStoreName, namespace: this._namespace,
                entries: eventTypes, batchMethods, validateInstance, reactorInstance, services, signal: controller.signal,
                eventLog: this._eventLog, resultHandler: this._resultHandler, artifactActivator: this._artifactActivator,
                logger: this._logger, connectionLogger: this._connection.logger
            });

            for await (const eventsToObserve of this._connection.reactors.observe(queue, { signal: controller.signal })) {
                backoff.streamDelivered();
                const result = await dispatcher.dispatch(eventsToObserve);
                queue.send({ Content: { Value0: undefined, Value1: result } });
            }
        } catch (err) {
            if (!this._queues.has(id)) {
                this._logger.debug('Reactor observation stream closed cleanly', { reactorId: id });
            } else if (classifyStreamError(err) === StreamErrorKind.SessionLost) {
                // The kernel lost this client's registration. Opening the same stream with the same connection id
                // can never work, so reconnect the whole client, which re-registers every reactor.
                this._logger.warn('Reactor observation stream lost its session; reconnecting the client', { reactorId: id, error: err });
                if (connectionId === this._lifecycle.connectionId) this._lifecycle.requestReconnect('reactor-session-lost', err);
                return true;
            } else {
                this._logger.error('Reactor observation stream ended unexpectedly', { reactorId: id, error: err });
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

        return false;
    }

    private disconnectAll(): void {
        for (const controller of this._observations.values()) controller.abort();
        for (const queue of this._queues.values()) queue.complete();
        this._observations.clear();
        this._queues.clear();
    }
}
