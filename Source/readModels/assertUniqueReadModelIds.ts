// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import { getReadModelId } from './readModel.js';

/** Refuses to register two different model types under the same storage identity. */
export function assertUniqueReadModelIds(types: Iterable<Constructor>): void {
    const byId = new Map<string, Constructor>();
    for (const type of types) {
        const id = getReadModelId(type);
        const previous = byId.get(id);
        if (previous && previous !== type) {
            throw new Error(`Read model id '${id}' is shared by '${previous.name}' and '${type.name}'.`);
        }
        byId.set(id, type);
    }
}
