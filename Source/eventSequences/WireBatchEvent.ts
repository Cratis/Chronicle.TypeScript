// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { PreparedBatchAppend } from './PreparedBatchAppend.js';

/** A wire event of a batch append, optionally carrying the definition event source it is routed to. */
export type WireBatchEvent = PreparedBatchAppend['eventsToAppend'][number] & { EventSource?: string };
