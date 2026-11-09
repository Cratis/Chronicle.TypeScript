// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { AsyncLocalStorage } from 'node:async_hooks';
import type { Constructor } from '@cratis/fundamentals';
import { DefaultClientArtifactsProvider } from '../artifacts/DefaultClientArtifactsProvider.js';
import { TypeDiscoverer } from '../types/TypeDiscoverer.js';
import { ArtifactDelivery } from '../artifacts/ArtifactDelivery.js';
import { ArtifactKind } from '../artifacts/ArtifactKind.js';
import type { ActivatedArtifact } from '../artifacts/ActivatedArtifact.js';
import { withActivatedArtifact } from '../artifacts/withActivatedArtifact.js';
import type { AppendedEvent } from '../events/AppendedEvent.js';
import type { EventContext } from '../events/EventContext.js';
import { getEventTypeMetadata } from '../events/eventTypeDecorator.js';
import { getFilterTagsFor } from '../events/filterEventsByTagDecorator.js';
import { mergeNamedTags } from '../events/mergeNamedTags.js';
import { getEventSourceTypeFor } from '../events/eventSourceTypeDecorator.js';
import { getDeclaredEventStreamTypeFor, getEventStreamTypeFor } from '../events/eventStreamTypeDecorator.js';
import type { IEventLog } from '../eventSequences/IEventLog.js';
import type { EventForEventSourceId } from '../eventSequences/EventForEventSourceId.js';
import type { AppendOptions } from '../eventSequences/AppendOptions.js';
import { ensureNamedTagBatchIsSupported } from '../eventSequences/ensureNamedTagBatchIsSupported.js';
import { EventStoreName } from '../EventStoreName.js';
import { EventStoreNamespaceName } from '../EventStoreNamespaceName.js';
import type { IEventStore } from '../IEventStore.js';
import type { IReadModels } from '../readModels/IReadModels.js';
import { getReactorBatchMethods, getReactorEventTypes, invokeReactorHandler, selectReactorHandler } from '../reactors/ReactorDispatcher.js';
import { createHandlerInstanceValidator } from '../observation/createHandlerInstanceValidator.js';
import { getReactorMetadata } from '../reactors/reactor.js';
import { normalizeReactorSideEffects } from '../reactors/ReactorSideEffects.js';
import type { ReactorServices } from '../reactors/ReactorServices.js';
import { ReactorDelivery } from '../reactors/ReactorDelivery.js';
import { EventScenario } from './EventScenario.js';
import type { ReactorDeliveryResult } from './ReactorDeliveryResult.js';
import type { ReactorScenarioOptions } from './ReactorScenarioOptions.js';
import type { RecordedReactorSideEffect } from './RecordedReactorSideEffect.js';
import { observeUnsupportedOperations } from './InProcessEventSequence.js';
import { UnsupportedEventSequenceOperation } from './UnsupportedEventSequenceOperation.js';
import { UnsupportedReactorOperation } from './UnsupportedReactorOperation.js';
import type { BatchMethod } from '../observation/batches/BatchMethod.js';
import { BatchOutcomeKind } from '../observation/batches/BatchOutcomeKind.js';
import type { BatchPartitionOutcome } from './BatchPartitionOutcome.js';
import { deliverToBatchMethods } from './deliverToBatchMethods.js';

/** Live, ordered reactor deliveries over the fixture-proven EventScenario event boundary. */
export class ReactorScenario {
    readonly given: ReactorScenarioPhase;
    readonly when: ReactorScenarioPhase;
    private readonly _events: EventScenario;
    private readonly _entries: ReturnType<typeof getReactorEventTypes>;
    private readonly _batchMethods: readonly BatchMethod[];
    private readonly _batchEventTypeIds: ReadonlySet<string>;
    private readonly _partitionOutcomes: BatchPartitionOutcome[] = [];
    private readonly _eventTypes: readonly Constructor[];
    private readonly _instance?: Record<string, Function>;
    private readonly _validateInstance: (instance: object) => void;
    private readonly _store: IEventStore;
    private readonly _controller = new AbortController();
    private readonly _effects: RecordedReactorSideEffect[] = [];
    private readonly _results: ReactorDeliveryResult[] = [];
    private _busy = false;
    private _failed = false;
    // Unsupported calls are attributed only to the delivery that is running when they happen.
    private _delivery?: { violation?: Error };
    private readonly _deliveryContext = new AsyncLocalStorage<{ violation?: Error }>();
    private _deliveryIndex = 0;

