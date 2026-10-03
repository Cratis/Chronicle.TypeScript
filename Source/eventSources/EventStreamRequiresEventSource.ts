// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Thrown when an append names a stream without naming the event source that declares it. */
export class EventStreamRequiresEventSource extends Error {
    constructor(readonly stream: string) {
        super(`The event stream '${stream}' can only be used together with an event source.`);
        this.name = 'EventStreamRequiresEventSource';
    }
}
