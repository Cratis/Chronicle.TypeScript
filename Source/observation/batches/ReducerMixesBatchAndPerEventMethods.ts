// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Thrown at registration when a reducer declares a batch method and per-event methods, or more than one batch method. */
export class ReducerMixesBatchAndPerEventMethods extends Error {
    /**
     * Creates a new {@link ReducerMixesBatchAndPerEventMethods}.
     * @param reducerType - The name of the reducer class.
     * @param methods - The methods that conflict.
     */
    constructor(readonly reducerType: string, readonly methods: readonly string[]) {
        super(`Reducer '${reducerType}' declares ${methods.map(method => `'${method}'`).join(', ')}. ` +
            'A reducer has either per-event methods or exactly one batch method, never both, because it is a single fold over one event source.');
        this.name = 'ReducerMixesBatchAndPerEventMethods';
    }
}
