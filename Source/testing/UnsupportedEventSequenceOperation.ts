// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** A kernel operation or definition outside the fixture-backed in-process boundary. */
export class UnsupportedEventSequenceOperation extends Error {
    constructor(operation: string, artifact: string, reason: string) {
        super(`UnsupportedEventSequenceOperation: ${operation} (${artifact}): ${reason} Use a kernel-backed test.`);
        this.name = 'UnsupportedEventSequenceOperation';
    }
}
