// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import { getHandledEventType } from '../events/handles.js';

/** Finds prototype methods without invoking getters; explicit handlers require explicitly decorated overrides. */
export function getInstanceMethods(type: Constructor): Map<string, Function> {
    const methods = new Map<string, Function>();
    const declaringTypes = new Map<string, string>();
    for (let current = type.prototype; current && current !== Object.prototype; current = Object.getPrototypeOf(current)) {
        for (const name of Object.getOwnPropertyNames(current)) {
            if (name === 'constructor') continue;
            const method = Object.getOwnPropertyDescriptor(current, name)?.value;
            const declaringType = declaringTypes.get(name);
            if (declaringType !== undefined) {
                const eventType = typeof method === 'function' ? getHandledEventType(method) : undefined;
                const override = methods.get(name);
                if (eventType && (!override || getHandledEventType(override) === undefined)) {
                    throw new Error(`Override '${name}' on '${declaringType}' hides @handles(${(eventType as Function).name}) declared on '${current.constructor.name}'; redecorate the override.`);
                }
                continue;
            }
            declaringTypes.set(name, current.constructor.name);
            if (typeof method === 'function') methods.set(name, method);
        }
    }
    return methods;
}
