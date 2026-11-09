// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Error thrown when a children collection is given more than one ordering. */
export class ChildrenOrderingAlreadyDefined extends Error {
    /** Creates the error. */
    constructor() {
        super('The children collection already has an ordering. Use only one of prepend(), orderBy() or orderByDescending().');
        this.name = 'ChildrenOrderingAlreadyDefined';
    }
}
