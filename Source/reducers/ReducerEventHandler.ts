// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Event type and camel-case method selected for a reducer observation. */
export interface ReducerEventHandler {
    readonly id: string;
    readonly generation: number;
    readonly methodName: string;
}
