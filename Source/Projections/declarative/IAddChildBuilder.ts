// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { PropertyAccessor } from '@cratis/fundamentals';

/**
 * Defines a builder for configuring how a child model is added from an event.
 * @template TChildModel - The child model type.
 * @template TEvent - The event type.
 */
export interface IAddChildBuilder<TChildModel, TEvent> {
    /**
     * Specifies the property on the child model used to identify instances in the collection.
     * @param childPropertyAccessor - Accessor for the identifying property on the child model.
     * @returns This builder for fluent chaining.
     */
    identifiedBy(childPropertyAccessor: PropertyAccessor<TChildModel>): IAddChildBuilder<TChildModel, TEvent>;

    /**
     * Specifies the event property used as the key when adding a child.
     * @param eventPropertyAccessor - Accessor for the key property on the event.
     * @returns This builder for fluent chaining.
     */
    usingKey(eventPropertyAccessor: PropertyAccessor<TEvent>): IAddChildBuilder<TChildModel, TEvent>;
}
