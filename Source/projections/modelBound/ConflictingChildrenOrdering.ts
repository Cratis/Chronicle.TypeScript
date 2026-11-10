// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Error thrown when the childrenFrom decorators on a property declare different orderings for the same children collection. */
export class ConflictingChildrenOrdering extends Error {
    /**
     * Creates the error.
     * @param property - The children property.
     */
    constructor(readonly property: string) {
        super(`The children property '${property}' declares more than one ordering. Use only one of prepend, orderBy or orderByDescending, and declare the same ordering on every @childrenFrom for the property or leave it unset.`);
        this.name = 'ConflictingChildrenOrdering';
    }
}
