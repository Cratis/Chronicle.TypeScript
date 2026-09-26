// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Authentication failed permanently because the token endpoint rejected the credentials. */
export class RejectedChronicleCredentials extends Error {
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = 'RejectedChronicleCredentials';
    }
}
