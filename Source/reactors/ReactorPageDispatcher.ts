// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import { ObservationState, ReplayState, type AppendedEvent, type EventsToObserve, type ReactorResult } from '@cratis/chronicle.contracts';
import type { ActivatedArtifact } from '../artifacts/ActivatedArtifact.js';
import { ArtifactCompletionFailed } from '../artifacts/ArtifactCompletionFailed.js';
import { ArtifactDelivery } from '../artifacts/ArtifactDelivery.js';
import { ArtifactKind } from '../artifacts/ArtifactKind.js';
import { runActivated, withActivatedArtifact } from '../artifacts/withActivatedArtifact.js';
import type { EventContext } from '../events/EventContext.js';
import { toClientEventContext } from '../events/toClientEventContext.js';
import { notifyReplayLifecycle } from '../observation/notifyReplayLifecycle.js';
import type { BatchContext } from '../observation/batches/BatchContext.js';
import { createBatchContext } from '../observation/batches/createBatchContext.js';
import { BatchOutcomeKind } from '../observation/batches/BatchOutcomeKind.js';
import type { BatchMethod } from '../observation/batches/BatchMethod.js';
import { BatchMethodReturnedAValue } from '../observation/batches/BatchMethodReturnedAValue.js';
import { EventAndContext } from '../observation/batches/EventAndContext.js';
import { EventBatch } from '../observation/batches/EventBatch.js';
import { isPage, partitionsOfEvents } from '../observation/batches/PageMessages.js';
import type { DeliveredPartition } from '../observation/batches/DeliveredPartition.js';
import { PartitionFailedInBatch } from '../observation/batches/PartitionFailedInBatch.js';
import { failedAt, settlePartition, toPartitionResult } from '../observation/batches/PartitionSettlement.js';
import type { PartitionOutcome } from '../observation/batches/PartitionOutcome.js';
import type { PartitionProblem } from '../observation/batches/PartitionProblem.js';
import { dispatchReactorSideEffects } from './ReactorSideEffects.js';
import { invokeReactorHandler, selectReactorHandler } from './ReactorDispatcher.js';
import type { ReactorObservationTarget } from './ReactorObservationTarget.js';
import { ReactorDelivery } from './ReactorDelivery.js';

type ReactorInstance = Record<string, Function>;
type Artifact = ActivatedArtifact<ReactorInstance>;

/** An event of a page bound for a batch method, with the partition it was delivered in. */
type PageEvent = { readonly partition: string; readonly event: EventAndContext };


/**
 * Dispatches one delivery of a reactor observation, a page of partitions or a legacy single partition, to its batch and
 * per-event methods, and settles each partition on its own.
 */
export class ReactorPageDispatcher {
    private readonly _batchEventTypes: ReadonlyMap<string, { method: BatchMethod; type: Constructor }>;

    /**
     * Creates a new {@link ReactorPageDispatcher}.
     * @param _target - The {@link ReactorObservationTarget}.
     */
    constructor(private readonly _target: ReactorObservationTarget) {
        this._batchEventTypes = new Map(_target.batchMethods.flatMap(method =>
            [...method.eventTypes.values()].map(eventType => [eventType.id, { method, type: eventType.type }] as const)));
    }

    /**
     * Dispatches a delivery and creates the result to send back to the kernel.
     * @param message - The {@link EventsToObserve} delivered.
     * @returns The {@link ReactorResult}.
     */
    async dispatch(message: EventsToObserve): Promise<ReactorResult> {
        const partitions = partitionsOfEvents(message);
        this._target.logger.debug('Received events to observe', {
            reactorId: this._target.id,
            partitions: partitions.length,
            count: partitions.reduce((count, partition) => count + partition.events.length, 0),
            replayState: message.ReplayState
        });

        const notificationFailure = await this.notifyReplayTransition(message, partitions);
        const problems = notificationFailure ?? await this.observe(message, partitions);
        const outcomes = partitions.map(partition => settlePartition(partition.partition,
            partition.events.map(event => event.Context!.SequenceNumber), problems));
        return toReactorResult(message, outcomes);
    }

