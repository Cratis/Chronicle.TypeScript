// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ICompositeKeyBuilder } from './ICompositeKeyBuilder.js';
import { ISetBuilder } from './ISetBuilder.js';

/**
 * Configures an expression for a composite key part, retaining its target property type.
 * @template TKeyType - The composite key type.
 * @template TEvent - The event type.
 * @template TProperty - The selected key property's type.
 */
export interface ICompositeKeySetBuilder<TKeyType, TEvent, TProperty>
    extends Omit<ISetBuilder<TEvent, ICompositeKeyBuilder<TKeyType, TEvent>>, 'toValue'> {
    /**
     * Sets the key part to a constant of the selected property's type.
     * @param value - The constant value to assign.
     * @returns The composite key builder for fluent chaining.
     */
    toValue(value: TProperty): ICompositeKeyBuilder<TKeyType, TEvent>;
}
