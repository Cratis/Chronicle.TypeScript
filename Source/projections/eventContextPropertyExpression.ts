// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Build the expression read by Chronicle's event-context resolver, using CLR property casing. */
export function eventContextPropertyExpression(propertyPath: string): string {
    const clrPath = propertyPath.split('.').map(segment => segment.charAt(0).toUpperCase() + segment.slice(1)).join('.');
    return `$eventContext(${clrPath})`;
}