    private async notifyReplayTransition(message: EventsToObserve, partitions: readonly DeliveredPartition[]): Promise<PartitionProblem[] | undefined> {
        const { id, reactorType, eventSequenceId, services, signal, artifactActivator, reactorInstance, validateInstance } = this._target;
        try {
            if (artifactActivator && message.ReplayState !== ReplayState.REPLAY_STATE_None) {
                if (!services) throw new Error('Reactor activation requires the owning event store.');
                await withActivatedArtifact(reactorType, {
                    kind: ArtifactKind.Reactor, artifactId: id, eventStore: services.eventStore,
                    readModels: services.readModels, eventSequenceId, partition: message.Partition,
                    signal, delivery: ArtifactDelivery.ReplayNotification, replayState: message.ReplayState
                }, artifactActivator, artifact => {
                    validateInstance(artifact.instance as object);
                    return runActivated(artifact, () =>
                        notifyReplayLifecycle(artifact.instance as object, message.ReplayState, message.Partition),
                        { delivery: ArtifactDelivery.ReplayNotification, replayState: message.ReplayState });
                }, this._target.connectionLogger);
            } else if (reactorInstance) {
                await notifyReplayLifecycle(reactorInstance, message.ReplayState, message.Partition);
            }
            return undefined;
        } catch (error) {
            this._target.logger.error('Error notifying reactor of replay lifecycle transition', { reactorId: id, error });
            const messages = error instanceof ArtifactCompletionFailed && error.processingError !== undefined
                ? [String(error.processingError), String(error)] : [String(error)];
            return partitions.map(partition => ({
                ...failedAt(partition.partition, firstSequenceNumberOf(partition), error),
                exceptionMessages: messages
            }));
        }
    }

    private async observe(message: EventsToObserve, partitions: readonly DeliveredPartition[]): Promise<PartitionProblem[]> {
        const { id, reactorType, eventSequenceId, services, signal, artifactActivator, reactorInstance, validateInstance } = this._target;
        const first = artifactActivator ? this.firstInvocableEvent(partitions) : undefined;
        if (!first || !artifactActivator) {
            return this.observeWith({ instance: reactorInstance ?? {} }, message, partitions);
        }

        const problems: PartitionProblem[] = [];
        try {
            if (!services) throw new Error('Reactor activation requires the owning event store.');
            await withActivatedArtifact(reactorType as new () => ReactorInstance, {
                kind: ArtifactKind.Reactor, artifactId: id, eventStore: services.eventStore,
                readModels: services.readModels, eventSequenceId, partition: first.partition,
                signal, delivery: ArtifactDelivery.Events, eventContext: toClientEventContext(first.event.Context!)
            }, artifactActivator, async artifact => {
                validateInstance(artifact.instance);
                problems.push(...await this.observeWith(artifact, message, partitions));
            }, this._target.connectionLogger);
            return problems;
        } catch (error) {
            this._target.logger.error('Error activating reactor', { reactorId: id, error });
            return partitions.map(partition => activationFailure(partition, problems, error));
        }
    }

    private firstInvocableEvent(partitions: readonly DeliveredPartition[]): { partition: string; event: AppendedEvent } | undefined {
        for (const partition of partitions) {
            for (const event of partition.events) {
                const eventTypeId = event.Context?.EventType?.Id;
                if (eventTypeId && this._batchEventTypes.has(eventTypeId)) return { partition: partition.partition, event };
                const selection = this.select(this._target.reactorInstance, event);
                if (selection?.methodName && !selection.skipReplay) return { partition: partition.partition, event };
            }
        }
        return undefined;
    }

    private select(instance: ReactorInstance | undefined, event: AppendedEvent) {
        return selectReactorHandler(this._target.entries, this._target.reactorType, instance,
            event.Context?.EventType?.Id, event.Context?.ObservationState ?? 0);
    }

    private async observeWith(artifact: Artifact, message: EventsToObserve, partitions: readonly DeliveredPartition[]): Promise<PartitionProblem[]> {
        const problems: PartitionProblem[] = [];
        if (this._target.batchMethods.length > 0) {
            problems.push(...await this.observeBatches(artifact, message, partitions));
        }
        for (const partition of partitions) {
            const problem = await this.observePartition(artifact, partition);
            if (problem) problems.push(problem);
        }
        return problems;
    }

