// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { diag } from '@opentelemetry/api';
import { Constructor } from '@cratis/fundamentals';
import { EventObservationState, ObservationState, ReactorMessage, ReplayState } from '@cratis/chronicle.contracts';
import { IClientArtifactsProvider } from '../artifacts/index.js';
import { ChronicleConnection } from '../connection/index.js';
import { ConnectionLifecycle } from '../connection/ConnectionLifecycle.js';
import { getEventTypeMetadata } from '../events/eventTypeDecorator.js';
import { toClientEventContext } from '../events/toClientEventContext.js';
import { getTagsFor } from '../events/tagDecorator.js';
import { getFilterTagsFor } from '../events/filterEventsByTagDecorator.js';
import { EventSequenceId } from '../eventSequences/EventSequenceId.js';
import type { IEventLog } from '../eventSequences/IEventLog.js';
import { notifyReplayLifecycle } from '../observation/notifyReplayLifecycle.js';
import { IReactors } from './IReactors.js';
import { dispatchReactorSideEffects } from './ReactorSideEffects.js';
import { getReactorMetadata } from './reactor.js';
import { isOnceOnly } from './onceOnly.js';
import { getReplayEventType } from './replay.js';
import type { ReactorResultHandler } from './ReactorResultHandler.js';
import type { ReactorServices } from './ReactorServices.js';
import type { IEventStore } from '../IEventStore.js';
import type { ClientArtifactsActivator } from '../artifacts/ClientArtifactsActivator.js';
import type { ActivatedArtifact } from '../artifacts/ActivatedArtifact.js';
import { ArtifactKind } from '../artifacts/ArtifactKind.js';
import { ArtifactDelivery } from '../artifacts/ArtifactDelivery.js';
import { withActivatedArtifact, runActivated } from '../artifacts/withActivatedArtifact.js';

/** Expression used to partition reactor observations by event source ID. */
const EVENT_SOURCE_ID_KEY = '$eventSourceId';

/** Sentinel sequence number sent back when no event was successfully processed. */
const SEQUENCE_NUMBER_UNAVAILABLE = 4294967295n;

interface EventTypeEntry {
    readonly id: string;
    readonly generation: number;
    readonly methodName?: string;
    readonly replayMethodName?: string;
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
    /** How long to wait before re-establishing an observation whose stream ended. */
    private static readonly _reobserveDelayMs = 2000;

