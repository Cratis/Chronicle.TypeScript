// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * The error that is thrown when a named tag has a blank name or a non-string value, or a named tag
 * collection contains an entry that is not a named tag. Mirrors the .NET client's `InvalidNamedTag`.
 */
export class InvalidNamedTag extends Error {
    constructor() {
        super('Named tags require a nonblank name and a non-null value; named tag collections cannot contain null elements.');
        this.name = 'InvalidNamedTag';
    }
}
