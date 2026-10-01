// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';

/** Finds prototype methods without invoking getters; derived members shadow base members. */
export function getInstanceMethods(type: Constructor): Map<string, Function> {
    const methods = new Map<string, Function>();
    const seenNames = new Set<string>(['constructor']);
    for (let current = type.prototype; current && current !== Object.prototype; current = Object.getPrototypeOf(current)) {
        for (const name of Object.getOwnPropertyNames(current)) {
            if (seenNames.has(name)) continue;
            seenNames.add(name);
            const method = Object.getOwnPropertyDescriptor(current, name)?.value;
            if (typeof method === 'function') methods.set(name, method);
        }
    }
    return methods;
}
