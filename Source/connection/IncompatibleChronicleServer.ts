// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** A permanent contract mismatch; reconnect backoff cannot make this operation safe. */
export class IncompatibleChronicleServer extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'IncompatibleChronicleServer';
    }
}