    constructor(private readonly _reactor: Constructor, private readonly _options: ReactorScenarioOptions = {}) {
        const metadata = getReactorMetadata(_reactor);
        if (!metadata) throw new UnsupportedReactorOperation('reactor', _reactor.name, 'A registered @reactor is required.');
        if ((metadata.eventSequenceId ?? 'event-log') !== 'event-log') {
            throw new UnsupportedReactorOperation('reactor.eventSequenceId', _reactor.name, 'Only the default event log is fixture-backed.');
        }
        if (getFilterTagsFor(_reactor).length) {
            throw new UnsupportedReactorOperation('reactor.filterEventsByTag', _reactor.name, 'Tag-filtered delivery is not fixture-backed.');
        }
        if (getEventSourceTypeFor(_reactor) !== '') {
            throw new UnsupportedReactorOperation('reactor.eventSourceType', _reactor.name, 'Source-type-filtered delivery is not fixture-backed.');
        }
        if (getEventStreamTypeFor(_reactor) !== 'All') {
            throw new UnsupportedReactorOperation('reactor.eventStreamType', _reactor.name, 'Stream-type-filtered delivery is not fixture-backed.');
        }
        if (_options.commandTypes?.length) {
            throw new UnsupportedReactorOperation('options.commandTypes', _reactor.name, 'Command classification belongs to the explicit-composition increment.');
        }
        // Resolve the selected or discovered catalog once; preserve getter-backed constraints and migrations.
        const artifacts = _options.artifacts ?? new DefaultClientArtifactsProvider(TypeDiscoverer.default);
        const constraints = artifacts.constraints;
        // EventScenario rejects an explicitly selected empty catalog, but allows empty default discovery.
        const selectedConstraints = !_options.artifacts && constraints?.length === 0 ? undefined : constraints;
        const eventTypeMigrations = artifacts.eventTypeMigrations;
        this._eventTypes = Object.freeze([...artifacts.eventTypes]);
        this._events = new EventScenario({ ..._options, artifacts: {
            eventTypes: [...this._eventTypes],
            constraints: selectedConstraints === undefined ? undefined : [...selectedConstraints],
            eventTypeMigrations: eventTypeMigrations === undefined ? undefined : [...eventTypeMigrations]
        } });
        this._entries = getReactorEventTypes(_reactor, this._eventTypes);
        this._batchMethods = getReactorBatchMethods(_reactor, this._eventTypes);
        this._batchEventTypeIds = new Set(this._batchMethods.flatMap(method => [...method.eventTypes.keys()]));
        this._validateInstance = createHandlerInstanceValidator(_reactor, [
            ...this._entries.flatMap(entry => [entry.methodName, entry.replayMethodName].filter((name): name is string => !!name)),
            ...this._batchMethods.map(method => method.methodName)]);
        // Every unsupported event-sequence operation is latched at its source, whichever result or stream carries it.
        observeUnsupportedOperations(this._events.eventSequence, error => { this.latch(error); });
        this._instance = _options.artifactActivator ? undefined : new (_reactor as new () => Record<string, Function>)();
        if (this._instance) this._validateInstance(this._instance);
        this._store = _options.servicesEventStore ?? this.scenarioStore();
        this.given = { forEventSource: (id, options) => ({ events: (...events) => this.deliver(id, events, true, options) }),
            page: (...events) => this.deliverPage(events, true) };
        this.when = { forEventSource: (id, options) => ({ events: (...events) => this.deliver(id, events, false, options) }),
            page: (...events) => this.deliverPage(events, false) };
    }

