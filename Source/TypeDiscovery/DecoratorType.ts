// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Represents the supported decorator categories for discoverable artifact types.
 */
export enum DecoratorType {
    /** Event type artifacts discovered through the eventType decorator. */
    EventType = 'eventType',

    /** Reactor artifacts discovered through the reactor decorator. */
    Reactor = 'reactor',

    /** Reducer artifacts discovered through the reducer decorator. */
    Reducer = 'reducer'
}
