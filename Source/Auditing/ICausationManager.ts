// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Causation } from './Causation';
import { CausationType } from './CausationType';

/**
 * Defines a system that manages causation for the active call context.
 */
export interface ICausationManager {
    /**
     * Gets the root causation.
     */
    readonly root: Causation;

    /**
     * Gets the full causation chain for the current call context.
     * The chain always starts with {@link root} if no other causation has been added.
     * @returns An array of {@link Causation} representing the current chain.
     */
    getCurrentChain(): ReadonlyArray<Causation>;

    /**
     * Adds a causation entry to the current chain.
     * @param type - The type of causation to add.
     * @param properties - Properties associated with the causation.
     */
    add(type: CausationType, properties: Record<string, string>): void;
}
