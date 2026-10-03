// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Thrown when an event source definition declares the same stream name twice. */
export class DuplicateEventStreamName extends Error {
    constructor(readonly eventSource: string, readonly stream: string) {
        super(`The event source '${eventSource}' declares the event stream '${stream}' more than once.`);
        this.name = 'DuplicateEventStreamName';
    }
}