    private scenarioStore(): IEventStore {
        const unsupported = (operation: string): never => { throw this.violation(`services.${operation}`,
            'Provide an explicit eventStore test double for this service.'); };
        const readModelMethods = new Set(['register', 'getInstanceById', 'findInstanceById', 'getInstances',
            'getSnapshotsById', 'dehydrateSession', 'release', 'releaseMany']);
        const readModels = new Proxy({}, { get: (_, key) => {
            if (key === 'watch') return async function* () { unsupported('readModels.watch'); };
            if (key === 'createWatcher') return () => unsupported('readModels.createWatcher');
            if (key === 'materialized') return unsupported('readModels.materialized');
            if (typeof key !== 'string' || !readModelMethods.has(key)) return undefined;
            return async () => unsupported(`readModels.${key}`);
        } }) as IReadModels;
        const eventLog = this._events.eventLog;
        const rejectSubscribed = (events: readonly object[]) => {
            if (events.some(event => {
                const id = getEventTypeMetadata(event.constructor)?.eventType.id.value;
                return id !== undefined && (this._entries.some(entry => entry.id === id) || this._batchEventTypeIds.has(id));
            })) {
                throw this.violation('services.eventLog.append.subscribed',
                    'Delivery of a reactor\'s own appended events is not supported.');
            }
        };
        const guardedLog = new Proxy(eventLog, { get: (target, key) => {
            if (key === 'append') return async (...args: Parameters<IEventLog['append']>) => {
                rejectSubscribed([args[1]]);
                return target.append(...args);
            };
            if (key === 'appendMany') return async (sourceOrEvents: string | EventForEventSourceId[],
                eventsOrOptions?: object[] | AppendOptions, options?: AppendOptions) => {
                if (typeof sourceOrEvents === 'string') {
                    rejectSubscribed(eventsOrOptions as object[]);
                    return target.appendMany(sourceOrEvents, eventsOrOptions as object[], options);
                }
                rejectSubscribed(sourceOrEvents.map(entry => entry.event));
                return target.appendMany(sourceOrEvents, eventsOrOptions as AppendOptions | undefined);
            };
            const value = Reflect.get(target, key, target) as unknown;
            return typeof value === 'function' ? value.bind(target) : value;
        } }) as IEventLog;
        const store = { name: new EventStoreName(this._options.eventStore ?? 'test-event-store'),
            namespace: new EventStoreNamespaceName(this._options.namespace ?? 'default'), eventLog: guardedLog, readModels };
        const unsupportedStoreProperties = new Set(['eventTypes', 'constraints', 'projections', 'reactors', 'reducers',
            'unitOfWorkManager', 'jobs', 'webhooks', 'subscriptions', 'seeding', 'externalServices', 'identities',
            'pii', 'failedPartitions', 'observers', 'patterns']);
        return new Proxy(store, { get: (target, key) => {
            if (typeof key !== 'string') return undefined;
            if (Object.hasOwn(target, key)) return target[key as keyof typeof target];
            if (key === 'getNamespaces') return async () => unsupported('eventStore.getNamespaces');
            if (key === 'getEventSequence') return () => unsupported('eventStore.getEventSequence');
            if (unsupportedStoreProperties.has(key)) return unsupported(`eventStore.${key}`);
            return undefined;
        } }) as IEventStore;
    }

