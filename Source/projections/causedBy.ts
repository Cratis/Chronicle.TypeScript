// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { InvalidCausedByProperty } from './InvalidCausedByProperty.js';

/** The identity members of the identity that caused an event, as the kernel's `$causedBy` expression accepts them. */
export type CausedByProperty = 'subject' | 'name' | 'userName';

const causedByProperties: readonly string[] = ['subject', 'name', 'userName'];

/**
 * Validates a member of the identity that caused an event. The kernel matches the member case-sensitively.
 * @param property - The identity member.
 * @returns The validated member.
 */
export function causedByProperty(property: string): CausedByProperty {
    if (!causedByProperties.includes(property)) {
        throw new InvalidCausedByProperty(property);
    }
    return property as CausedByProperty;
}

/**
 * Builds the `$causedBy` event value expression - the whole identity that caused the event, or one of its members.
 * @param property - Optional identity member; omit it for the whole identity.
 * @returns The `$causedBy` or `$causedBy(<member>)` expression.
 */
export function causedByExpression(property?: CausedByProperty): string {
    return property === undefined ? '$causedBy' : `$causedBy(${causedByProperty(property)})`;
}
