// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** A compiled projection uses a kernel feature outside the infrastructure-free scenario boundary. */
export class UnsupportedProjectionOperation extends Error {
    /**
     * @param model - The read model being evaluated.
     * @param contractPath - Location of the unsupported operation in the compiled contract.
     * @param declaration - Source declaration responsible for the operation.
     * @param reason - Why an infrastructure-free evaluation cannot represent it.
     */
    constructor(model: string, contractPath: string, declaration: string, reason: string) {
        super(`UnsupportedProjectionOperation: ${model}, ${contractPath} (${declaration}): ${reason}`);
        this.name = 'UnsupportedProjectionOperation';
    }
}
