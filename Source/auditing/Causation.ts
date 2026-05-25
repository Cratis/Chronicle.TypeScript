// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { CausationType } from './CausationType';

/**
 * Represents a causation instance.
 */
export class Causation {
    /**
     * Creates an unknown causation instance.
     * @returns A new {@link Causation} with the current time, type set to {@link CausationType.unknown}, and empty properties.
     */
    static unknown(): Causation {
        return new Causation(new Date(), CausationType.unknown, {});
    }

    /**
     * Initializes a new instance of the {@link Causation} class.
     * @param occurred - When it occurred.
     * @param type - Type of causation.
     * @param properties - Any properties associated with the causation.
     */
    constructor(
        readonly occurred: Date,
        readonly type: CausationType,
        readonly properties: Readonly<Record<string, string>>
    ) {}
}
