// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';

/**
 * Optional registered event source routing for an event added to a unit of work.
 * Carried through to the append on commit, where it is validated like any other append.
 */
export interface TransactionalEventRouting {
    /** Registered event source definition (class decorated with `@eventSource`, or its name). */
    readonly eventSource?: Constructor | string;

    /** Stream name declared by {@link eventSource}. */
    readonly eventStream?: string;
}