    private readonly _logger = diag.createComponentLogger({ namespace: '@cratis/chronicle/reactors' });
    private readonly _lifecycle: ConnectionLifecycle;
    private readonly _reactors = new Map<string, Constructor>();
    private readonly _queues = new Map<string, AsyncQueue<ReactorMessage>>();
    private readonly _observations = new Map<string, AbortController>();
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
        private readonly _artifactActivator?: ClientArtifactsActivator
    ) {
        this._lifecycle = lifecycle;
        lifecycle.onDisconnected(async () => {
            this._logger.info('Disconnected — stopping all reactor observations');
            this._registered = false;
            this.disconnectAll();
        });
    }

    /** Stops observations permanently when the owning client is disposed. */
    dispose(): void {
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
        if (this._registered || this._disposed) {
            return;
        }

        if (this._reactors.size === 0) {
            await this.discover();
        }

        if (this._disposed) return;
        this._logger.info('Registering reactors', { count: this._reactors.size });
        for (const [id, reactorType] of this._reactors) {
            this.startObservation(id, reactorType);
        }

        this._registered = true;
    }

    private startObservation(id: string, reactorType: Constructor): void {
        if (this._disposed) return;
        const metadata = getReactorMetadata(reactorType)!;
        const eventSequenceId = metadata.eventSequenceId ?? EventSequenceId.eventLog.value;
        const eventTypes = this.getEventTypesFor(reactorType);

        this._logger.info('Starting reactor observation', {
            reactorId: id,
            eventSequenceId,
            handlerCount: eventTypes.length,
            handlers: eventTypes.map(e => e.methodName)
        });

        void this.runObservation(id, reactorType, eventSequenceId, eventTypes);
    }

    private async runObservation(
        id: string,
        reactorType: Constructor,
        eventSequenceId: string,
        eventTypes: EventTypeEntry[]
    ): Promise<void> {
        try {
            await this.observeReactor(id, reactorType, eventSequenceId, eventTypes);
        } catch (error) {
            this._logger.error('Reactor observation loop exited with error', { reactorId: id, error: String(error) });
        }

        this.scheduleReobserve(id, reactorType);
    }

    /**
     * Re-establishes an observation whose stream ended.
     *
     * The stream ending without an error is not proof that all is well — the kernel
     * closes a cross-store (inbox) reactor's stream rather than tailing it forever,
     * so a reactor that does not re-subscribe there silently stops observing until
     * the whole client reconnects. Both endings are therefore retried, and the delay
     * keeps a stream that keeps ending from becoming a hot loop.
     */
    private scheduleReobserve(id: string, reactorType: Constructor): void {
        // A disconnect clears the registration; the reconnect re-registers every
        // reactor from scratch, so retrying here as well would double up.
        if (!this._registered || this._disposed) {
            return;
        }

        const handle = setTimeout(() => {
            if (!this._registered || this._disposed) {
                return;
            }

            this._logger.info('Re-establishing reactor observation', { reactorId: id });
            this.startObservation(id, reactorType);
        }, Reactors._reobserveDelayMs);

        handle.unref?.();
    }

    private async observeReactor(
        id: string,
        reactorType: Constructor,
        eventSequenceId: string,
        eventTypes: EventTypeEntry[]
    ): Promise<void> {
        const queue = new AsyncQueue<ReactorMessage>();
        const controller = new AbortController();
        this._queues.set(id, queue);
        this._observations.set(id, controller);

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
                        IsReplayable: !isOnceOnly(reactorType),
                        Tags: getTagsFor(reactorType).map(t => t.value),
                        Filters: {
                            FilterTags: getFilterTagsFor(reactorType).map(t => t.value),
                            EventSourceType: '',
                            EventStreamType: 'All'
                        }
                    }
                },
                Value1: undefined
            }
        });

        try {
            const reactorInstance = this._artifactActivator ? undefined : new (reactorType as new () => Record<string, Function>)();
            const services: ReactorServices | undefined = this._eventStore && {
                eventStore: this._eventStore, readModels: this._eventStore.readModels, signal: controller.signal
            };

            for await (const eventsToObserve of this._connection.reactors.observe(queue, { signal: controller.signal })) {
                let lastSuccessfullyObservedEvent = SEQUENCE_NUMBER_UNAVAILABLE;
                let state = ObservationState.Success;
                const exceptionMessages: string[] = [];
                let exceptionStackTrace = '';

                this._logger.debug('Received events to observe', {
                    reactorId: id,
                    partition: eventsToObserve.Partition,
                    count: eventsToObserve.Events.length,
                    replayState: eventsToObserve.ReplayState
                });

                try {
                    if (this._artifactActivator && eventsToObserve.ReplayState !== ReplayState.REPLAY_STATE_None) {
                        if (!services) throw new Error('Reactor activation requires the owning event store.');
                        await withActivatedArtifact(reactorType, {
                            kind: ArtifactKind.Reactor, artifactId: id, eventStore: services.eventStore,
                            readModels: services.readModels, eventSequenceId, partition: eventsToObserve.Partition,
                            signal: controller.signal, delivery: ArtifactDelivery.ReplayNotification,
                            replayState: eventsToObserve.ReplayState
                        }, this._artifactActivator, artifact => runActivated(artifact, () =>
                            notifyReplayLifecycle(artifact.instance, eventsToObserve.ReplayState, eventsToObserve.Partition)));
                    } else if (reactorInstance) {
                        await notifyReplayLifecycle(reactorInstance, eventsToObserve.ReplayState, eventsToObserve.Partition);
                    }
                } catch (err) {
                    this._logger.error('Error notifying reactor of replay lifecycle transition', { reactorId: id, error: String(err) });
                    exceptionMessages.push(String(err));
                    exceptionStackTrace = err instanceof Error ? (err.stack ?? '') : '';
                    state = ObservationState.Failed;
                }

                const selectHandler = (event: typeof eventsToObserve.Events[number]) => {
                    const entry = eventTypes.find(candidate => candidate.id === event.Context?.EventType?.Id);
                    if (!entry) return undefined;
                    const isReplay = (event.Context!.ObservationState & EventObservationState.Replay) !== 0;
                    const methodName = isReplay ? (entry.replayMethodName ?? entry.methodName) : entry.methodName;
                    const method = methodName ? (reactorInstance?.[methodName] ?? (reactorType.prototype as Record<string, Function>)[methodName]) : undefined;
                    return { methodName, isReplay, skipReplay: isReplay && method !== undefined && isOnceOnly(method) };
                };

                const processEvents = async (artifact: ActivatedArtifact<Record<string, Function>>) => {
                    for (const event of state === ObservationState.Failed ? [] : eventsToObserve.Events) {
                        try {
                            const eventTypeId = event.Context?.EventType?.Id;
                            if (!eventTypeId) {
                                this._logger.warn('Event missing event type context', { reactorId: id });
                                continue;
                            }

                            const selection = selectHandler(event);
                            if (!selection) {
                                this._logger.debug('No reactor handler found', { reactorId: id, eventTypeId });
                                lastSuccessfullyObservedEvent = event.Context!.SequenceNumber;
                                continue;
                            }

                            const { methodName, isReplay, skipReplay } = selection;
                            if (!methodName || skipReplay) {
                                if (skipReplay) {
                                    this._logger.debug('Reactor handler skipped for replay', { reactorId: id, eventTypeId, method: methodName });
                                } else {
                                    this._logger.debug('No reactor handler found', { reactorId: id, eventTypeId, isReplay });
                                }
                                lastSuccessfullyObservedEvent = event.Context!.SequenceNumber;
                                continue;
                            }

                            const content = JSON.parse(event.Content) as Record<string, unknown>;
                            this._logger.debug('Event content', { reactorId: id, eventTypeId, contentKeys: Object.keys(content), rawContent: event.Content.substring(0, 200) });
                            const context = toClientEventContext(event.Context!);

                            this._logger.info('Invoking reactor handler', {
                                reactorId: id,
                                method: methodName,
                                sequenceNumber: event.Context!.SequenceNumber.toString(),
                                eventTypeId
                            });

                            await runActivated(artifact, async () => {
                                const handlerResult = await artifact.instance[methodName](content, context, services);
                                await dispatchReactorSideEffects(this._eventLog, handlerResult, context, reactorType as Function,
                                    this._eventStoreName, this._namespace, this._resultHandler);
                            });

                            lastSuccessfullyObservedEvent = event.Context!.SequenceNumber;
                        } catch (err) {
                            this._logger.error('Error handling event in reactor', { reactorId: id, error: String(err) });
                            exceptionMessages.push(String(err));
                            exceptionStackTrace = err instanceof Error ? (err.stack ?? '') : '';
                            state = ObservationState.Failed;
                            break;
                        }
                    }
                };

                const firstInvocableEvent = this._artifactActivator && state === ObservationState.Success
                    ? eventsToObserve.Events.find(event => {
                        const selection = selectHandler(event);
                        return !!selection?.methodName && !selection.skipReplay;
                    }) : undefined;
                if (firstInvocableEvent && this._artifactActivator) {
                    try {
                        if (!services) throw new Error('Reactor activation requires the owning event store.');
                        await withActivatedArtifact(reactorType as new () => Record<string, Function>, {
                            kind: ArtifactKind.Reactor, artifactId: id, eventStore: services.eventStore,
                            readModels: services.readModels, eventSequenceId, partition: eventsToObserve.Partition,
                            signal: controller.signal, delivery: ArtifactDelivery.Events,
                            eventContext: toClientEventContext(firstInvocableEvent.Context!)
                        }, this._artifactActivator, processEvents);
                    } catch (err) {
                        this._logger.error('Error activating reactor', { reactorId: id, error: String(err) });
                        exceptionMessages.push(String(err));
                        exceptionStackTrace = err instanceof Error ? (err.stack ?? '') : '';
                        state = ObservationState.Failed;
                    }
                } else {
                    await processEvents({ instance: reactorInstance ?? {} });
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

    private getEventTypesFor(reactorType: Constructor): EventTypeEntry[] {
        const proto = reactorType.prototype as Record<string, unknown>;
        const entries: EventTypeEntry[] = [];
        const replayHandlers = new Map<string, string>();
        const eventTypes = new Map<string, { eventTypeClass: Function; id: string; generation: number }>();

        for (const eventTypeClass of this._clientArtifacts.eventTypes) {
            const metadata = getEventTypeMetadata(eventTypeClass);
            if (metadata) {
                eventTypes.set((eventTypeClass as Function).name, {
                    eventTypeClass: eventTypeClass as Function,
                    id: metadata.eventType.id.value,
                    generation: metadata.eventType.generation.value
                });
            }
        }

        // A derived method shadows a base method of the same name, even if it is not marked for replay.
        const seenMethods = new Set<string>();
        for (let current = proto; current && current !== Object.prototype; current = Object.getPrototypeOf(current) as Record<string, unknown>) {
            for (const name of Object.getOwnPropertyNames(current)) {
                if (seenMethods.has(name)) continue;
                seenMethods.add(name);
                const method = current[name];
                if (typeof method !== 'function') continue;
                const replayEventType = getReplayEventType(method);
                if (replayEventType === undefined) continue;

                const eventType = replayEventType === true
                    ? eventTypes.get(name.startsWith('replay') ? name.slice('replay'.length) : '')
                    : [...eventTypes.values()].find(candidate => candidate.eventTypeClass === replayEventType);
                if (!eventType) {
                    throw new Error(`Replay handler '${name}' on reactor '${(reactorType as Function).name}' has no registered event type.`);
                }
                if (replayHandlers.has(eventType.id)) {
                    throw new Error(`Reactor '${(reactorType as Function).name}' has multiple replay handlers for event type '${eventType.id}': '${replayHandlers.get(eventType.id)}' and '${name}'.`);
                }
                replayHandlers.set(eventType.id, name);
            }
        }

        for (const [className, eventType] of eventTypes) {
            const methodName = className.charAt(0).toLowerCase() + className.slice(1);
            const liveMethod = proto[methodName];
            const liveMethodName = typeof liveMethod === 'function' && getReplayEventType(liveMethod) === undefined ? methodName : undefined;
            const replayMethodName = replayHandlers.get(eventType.id);
            if (liveMethodName || replayMethodName) {
                entries.push({
                    id: eventType.id,
                    generation: eventType.generation,
                    methodName: liveMethodName,
                    replayMethodName
                });
            }
        }

        return entries;
    }

    private disconnectAll(): void {
        for (const controller of this._observations.values()) controller.abort();
        for (const queue of this._queues.values()) queue.complete();
        this._observations.clear();
        this._queues.clear();
    }
}
