// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Reported when a reactor batch method returns a value. Batch reactor methods do not return events or other side effects. */
export class BatchMethodReturnedAValue extends Error {
    /**
     * Creates a new {@link BatchMethodReturnedAValue}.
     * @param observerType - The name of the reactor class.
     * @param method - The name of the batch method.
     */
    constructor(readonly observerType: string, readonly method: string) {
        super(`Batch method '${method}' on reactor '${observerType}' returned a value. Batch reactor methods return nothing; ` +
            'append through an event log instead of returning events.');
        this.name = 'BatchMethodReturnedAValue';
    }
}
