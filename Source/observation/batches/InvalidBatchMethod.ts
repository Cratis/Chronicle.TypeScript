// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Thrown at registration when a method decorated with `@observes` cannot be used as a batch method. */
export class InvalidBatchMethod extends Error {
    /**
     * Creates a new {@link InvalidBatchMethod}.
     * @param observerType - The name of the observer class.
     * @param method - The name of the method.
     * @param reason - Why the method cannot be a batch method.
     */
    constructor(readonly observerType: string, readonly method: string, reason: string) {
        super(`Batch method '${method}' on '${observerType}' is not valid: ${reason}`);
        this.name = 'InvalidBatchMethod';
    }
}
