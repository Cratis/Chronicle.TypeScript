// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Options for a per-observer readiness check, not a registration acknowledgment. */
export interface WaitTillSubscribedOptions {
    /** Timeout in milliseconds, including RPCs. Defaults to 5000. */
    readonly timeout?: number;
    readonly signal?: AbortSignal;
}
