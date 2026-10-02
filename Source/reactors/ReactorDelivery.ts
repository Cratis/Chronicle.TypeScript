// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Identifies one event delivered to one reactor partition. Handlers receive this as their
 * fourth argument, after the event, EventContext and ReactorServices.
 *
 * The identity is stable across retries and replay. It is not exactly-once delivery:
 * Chronicle stores no receipt and does not know whether an application's side effect completed.
 */
export class ReactorDelivery {
    constructor(
        readonly reactor: string,
        readonly eventStore: string,
        readonly namespace: string,
        readonly eventSequence: string,
        readonly partition: string,
        readonly sequenceNumber: bigint
    ) {
        Object.freeze(this);
    }

    /**
     * Application-owned receipt key, matching .NET's ReactorDelivery.Id.Value format.
     * Components are joined with '#', without escaping or hashing. Persisted keys depend
     * on stable reactor, store, namespace and event-sequence identifiers.
     */
    get id(): string {
        return [this.reactor, this.eventStore, this.namespace, this.eventSequence,
            this.partition, this.sequenceNumber.toString()].join('#');
    }
}
