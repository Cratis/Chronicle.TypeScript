// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Thrown at registration when an event type would reach more than one method of an observer. */
export class EventTypeObservedByMoreThanOneMethod extends Error {
    /**
     * Creates a new {@link EventTypeObservedByMoreThanOneMethod}.
     * @param observerType - The name of the observer class.
     * @param eventType - The name of the event type.
     * @param methods - The methods the event type would reach.
     */
    constructor(readonly observerType: string, readonly eventType: string, readonly methods: readonly string[]) {
        super(`Event type '${eventType}' reaches more than one method of '${observerType}' (${methods.map(method => `'${method}'`).join(', ')}). ` +
            'Each event type must reach exactly one method: a batch method or a per-event method, never both.');
        this.name = 'EventTypeObservedByMoreThanOneMethod';
    }
}
