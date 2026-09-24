// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// Node versions without native decorator metadata need this before evaluating a decorated class.
const symbolWithMetadata = Symbol as unknown as { metadata: symbol };
symbolWithMetadata.metadata ??= Symbol.for('Symbol.metadata');

/** A class decorator accepted by both the legacy and standard TypeScript transforms. */
export type ChronicleClassDecorator = ClassDecorator & ((value: Function, context: ClassDecoratorContext) => void);

/** Gets the metadata object attached when a standard-decorated class finishes evaluation. */
export function getStandardMetadata(type: Function): object | undefined {
    return Reflect.get(type, symbolWithMetadata.metadata) as object | undefined;
}

/** Whether a class completed its own standard decorator evaluation. */
export function hasOwnStandardMetadata(type: Function): boolean {
    return Object.prototype.hasOwnProperty.call(type, symbolWithMetadata.metadata);
}

/** Prevents a class decorator from inspecting fields before their metadata is attached. */
export function requireCompletedStandardMetadata(type: Function): void {
    if (!hasOwnStandardMetadata(type)) {
        throw new TypeError(`Standard decorator metadata for ${type.name} is not complete; inspect its schema after class evaluation.`);
    }
}
