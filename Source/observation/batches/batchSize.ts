// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import type { PageDelivery } from '@cratis/chronicle.contracts';
import { availableParallelism } from 'node:os';

const METADATA_KEY = 'chronicle:observation:batchSize';

/** The bounds an observer declares for the pages the kernel delivers to it. */
export interface BatchSizeOptions {
    /** The most events in one page. The kernel's own maximum caps it. Defaults to the kernel's default. */
    readonly maxEvents?: number;

    /** The most bytes in one page. The kernel's own maximum caps it. Defaults to the kernel's default. */
    readonly maxBytes?: number;

    /** How long, in milliseconds, the kernel may wait to fill a live page. Defaults to no delay. */
    readonly maxDelayMilliseconds?: number;

    /**
     * How many event sources of one page a reducer reduces at the same time. Defaults to the number of processors;
     * `1` reduces them one after another. Reactors call their methods for a page in order and ignore it.
     */
    readonly maxConcurrency?: number;
}

/**
 * Declares the bounds of the pages a reactor or reducer receives, the TypeScript equivalent of the C# `[BatchSize]` attribute.
 * @param options - The {@link BatchSizeOptions}.
 * @returns A class decorator for legacy and standard TypeScript decorators.
 */
export function batchSize(options: BatchSizeOptions): ClassDecorator & ((value: Function, context: ClassDecoratorContext) => void) {
    for (const [name, value] of Object.entries(options)) {
        if (value !== undefined && (!Number.isInteger(value) || (value as number) < (name === 'maxDelayMilliseconds' ? 0 : 1))) {
            throw new RangeError(`Batch size '${name}' must be a ${name === 'maxDelayMilliseconds' ? 'non-negative' : 'positive'} integer.`);
        }
    }
    return (target: object, context?: ClassDecoratorContext) => {
        if (context !== undefined && context.kind !== 'class') {
            throw new TypeError('Batch size can only decorate a reactor or reducer class.');
        }
        Reflect.defineMetadata(METADATA_KEY, Object.freeze({ ...options }), target);
    };
}

/**
 * Gets the {@link BatchSizeOptions} declared on an observer class.
 * @param target - The observer class.
 * @returns The declared options, or an empty object when none are declared.
 */
export function getBatchSize(target: Function): BatchSizeOptions {
    return (Reflect.getOwnMetadata(METADATA_KEY, target) as BatchSizeOptions | undefined) ?? {};
}

/**
 * Gets how many event sources of one page a reducer reduces at the same time.
 * @param target - The reducer class.
 * @returns The declared concurrency, or the number of processors.
 */
export function getMaxConcurrency(target: Function): number {
    return getBatchSize(target).maxConcurrency ?? availableParallelism();
}

/**
 * Creates the page delivery the client opts in to at registration. A kernel that does not know page delivery ignores it
 * and keeps delivering one partition at a time.
 * @param target - The observer class.
 * @returns The {@link PageDelivery} for the registration.
 */
export function toPageDelivery(target: Function): PageDelivery {
    const options = getBatchSize(target);
    return {
        Enabled: true,
        MaxEventsPerPage: options.maxEvents ?? 0,
        MaxBytesPerPage: options.maxBytes ?? 0,
        MaxDelayMilliseconds: options.maxDelayMilliseconds ?? 0
    };
}
