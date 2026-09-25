// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Options for waiting until observers complete an append. */
export interface WaitForCompletionOptions {
    /** Timeout in milliseconds. Defaults to 5000 (5 seconds). */
    readonly timeoutMs?: number;

    /** Cancels the underlying wait RPC when aborted. */
    readonly signal?: AbortSignal;
}
