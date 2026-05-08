// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Marker interface for reducer classes.
 *
 * Reducers observe events and fold them into a read model (state object).
 * Each handler method must follow the signature:
 *
 * ```typescript
 * async methodName(event: TEvent, state: TState | undefined, context?: EventContext): Promise<TState>
 * ```
 *
 * Classes implementing this interface must also be decorated with {@link reducer}.
 *
 * @typeParam TState - The type of the read model state that this reducer produces.
 */
export interface IReducer<TState = unknown> {
    /** The type used as a marker for TypeScript inference. */
    readonly _stateType?: TState;
}
