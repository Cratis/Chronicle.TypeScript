// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Thrown when explicit routing values contradict the event source definition. */
export class EventRoutingContradictsEventSource extends Error {
    constructor(readonly eventSource: string, readonly dimension: string, readonly expected: string, readonly actual: string) {
        super(`The explicit ${dimension} '${actual}' contradicts the event source '${eventSource}', which requires '${expected}'.`);
        this.name = 'EventRoutingContradictsEventSource';
    }
}
