// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** A registered event type and its selected instance method. */
export interface EventHandler {
    readonly id: string;
    readonly generation: number;
    readonly methodName: string;
}
