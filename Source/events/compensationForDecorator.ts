// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { Constructor } from '@cratis/fundamentals';

/** Metadata key used to store the compensated event type on a class. */
const COMPENSATION_FOR_METADATA_KEY = 'chronicle:compensationFor';

/**
 * TypeScript decorator that declares an event type as a compensation for another event type.
 * This is the TypeScript equivalent of the C# `[CompensationFor<TEventType>]` attribute.
 *
 * Chronicle registers the link with the event type's schema. A compensation event type can compensate
 * for one event type, and is appended with `IEventSequence.compensate()`.
 *
 * Apply it together with {@link eventType}; the order of the decorators does not matter.
 *
 * @param compensated - The class of the event type being compensated for.
 * @returns A class decorator.
 *
 * @example
 * ```typescript
 * @eventType()
 * class EntryPosted { constructor(readonly amount: number) {} }
 *
 * @eventType()
 * @compensationFor(EntryPosted)
 * class EntryReversed { constructor(readonly reason: string) {} }
 * ```
 */
export function compensationFor(compensated: Constructor): (target: object, context?: ClassDecoratorContext) => void {
    return (target: object, context?: ClassDecoratorContext) => {
        Reflect.defineMetadata(COMPENSATION_FOR_METADATA_KEY, compensated, target);
        context?.addInitializer(function () {
            Reflect.defineMetadata(COMPENSATION_FOR_METADATA_KEY, compensated, this as object);
        });
    };
}

/**
 * Gets the class of the event type that a class declared as a compensation with {@link compensationFor} compensates for.
 * @param target - The class constructor to inspect.
 * @returns The compensated event class, or undefined when the class is not a compensation.
 */
export function getCompensatedTypeFor(target: Function): Constructor | undefined {
    return Reflect.getMetadata(COMPENSATION_FOR_METADATA_KEY, target) as Constructor | undefined;
}
