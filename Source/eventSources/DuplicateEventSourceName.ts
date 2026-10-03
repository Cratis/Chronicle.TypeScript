// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Thrown when two discovered event source definitions share a name. */
export class DuplicateEventSourceName extends Error {
    constructor(readonly eventSource: string) {
        super(`More than one event source definition is named '${eventSource}'.`);
        this.name = 'DuplicateEventSourceName';
    }
}
