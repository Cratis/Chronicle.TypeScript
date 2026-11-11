// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * How one reactor or reducer observation stream ended, which decides what happens next.
 *
 * - `ended`: the stream ended or failed while it was still the current one; open it again after a backoff.
 * - `sessionLost`: the kernel no longer knows the connection; the whole client reconnects and re-registers it.
 * - `superseded`: a disconnect, a dispose or a newer stream replaced it; nothing to do.
 * - `stopped`: the client cancelled it on purpose; nothing to do.
 */
export type ObservationStreamOutcome = 'ended' | 'sessionLost' | 'superseded' | 'stopped';
