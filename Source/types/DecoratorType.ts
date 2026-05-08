// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Represents the supported decorator categories for discoverable artifact types.
 */
export enum DecoratorType {
    /** Event type artifacts discovered through the eventType decorator. */
    EventType = 'eventType',

    /** Read model artifacts discovered through the readModel decorator. */
    ReadModel = 'readModel',

    /** Reactor artifacts discovered through the reactor decorator. */
    Reactor = 'reactor',

    /** Reducer artifacts discovered through the reducer decorator. */
    Reducer = 'reducer',

    /** Constraint artifacts discovered through the constraint decorator. */
    Constraint = 'constraint',

    /** Declarative projection artifacts discovered through the projection decorator. */
    Projection = 'projection',

    /** Model-bound projection artifacts discovered through the modelBoundProjection decorator. */
    ModelBoundProjection = 'modelBoundProjection'
}