    get produced(): readonly unknown[] { return Object.freeze(this._effects.map(effect => effect.value)); }
    get sideEffects(): readonly RecordedReactorSideEffect[] { return Object.freeze([...this._effects]); }
    get results(): readonly ReactorDeliveryResult[] { return Object.freeze([...this._results]); }
    /**
     * The partitions the reactor's batch methods reported as failed or deferred, in the order they were reported. A batch
     * method that throws fails every partition in its batch instead, and the scenario rejects the call that delivered it.
     */
    get partitionOutcomes(): readonly BatchPartitionOutcome[] { return Object.freeze([...this._partitionOutcomes]); }
    /** Committed input and explicit service appends; recorded returned effects are not part of this history. */
    get appendedEvents(): readonly AppendedEvent[] { return this._events.appendedEvents; }
    /** Assertion view, deliberately not a callable Promise-like `then`. */
    get then(): { readonly produced: readonly unknown[]; readonly sideEffects: readonly RecordedReactorSideEffect[];
        readonly results: readonly ReactorDeliveryResult[]; readonly partitionOutcomes: readonly BatchPartitionOutcome[] } {
        return { produced: this.produced, sideEffects: this.sideEffects, results: this.results, partitionOutcomes: this.partitionOutcomes };
    }
    shouldHaveProduced<T>(type: new (...args: never[]) => T, predicate: (value: T) => boolean = () => true): void {
        if (!this.produced.some(value => value instanceof type && predicate(value))) {
            throw new Error(`Expected reactor '${this._reactor.name}' to produce a matching '${type.name}'.`);
        }
    }
    /**
     * Asserts that a batch method failed a partition.
     * @param partition - The event source identifier of the partition.
     */
    shouldHaveFailed(partition: string): void { this.assertOutcome(partition, BatchOutcomeKind.Failed); }
    /**
     * Asserts that a batch method deferred a partition.
     * @param partition - The event source identifier of the partition.
     */
    shouldHaveDeferred(partition: string): void { this.assertOutcome(partition, BatchOutcomeKind.Deferred); }
    private assertOutcome(partition: string, kind: BatchOutcomeKind): void {
        if (this._partitionOutcomes.some(outcome => outcome.partition === partition && outcome.kind === kind)) return;
        const reported = this._partitionOutcomes.length > 0
            ? this._partitionOutcomes.map(outcome => `${outcome.kind} '${outcome.partition}'`).join(', ') : 'nothing';
        throw new Error(`Expected a batch method of reactor '${this._reactor.name}' to report partition '${partition}' as ${kind}, but it reported: ${reported}.`);
    }
    shouldNotHaveProduced(type: Function): void {
        if (this.produced.some(value => value instanceof type)) {
            throw new Error(`Expected reactor '${this._reactor.name}' to produce no '${type.name}'.`);
        }
    }

    /** Replay, redelivery and scheduler semantics need a separate kernel-backed increment. */
    async replay(): Promise<never> {
        throw new UnsupportedReactorOperation('replay', this._reactor.name, 'Replay scheduling and observation state are not supported.');
    }
    async redeliver(): Promise<never> {
        throw new UnsupportedReactorOperation('redeliver', this._reactor.name, 'Retry and checkpoint semantics are not supported.');
    }

    private async deliver(sourceId: string, input: object[], setup: boolean, options?: AppendOptions): Promise<void> {
        await this.exclusively(async () => {
            if (!setup && !input.length) {
                throw new UnsupportedReactorOperation('when.events', this._reactor.name, 'Empty action batches are not fixture-backed.');
            }
            const before = this._events.appendedEvents.length;
            if (setup) {
                await this._events.given.forEventSource(sourceId, options).events(...input);
            } else {
                throwIfAppendFailed(await this._events.when.forEventSource(sourceId, options).events(...input));
            }
            const events = this._events.appendedEvents.slice(before);
            if (events.length) await this.process(events);
        });
    }

    private async deliverPage(entries: EventForEventSourceId[], setup: boolean): Promise<void> {
        await this.exclusively(async () => {
            if (!entries.length) {
                throw new UnsupportedReactorOperation(setup ? 'given.page' : 'when.page', this._reactor.name, 'Empty pages are not fixture-backed.');
            }
            const before = this._events.appendedEvents.length;
            if (setup) {
                for (const entry of entries) {
                    await this._events.given.forEventSource(entry.eventSourceId, appendOptionsOf(entry)).events(entry.event);
                }
            } else {
                throwIfAppendFailed(await this._events.appendMany(entries));
            }
            const events = this._events.appendedEvents.slice(before);
            if (events.length) await this.process(events);
        });
    }

    private async exclusively(deliver: () => Promise<void>): Promise<void> {
        if (this._failed) throw new UnsupportedReactorOperation('delivery.afterFailure', this._reactor.name,
            'A previous delivery failed; failed-partition retries are not supported.');
        if (this._busy) throw new UnsupportedReactorOperation('delivery.overlap', this._reactor.name, 'Concurrent deliveries have unproven ordering.');
        this._busy = true;
        try {
            await deliver();
        } finally {
            this._busy = false;
        }
    }

    private violation(operation: string, reason: string): UnsupportedReactorOperation {
        return this.latch(new UnsupportedReactorOperation(operation, this._reactor.name, reason)) as UnsupportedReactorOperation;
    }

