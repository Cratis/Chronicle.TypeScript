// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Thrown when an append names an event source that is not a discovered definition. */
export class UnknownEventSource extends Error {
    constructor(readonly eventSource: string) {
        super(`The event source '${eventSource}' is not a discovered event source definition.`);
        this.name = 'UnknownEventSource';
    }
}
