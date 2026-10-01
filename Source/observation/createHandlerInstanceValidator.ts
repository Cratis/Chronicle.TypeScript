// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import { getHandledEventType } from '../events/handles.js';
import { getInstanceMethods } from './getInstanceMethods.js';

/** Captures @handles prototype methods during preflight and rejects instance properties hiding them, except bound methods. */
export function createHandlerInstanceValidator(type: Constructor, names: Iterable<string>, methods = getInstanceMethods(type)):
    (instance: object) => void {
    const handlers = [...new Set(names)].filter(name => getHandledEventType(methods.get(name)!) !== undefined).map(name => {
        const method = methods.get(name)!;
        let declaring = type.prototype;
        while (declaring && Object.getOwnPropertyDescriptor(declaring, name)?.value !== method) {
            declaring = Object.getPrototypeOf(declaring);
        }
        const eventType = getHandledEventType(method)!;
        const declaration = `@handles(${(eventType as Function).name})`;
        return { name, method, declaration, declaringType: declaring?.constructor.name ?? type.name };
    });
    return instance => {
        for (const { name, method, declaration, declaringType } of handlers) {
            let current: object | null = instance;
            while (current && !Object.hasOwn(current, name)) current = Object.getPrototypeOf(current) as object | null;
            const value: unknown = current ? Object.getOwnPropertyDescriptor(current, name)?.value : undefined;
            if (current === instance && typeof value === 'function' && value.name === `bound ${method.name}`) continue;
            if (current === instance || !current || value !== method) {
                throw new Error(`Override '${name}' on '${type.name}' hides ${declaration} declared on '${declaringType}'; use a method with @handles instead of an instance field.`);
            }
        }
    };
}
