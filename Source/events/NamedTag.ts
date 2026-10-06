// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { InvalidNamedTag } from './InvalidNamedTag.js';

// Matches .NET string.IsNullOrWhiteSpace, which also treats U+0085 and other Unicode white space as blank.
const blank = /^\p{White_Space}*$/u;

/**
 * Associates a name with an exact, opaque event tag value. Names and values are compared exactly
 * (ordinal and case-sensitive); one name may carry several values on the same event.
 * Mirrors the .NET client's `NamedTag`.
 */
export class NamedTag {
    /** The name of the tag. Never blank. */
    readonly name: string;

    /** The exact, opaque value of the tag. May be empty. */
    readonly value: string;

    /**
     * Initializes a new instance of {@link NamedTag}.
     * @param name - The name. Must be a nonblank string.
     * @param value - The opaque value. Must be a string; the empty string is allowed.
     * @throws {@link InvalidNamedTag} when the name is blank or not a string, or the value is not a string.
     */
    constructor(name: string, value: string) {
        if (typeof name !== 'string' || blank.test(name) || typeof value !== 'string') {
            throw new InvalidNamedTag();
        }
        this.name = name;
        this.value = value;
        Object.freeze(this);
    }

    /**
     * Determines whether this tag has the same name and value as another, compared exactly.
     * @param other - The tag to compare with.
     * @returns True when both name and value are equal.
     */
    equals(other: NamedTag): boolean {
        return other instanceof NamedTag && other.name === this.name && other.value === this.value;
    }
}
