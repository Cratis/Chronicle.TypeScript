// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { NamedTagsWithRegisteredEventSourceNotSupported } from './NamedTagsWithRegisteredEventSourceNotSupported.js';

/** Rejects the combination before any RPC, even when tags and registered routing belong to different entries. */
export function ensureNamedTagBatchIsSupported(hasNamedTags: boolean, hasRegisteredEventSource: boolean): void {
    if (hasNamedTags && hasRegisteredEventSource) {
        throw new NamedTagsWithRegisteredEventSourceNotSupported();
    }
}
