// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** The exception that is thrown when the Chronicle kernel does not support imports. */
export class ImportsNotSupported extends Error {
    constructor() {
        super('The Chronicle kernel does not support importing events. Upgrade the kernel to a version that serves the Imports service.');
        this.name = 'ImportsNotSupported';
    }
}
