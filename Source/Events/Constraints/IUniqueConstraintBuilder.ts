// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { PropertyAccessor } from '@cratis/fundamentals';

/**
 * Defines the builder for building unique constraints.
 * Matches the C# IUniqueConstraintBuilder contract.
 */
export interface IUniqueConstraintBuilder {
    /**
     * Defines the name of the unique constraint.
     * The name is optional and if not provided, it will use the type name the constraint belongs to.
     * @param name - Name to use.
     * @returns This builder for fluent chaining.
     */
    withName(name: string): IUniqueConstraintBuilder;

    /**
     * Constrains on specific properties of an event type.
     * @param properties - Property accessor expressions for specifying the properties on the event.
     * @returns This builder for fluent chaining.
     */
    on<TEvent>(...properties: PropertyAccessor<TEvent>[]): IUniqueConstraintBuilder;

    /**
     * Ignores casing when comparing property values during constraint evaluation.
     * @returns This builder for fluent chaining.
     */
    ignoreCasing(): IUniqueConstraintBuilder;

    /**
     * Specifies the event type that removes this unique constraint (e.g. a deletion event).
     * @param eventType - The event constructor that removes the constraint.
     * @returns This builder for fluent chaining.
     */
    removedWith(eventType: Function): IUniqueConstraintBuilder;

    /**
     * Specifies a static message to use when the unique constraint is violated.
     * @param message - The violation message.
     * @returns This builder for fluent chaining.
     */
    withMessage(message: string): IUniqueConstraintBuilder;

    /**
     * Specifies a provider function that produces the violation message dynamically.
     * @param messageProvider - Callback that returns the violation message.
     * @returns This builder for fluent chaining.
     */
    withMessageFrom(messageProvider: () => string): IUniqueConstraintBuilder;
}
