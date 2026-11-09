// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { PropertyAccessor, PropertyPathResolverProxyHandler } from '@cratis/fundamentals';

/**
 * Resolves the path of the property an accessor selects.
 * @param accessor - The property accessor, for example `event => event.personId`.
 * @returns The property path.
 */
export function propertyPathOf<T>(accessor: PropertyAccessor<T>): string {
    const handler = new PropertyPathResolverProxyHandler();
    accessor(new Proxy({}, handler) as T);
    return handler.property;
}