    private async observeBatches(artifact: Artifact, message: EventsToObserve, partitions: readonly DeliveredPartition[]): Promise<PartitionProblem[]> {
        const problems: PartitionProblem[] = [];
        const events: PageEvent[] = [];
        for (const partition of partitions) {
            for (const event of partition.events) {
                const batchEventType = this._batchEventTypes.get(event.Context?.EventType?.Id ?? '');
                if (!batchEventType) continue;
                try {
                    events.push({ partition: partition.partition, event: this.toEventAndContext(event, batchEventType.type) });
                } catch (error) {
                    problems.push(failedAt(partition.partition, event.Context!.SequenceNumber, error));
                }
            }
        }
        events.sort((left, right) => left.event.context.sequenceNumber < right.event.context.sequenceNumber ? -1
            : left.event.context.sequenceNumber > right.event.context.sequenceNumber ? 1 : 0);

        const context = this.createBatchContext(message, partitions);
        for (const method of this._target.batchMethods) {
            const observed = events.filter(event => method.eventTypes.has(event.event.context.eventType.id.value));
            if (observed.length === 0) continue;
            problems.push(...await this.invokeBatchMethod(artifact, method, observed, context));
        }
        return problems;
    }

    private async invokeBatchMethod(artifact: Artifact, method: BatchMethod, observed: readonly PageEvent[], context: BatchContext): Promise<PartitionProblem[]> {
        const { id, reactorType } = this._target;
        const batch = new EventBatch(observed.map(event => event.event), context.canDefer);
        const partitionOf = new Map(observed.map(event => [event.event.context.eventSourceId, event.partition]));
        try {
            this._target.logger.info('Invoking reactor batch method', { reactorId: id, method: method.methodName, count: observed.length });
            const result: unknown = await runActivated(artifact, () => artifact.instance[method.methodName](batch, context),
                { delivery: ArtifactDelivery.Events, eventContext: observed[0].event.context, methodName: method.methodName });
            if (result !== undefined) throw new BatchMethodReturnedAValue((reactorType as Function).name, method.methodName);
            return batch.outcomes.map(outcome => {
                const partition = partitionOf.get(outcome.partition) ?? outcome.partition;
                return outcome.kind === BatchOutcomeKind.Deferred
                    ? { partition, at: outcome.at, state: ObservationState.Deferred, exceptionMessages: [], exceptionStackTrace: '',
                        retryAfterMilliseconds: outcome.retryAfterMilliseconds }
                    : failedAt(partition, outcome.at, outcome.error ?? new PartitionFailedInBatch(outcome.partition));
            });
        } catch (error) {
            this._target.logger.error('Error handling events in reactor batch method', { reactorId: id, method: method.methodName, error });
            const firstOfPartition = new Map<string, bigint>();
            for (const event of observed) {
                if (!firstOfPartition.has(event.partition)) firstOfPartition.set(event.partition, event.event.context.sequenceNumber);
            }
            return [...firstOfPartition].map(([partition, at]) => failedAt(partition, at, error));
        }
    }

    private async observePartition(artifact: Artifact, partition: DeliveredPartition): Promise<PartitionProblem | undefined> {
        const { id, reactorType, eventStoreName, namespace, services, eventLog, resultHandler } = this._target;
        for (const event of partition.events) {
            const eventTypeId = event.Context?.EventType?.Id;
            if (!eventTypeId) {
                this._target.logger.warn('Event missing event type context', { reactorId: id });
                continue;
            }
            if (this._batchEventTypes.has(eventTypeId)) continue;

            const selection = this.select(artifact.instance, event);
            if (!selection?.methodName || selection.skipReplay) {
                if (selection?.skipReplay) {
                    this._target.logger.debug('Reactor handler skipped for replay', { reactorId: id, eventTypeId, method: selection.methodName });
                } else {
                    this._target.logger.debug('No reactor handler found', { reactorId: id, eventTypeId, isReplay: selection?.isReplay ?? false });
                }
                continue;
            }

            try {
                const content = JSON.parse(event.Content) as Record<string, unknown>;
                const context = toClientEventContext(event.Context!);
                this._target.logger.info('Invoking reactor handler', {
                    reactorId: id, method: selection.methodName, sequenceNumber: event.Context!.SequenceNumber.toString(), eventTypeId
                });
                await invokeReactorHandler(artifact, selection.methodName, content, context, services, result =>
                    dispatchReactorSideEffects(eventLog, result, context, reactorType as Function, eventStoreName, namespace, resultHandler),
                this.deliveryFor(context));
            } catch (error) {
                this._target.logger.error('Error handling event in reactor', { reactorId: id, error });
                return failedAt(partition.partition, event.Context!.SequenceNumber, error);
            }
        }
        return undefined;
    }

