// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** An operation whose kernel/observer semantics have not been established for this scenario. */
export class UnsupportedReducerOperation extends Error {
    constructor(readonly operation: string, readonly artifact: string, reason: string) {
        super(`Unsupported reducer operation '${operation}' for '${artifact}': ${reason} Use a kernel-backed test.`);
        this.name = 'UnsupportedReducerOperation';
    }
}
