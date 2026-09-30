// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { EventContext } from '../events/EventContext.js';

/** Observable outcome of one ordered source-partition delivery (not a kernel checkpoint). */
export interface ReactorDeliveryResult {
    readonly sourceId: string;
    readonly handled: readonly EventContext[];
    readonly skipped: readonly EventContext[];
    readonly completed: boolean;
    readonly error?: unknown;
}
