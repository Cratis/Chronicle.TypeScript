// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { PropertyAccessor } from '@cratis/fundamentals';
import { AddBuilder } from '../declarative/AddBuilder.js';
import type { IAddBuilder } from '../declarative/IAddBuilder.js';
import type { ISetBuilder } from '../declarative/ISetBuilder.js';
import type { ISubtractBuilder } from '../declarative/ISubtractBuilder.js';
import { SetBuilder } from '../declarative/SetBuilder.js';
import { SubtractBuilder } from '../declarative/SubtractBuilder.js';
import type { IGraphMappingBuilder } from './IGraphMappingBuilder.js';
import { propertyPathOf } from './propertyPathOf.js';

/**
 * Implements the property mappings shared by nodes and edges, recording them as expressions by property name.
 * @template TElement - The type of the node or edge.
 * @template TEvent - The type of event.
 * @template TSelf - The type of the builder, for continuation.
 */
export abstract class GraphMappingBuilder<TElement, TEvent, TSelf> implements IGraphMappingBuilder<TElement, TEvent, TSelf> {
    /** The property mapping expressions by property name. */
    readonly properties: Record<string, string> = {};

    /** Gets the builder to return for continuation. */
    protected abstract get self(): TSelf;

    /** @inheritdoc */
    set(propertyAccessor: PropertyAccessor<TElement>): ISetBuilder<TEvent, TSelf> {
        return new SetBuilder<TEvent, TSelf>(propertyPathOf(propertyAccessor), this.record, this.self);
    }

    /** @inheritdoc */
    add(propertyAccessor: PropertyAccessor<TElement>): IAddBuilder<TEvent, TSelf> {
        return new AddBuilder<TEvent, TSelf>(propertyPathOf(propertyAccessor), this.record, this.self);
    }

    /** @inheritdoc */
    subtract(propertyAccessor: PropertyAccessor<TElement>): ISubtractBuilder<TEvent, TSelf> {
        return new SubtractBuilder<TEvent, TSelf>(propertyPathOf(propertyAccessor), this.record, this.self);
    }

    /** @inheritdoc */
    increment(propertyAccessor: PropertyAccessor<TElement>): TSelf {
        return this.constant(propertyAccessor, '$increment');
    }

    /** @inheritdoc */
    decrement(propertyAccessor: PropertyAccessor<TElement>): TSelf {
        return this.constant(propertyAccessor, '$decrement');
    }

    /** @inheritdoc */
    count(propertyAccessor: PropertyAccessor<TElement>): TSelf {
        return this.constant(propertyAccessor, '$count');
    }

    private readonly record = (property: string, expression: string): void => {
        this.properties[property] = expression;
    };

    private constant(propertyAccessor: PropertyAccessor<TElement>, expression: string): TSelf {
        this.record(propertyPathOf(propertyAccessor), expression);
        return this.self;
    }
}
