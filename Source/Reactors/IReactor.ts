// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Marker interface for reactor classes.
 *
 * Reactors observe events from an event sequence and react by producing side effects.
 * Method dispatch is by convention: the type of the first parameter determines which
 * events a method handles. Each handler method must follow the signature:
 *
 * ```typescript
 * async methodName(event: TEvent, context?: EventContext): Promise<void>
 * ```
 *
 * Classes implementing this interface must also be decorated with {@link reactor}.
 */
export interface IReactor {}
