// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Named-tag batches require a kernel that preserves registered event source routing. */
export class NamedTagsWithRegisteredEventSourceNotSupported extends Error {
    constructor() {
        super('Batches and unit-of-work commits combining non-empty named tags with registered event sources require kernel 19.37.4 or later. ' +
            'The connected kernel version is older, unknown, or unparseable. ' +
            'Use single append calls instead. See https://github.com/Cratis/Chronicle/issues/4603.');
        this.name = 'NamedTagsWithRegisteredEventSourceNotSupported';
    }
}
