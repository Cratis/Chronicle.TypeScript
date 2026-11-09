// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import type { ActivatedArtifact } from '../artifacts/ActivatedArtifact.js';
import { ArtifactDelivery } from '../artifacts/ArtifactDelivery.js';
import { runActivated } from '../artifacts/withActivatedArtifact.js';
import type { AppendedEvent } from '../events/AppendedEvent.js';
import type { EventContext } from '../events/EventContext.js';
import { BatchContext } from '../observation/batches/BatchContext.js';
import type { BatchMethod } from '../observation/batches/BatchMethod.js';
import { BatchMethodReturnedAValue } from '../observation/batches/BatchMethodReturnedAValue.js';
import { EventAndContext } from '../observation/batches/EventAndContext.js';
import { EventBatch } from '../observation/batches/EventBatch.js';
import { ObservationOrigin } from '../observation/batches/ObservationOrigin.js';
import type { ReactorDelivery } from '../reactors/ReactorDelivery.js';
import type { BatchPartitionOutcome } from './BatchPartitionOutcome.js';

/** The page a scenario delivers to the batch methods of a reactor. */
export interface ScenarioPage {
    /** The identifier of the reactor. */
    readonly observerId: string;

    /** The name of the reactor type, for errors. */
    readonly observerName: string;

    /** The event store the events come from. */
    readonly eventStore: string;

    /** The namespace the events come from. */
    readonly namespace: string;

    /** The events of the page, in sequence order. */
    readonly events: readonly AppendedEvent[];

    /** Aborted when the scenario is disposed. */
    readonly signal: AbortSignal;

    /** Creates the delivery identity of an event. */
    readonly deliveryFor: (context: EventContext) => ReactorDelivery;
}

/**
 * Delivers a page of events to the batch methods of a reactor as one live page, the way the kernel delivers a page: each
 * batch method gets the events of the types it observes, in sequence order, as one {@link EventBatch}.
 * @param artifact - The reactor instance, activated for the delivery.
 * @param methods - The batch methods of the reactor.
 * @param page - The {@link ScenarioPage}.
 * @returns The partitions the batch methods reported as failed or deferred, in the order they were reported.
 * @throws What a batch method throws, which fails every partition in its batch.
 * @throws {@link BatchMethodReturnedAValue} when a batch method returns a value.
 */
export async function deliverToBatchMethods(artifact: ActivatedArtifact<Record<string, Function>>, methods: readonly BatchMethod[],
    page: ScenarioPage): Promise<BatchPartitionOutcome[]> {
    const outcomes: BatchPartitionOutcome[] = [];
    const sequenceNumbers = page.events.map(event => event.context.sequenceNumber);
    const context = new BatchContext({
        observerId: page.observerId,
        eventStore: page.eventStore,
        namespace: page.namespace,
        eventSequenceId: 'event-log',
        origin: ObservationOrigin.Live,
        partitions: [...new Set(page.events.map(event => event.context.eventSourceId))],
        eventCount: page.events.length,
        firstSequenceNumber: sequenceNumbers[0],
        lastSequenceNumber: sequenceNumbers[sequenceNumbers.length - 1],
        deadline: undefined,
        signal: page.signal,
        canDefer: true
    });

    for (const method of methods) {
        const observed = page.events.flatMap(event => {
            const eventType = method.eventTypes.get(event.eventType.id.value);
            return eventType ? [toEventAndContext(event, eventType.type, page)] : [];
        });
        if (observed.length === 0) continue;

        const batch = new EventBatch(observed, context.canDefer);
        const result: unknown = await runActivated(artifact, () => artifact.instance[method.methodName](batch, context),
            { delivery: ArtifactDelivery.Events, eventContext: observed[0].context, methodName: method.methodName });
        if (result !== undefined) throw new BatchMethodReturnedAValue(page.observerName, method.methodName);
        outcomes.push(...batch.outcomes.map(outcome => ({ ...outcome, methodName: method.methodName })));
    }
    return outcomes;
}

function toEventAndContext(event: AppendedEvent, eventType: Constructor, page: ScenarioPage): EventAndContext {
    return new EventAndContext(event.content, event.context, eventType, page.deliveryFor(event.context));
}
