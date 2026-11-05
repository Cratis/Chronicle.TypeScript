// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import { getHandledEventType } from '../events/handles.js';
import { getObservedEventTypes } from './batches/observes.js';

/** Finds prototype methods without invoking getters; explicit handlers and batch methods require explicitly decorated overrides. */
export function getInstanceMethods(type: Constructor): Map<string, Function> {
    const methods = new Map<string, Function>();
    const declaringTypes = new Map<string, string>();
    for (let current = type.prototype; current && current !== Object.prototype; current = Object.getPrototypeOf(current)) {
        for (const name of Object.getOwnPropertyNames(current)) {
            if (name === 'constructor') continue;
            const method = Object.getOwnPropertyDescriptor(current, name)?.value;
            const declaringType = declaringTypes.get(name);
            if (declaringType !== undefined) {
                const declaration = typeof method === 'function' ? describeExplicitHandler(method) : undefined;
                const override = methods.get(name);
                if (declaration && (!override || describeExplicitHandler(override) === undefined)) {
                    throw new Error(`Override '${name}' on '${declaringType}' hides ${declaration} declared on '${current.constructor.name}'; redecorate the override.`);
                }
                continue;
            }
            declaringTypes.set(name, current.constructor.name);
            if (typeof method === 'function') methods.set(name, method);
        }
    }
    return methods;
}

/** Describes the explicit handler decorator of a method, or undefined when it has none. */
export function describeExplicitHandler(method: Function): string | undefined {
    const eventType = getHandledEventType(method);
    if (eventType) return `@handles(${(eventType as Function).name})`;
    const observed = getObservedEventTypes(method);
    return observed.length > 0 ? observed.map(type => `@observes(${(type as Function).name})`).join(' ') : undefined;
}
