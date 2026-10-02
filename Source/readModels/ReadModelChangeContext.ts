// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** The triggering event metadata available on the kernel's read model change stream. */
export interface ReadModelChangeContext {
    readonly eventStore: string;
    readonly namespace: string;
    readonly sequenceNumber: bigint;
    readonly correlationId?: string;
    readonly occurred?: Date;
}
