// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { NamedTagsWithRegisteredEventSourceNotSupported } from './NamedTagsWithRegisteredEventSourceNotSupported.js';

/** Rejects only affected batches when the kernel cannot be confirmed to preserve registered routing. */
export function ensureNamedTagBatchIsSupported(hasNamedTags: boolean, hasRegisteredEventSource: boolean, kernelVersion?: string): void {
    if (hasNamedTags && hasRegisteredEventSource && !supportsNamedTagBatch(kernelVersion)) {
        throw new NamedTagsWithRegisteredEventSourceNotSupported();
    }
}

function supportsNamedTagBatch(kernelVersion?: string): boolean {
    // Development images and release builds share the same numeric release version.
    const version = /^(\d+)\.(\d+)\.(\d+)(?:[-+][0-9A-Za-z.+-]+)?$/.exec(kernelVersion ?? '');
    const minimum = [19, 37, 4];
    const difference = version?.slice(1).map((part, index) => Number(part) - minimum[index]).find(part => part !== 0) ?? 0;
    return version !== null && difference >= 0;
}
