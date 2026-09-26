// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** A compiled projection uses a kernel feature outside the infrastructure-free scenario boundary. */
export class UnsupportedProjectionOperation extends Error {
    constructor(model: string, contractPath: string, declaration: string, reason: string) {
        super(`UnsupportedProjectionOperation: ${model}, ${contractPath} (${declaration}): ${reason}`);
        this.name = 'UnsupportedProjectionOperation';
    }
}