    private toEventAndContext(event: AppendedEvent, eventType: Constructor): EventAndContext {
        const context = toClientEventContext(event.Context!);
        return new EventAndContext(JSON.parse(event.Content) as Record<string, unknown>, context, eventType, this.deliveryFor(context));
    }

    private deliveryFor(context: EventContext): ReactorDelivery {
        const { id, eventStoreName, namespace, eventSequenceId } = this._target;
        return new ReactorDelivery(id, context.eventStore ?? eventStoreName, context.namespace ?? namespace, eventSequenceId,
            context.eventSourceId, context.sequenceNumber);
    }

    private createBatchContext(message: EventsToObserve, partitions: readonly DeliveredPartition[]): BatchContext {
        const { id, eventStoreName, namespace, eventSequenceId, signal } = this._target;
        return createBatchContext({ observerId: id, eventStore: eventStoreName, namespace, eventSequenceId, signal }, message, partitions);
    }
}

/**
 * Gets the sequence number of the first event of a partition, or zero when it has none.
 * @param partition - The partition.
 * @returns The sequence number.
 */
function firstSequenceNumberOf(partition: DeliveredPartition): bigint {
    return partition.events[0]?.Context?.SequenceNumber ?? 0n;
}

/**
 * Replaces what a partition reported with the failure of the activation that observed it, keeping the reported messages.
 * @param partition - The partition.
 * @param problems - The problems reported while observing, before the activation failed.
 * @param error - The activation failure.
 * @returns The {@link PartitionProblem} failing the partition from its first event.
 */
function activationFailure(partition: DeliveredPartition, problems: readonly PartitionProblem[], error: unknown): PartitionProblem {
    const reported = problems.filter(problem => problem.partition === partition.partition)
        .reduce<PartitionProblem | undefined>((first, problem) => !first || problem.at < first.at ? problem : first, undefined);
    const stack = error instanceof Error ? (error.stack ?? '') : '';
    return {
        partition: partition.partition,
        at: firstSequenceNumberOf(partition),
        state: ObservationState.Failed,
        exceptionMessages: [...(reported?.exceptionMessages ?? []), String(error)],
        exceptionStackTrace: error instanceof ArtifactCompletionFailed && reported?.exceptionStackTrace ? `${reported.exceptionStackTrace}\n${stack}` : stack,
        retryAfterMilliseconds: 0
    };
}

/**
 * Creates the result of a delivery: one result per partition for a page, or the legacy single-partition fields.
 * @param message - The delivered message.
 * @param outcomes - The outcome of each partition, in delivery order.
 * @returns The {@link ReactorResult}.
 */
function toReactorResult(message: EventsToObserve, outcomes: readonly PartitionOutcome[]): ReactorResult {
    if (isPage(message)) {
        return {
            Partition: '', State: ObservationState.OBSERVATION_STATE_None, LastSuccessfulObservation: 0n,
            ExceptionMessages: [], ExceptionStackTrace: '', DeliveryId: message.DeliveryId ?? 0n,
            RetryAfterMilliseconds: 0n, Partitions: outcomes.map(toPartitionResult)
        };
    }
    const [outcome] = outcomes;
    return {
        Partition: message.Partition,
        State: outcome.state === ObservationState.Deferred ? ObservationState.Failed : outcome.state,
        LastSuccessfulObservation: outcome.lastSuccessfulObservation,
        ExceptionMessages: [...outcome.exceptionMessages],
        ExceptionStackTrace: outcome.exceptionStackTrace,
        DeliveryId: message.DeliveryId ?? 0n,
        RetryAfterMilliseconds: 0n,
        Partitions: []
    };
}