    private latch(error: unknown): unknown {
        // Attribute the call to the delivery whose async context made it, and only while that delivery is running.
        const delivery = this._deliveryContext.getStore();
        if (delivery && delivery === this._delivery &&
            (error instanceof UnsupportedReactorOperation || error instanceof UnsupportedEventSequenceOperation)) {
            delivery.violation ??= error;
        }
        return error;
    }

    private throwIfViolated(delivery: { violation?: Error }): void {
        if (delivery.violation) throw delivery.violation;
    }

    private async process(events: readonly AppendedEvent[]): Promise<void> {
        const delivery: { violation?: Error } = {};
        this._delivery = delivery;
        const deliveryIndex = this._deliveryIndex++;
        const handled: EventContext[] = [];
        const skipped: EventContext[] = [];
        const sourceId = events[0].context.eventSourceId;
        const partitions = [...new Set(events.map(event => event.context.eventSourceId))];
        const outcome: { sourceId: string; partitions: readonly string[]; handled: EventContext[]; skipped: EventContext[];
            completed: boolean; error?: unknown } = { sourceId, partitions, handled, skipped, completed: false };
        const services: ReactorServices = { eventStore: this._store, readModels: this._store.readModels, signal: this._controller.signal };
        const first = events.find(event => this._batchEventTypeIds.has(event.eventType.id.value) ||
            !!selectReactorHandler(this._entries, this._reactor, this._instance, event.eventType.id.value, event.context.observationState ?? 0)?.methodName);
        const process = async (artifact: ActivatedArtifact<Record<string, Function>>) => {
            // EventScenario's serialized history is the committed boundary, not the original input instance.
            if (events.some(event => event.context.observationState !== 1)) {
                throw new UnsupportedReactorOperation('delivery.observationState', this._reactor.name,
                    'Only initial live delivery is fixture-backed.');
            }
            if (this._batchMethods.length > 0) await this.processBatches(artifact, events, handled, delivery);
            for (const event of events) {
                // The batch methods had these events, as one page.
                if (this._batchEventTypeIds.has(event.eventType.id.value)) continue;
                const selection = selectReactorHandler(this._entries, this._reactor, artifact.instance,
                    event.eventType.id.value, event.context.observationState ?? 0);
                if (!selection?.methodName || selection.skipReplay) { skipped.push(event.context); continue; }
                await invokeReactorHandler(artifact, selection.methodName, event.content, event.context, services, result => {
                    // A swallowed unsupported call fails this event like a throwing handler: nothing is recorded.
                    this.throwIfViolated(delivery);
                    return this.record(result, event.context, selection.methodName!, deliveryIndex);
                }, this.deliveryFor(event.context));
                this.throwIfViolated(delivery);
                handled.push(event.context);
            }
        };
        try {
            await this._deliveryContext.run(delivery, async () => {
                if (first && this._options.artifactActivator) {
                    await withActivatedArtifact(this._reactor, { kind: ArtifactKind.Reactor,
                        artifactId: getReactorMetadata(this._reactor)!.id.value, eventStore: this._store,
                        readModels: services.readModels, eventSequenceId: 'event-log', partition: sourceId,
                        signal: services.signal, delivery: ArtifactDelivery.Events, eventContext: first.context },
                    this._options.artifactActivator, artifact => {
                        this._validateInstance(artifact.instance);
                        return process(artifact);
                    });
                } else {
                    await process({ instance: this._instance ?? {} });
                }
            });
            // A handler that catches an unsupported-service rejection must not turn it into a successful delivery.
            this.throwIfViolated(delivery);
            outcome.completed = true;
        } catch (error) {
            outcome.error = error;
            this._failed = true;
            throw error;
        } finally {
            if (this._delivery === delivery) this._delivery = undefined;
            this._results.push(Object.freeze({ ...outcome, partitions: Object.freeze([...partitions]), handled: Object.freeze([...handled]), skipped: Object.freeze([...skipped]) }));
        }
    }

