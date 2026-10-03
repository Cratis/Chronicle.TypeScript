// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Thrown when an append names a stream the event source does not declare. */
export class EventStreamDoesNotBelongToEventSource extends Error {
    constructor(readonly eventSource: string, readonly stream: string) {
        super(`The event stream '${stream}' is not declared by the event source '${eventSource}'.`);
        this.name = 'EventStreamDoesNotBelongToEventSource';
    }
}
