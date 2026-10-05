// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { NamedTag } from '../events/NamedTag.js';
import type { TransactionalEventRouting } from './TransactionalEventRouting.js';

/**
 * Optional metadata for an event added to a unit of work: registered event source routing and
 * structured named tags. Carried through to the append on commit.
 */
export interface TransactionalAppendOptions extends TransactionalEventRouting {
    /**
     * Structured named tags for the event. Validated when the event is added, so an invalid tag fails
     * before anything is committed; the first occurrence of each exact name and value pair is kept.
     */
    readonly namedTags?: ReadonlyArray<NamedTag>;
}
