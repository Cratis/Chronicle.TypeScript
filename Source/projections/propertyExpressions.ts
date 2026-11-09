// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** The read model property expression that removes a dictionary entry; its target has to be a dynamic dictionary key. */
export const removeExpression = '$remove';

/**
 * Wraps an event value expression so the kernel only assigns it while the target property has no value yet.
 * @param expression - The event value expression, for example `name` or `$eventContext(Occurred)`.
 * @returns The `$setOnce(<expression>)` expression.
 */
export function setOnceExpression(expression: string): string {
    return `$setOnce(${expression})`;
}
