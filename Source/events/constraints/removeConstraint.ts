// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { ChronicleClassDecorator } from '../../types/standardDecoratorMetadata.js';

const KEY = 'chronicle:constraint:remove';

/**
 * Marks an event class as releasing a named constraint when appended. May be applied repeatedly.
 * @param name - Exact name of the constraint to release.
 * @returns A class decorator.
 */
export function removeConstraint(name: string): ChronicleClassDecorator {
    return (target: object) => {
        const existing = Reflect.getOwnMetadata(KEY, target) as string[] | undefined ?? [];
        Reflect.defineMetadata(KEY, [...existing, name], target);
    };
}

/** Gets the constraint names released by this event class. */
export function getRemovedConstraintNames(type: Function): string[] {
    const names: string[] = [];
    for (let current: object | null = type; current && current !== Function.prototype; current = Object.getPrototypeOf(current)) {
        names.push(...(Reflect.getOwnMetadata(KEY, current) as string[] | undefined ?? []));
    }
    return [...new Set(names)];
}