    private async processBatches(artifact: ActivatedArtifact<Record<string, Function>>, events: readonly AppendedEvent[],
        handled: EventContext[], delivery: { violation?: Error }): Promise<void> {
        const outcomes = await deliverToBatchMethods(artifact, this._batchMethods, {
            observerId: getReactorMetadata(this._reactor)!.id.value, observerName: this._reactor.name,
            eventStore: this._options.eventStore ?? 'test-event-store', namespace: this._options.namespace ?? 'default',
            events, signal: this._controller.signal, deliveryFor: context => this.deliveryFor(context)
        });
        this.throwIfViolated(delivery);
        this._partitionOutcomes.push(...outcomes);
        // An event is handled unless its partition was failed or deferred at or before it.
        for (const event of events.filter(event => this._batchEventTypeIds.has(event.eventType.id.value))) {
            if (!outcomes.some(reported => reported.partition === event.context.eventSourceId && reported.at <= event.context.sequenceNumber)) {
                handled.push(event.context);
            }
        }
    }

    private deliveryFor(context: EventContext): ReactorDelivery {
        return new ReactorDelivery(getReactorMetadata(this._reactor)!.id.value,
            context.eventStore ?? this._options.eventStore ?? 'test-event-store',
            context.namespace ?? this._options.namespace ?? 'default', 'event-log', context.eventSourceId, context.sequenceNumber);
    }

    private async record(result: unknown, context: EventContext, handler: string, deliveryIndex: number): Promise<void> {
        if (await this._options.resultHandler?.(result, context, this._reactor,
            this._options.eventStore ?? 'test-event-store', this._options.namespace ?? 'default')) return;
        if (result == null) return;
        const items = Array.isArray(result) ? result : [result];
        const events = normalizeReactorSideEffects(result, context.eventSourceId,
            context.eventStreamType ?? 'Default', context.eventStreamId ?? context.eventSourceId,
            getEventSourceTypeFor(this._reactor), getDeclaredEventStreamTypeFor(this._reactor));
        if (items.length !== events.length || events.some(entry => !this._eventTypes.includes(entry.event.constructor as Constructor))) {
            throw new UnsupportedReactorOperation('handler.return', this._reactor.name,
                'Only registered events and production EventForEventSourceId wrappers may be recorded; commands and unknown values are unsupported.');
        }
        // Production validates named tags before appending, failing the delivery on an invalid tag; so does recording.
        for (const target of events) mergeNamedTags(target.namedTags);
        ensureNamedTagBatchIsSupported(events.some(event => mergeNamedTags(event.namedTags).length > 0),
            events.some(event => event.eventSource !== undefined));
        for (const target of events) {
            this._effects.push(Object.freeze({ kind: 'event', value: target.event, target, triggeringContext: context,
                handler, deliveryIndex }));
        }
    }
}

/** The reactor scenario phase that delivers events for one event source, or a page of several. */
export interface ReactorScenarioPhase {
    /**
     * Selects the event source to deliver events for.
     * @param id - The event source identifier.
     * @param options - Optional append options.
     * @returns The builder whose `events(...)` delivers its events as one page.
     */
    forEventSource(id: string, options?: AppendOptions): { events(...events: object[]): Promise<void> };

    /**
     * Delivers events of several event sources as one live page, as the kernel delivers a page to batch methods.
     * @param events - The events and the event sources they are for, in the order they are appended.
     * @returns A promise that resolves when every method has handled its events.
     */
    page(...events: EventForEventSourceId[]): Promise<void>;
}

function throwIfAppendFailed(results: readonly { isSuccess: boolean }[]): void {
    const failures = results.filter(result => !result.isSuccess);
    if (failures.length) throw new Error(`ReactorScenario action append failed: ${JSON.stringify(failures, (_, value) =>
        typeof value === 'bigint' ? value.toString() : value)}`);
}

function appendOptionsOf(entry: EventForEventSourceId): AppendOptions | undefined {
    // Only what the entry sets: the seeding path refuses options it cannot honor rather than dropping them.
    const options = Object.fromEntries(Object.entries({
        sourceType: entry.eventSourceType, streamType: entry.eventStreamType, streamId: entry.eventStreamId, subject: entry.subject,
        occurred: entry.occurred, tags: entry.tags, namedTags: entry.namedTags, eventSource: entry.eventSource, eventStream: entry.eventStream
    }).filter(([, value]) => value !== undefined)) as AppendOptions;
    return Object.keys(options).length > 0 ? options : undefined;
}
