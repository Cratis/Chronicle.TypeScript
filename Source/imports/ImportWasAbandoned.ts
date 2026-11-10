// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Guid } from '@cratis/fundamentals';

/** The exception that is thrown when events are added to, or completed on, an import that was abandoned. */
export class ImportWasAbandoned extends Error {
    /**
     * Creates a new {@link ImportWasAbandoned}.
     * @param importId - The identifier of the import.
     */
    constructor(readonly importId: Guid) {
        super(`Import '${importId.toString()}' was abandoned.`);
        this.name = 'ImportWasAbandoned';
    }
}
