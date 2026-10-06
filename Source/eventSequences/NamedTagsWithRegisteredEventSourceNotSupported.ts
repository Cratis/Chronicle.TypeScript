// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Named-tag batches cannot preserve registered event source routing on the current kernel. */
export class NamedTagsWithRegisteredEventSourceNotSupported extends Error {
    constructor() {
        super('Batches and unit-of-work commits cannot combine non-empty named tags with registered event sources: ' +
            'the kernel named-tag batch operation drops registered event source routing. ' +
            'Use single append calls instead. See https://github.com/Cratis/Chronicle/issues/4603.');
        this.name = 'NamedTagsWithRegisteredEventSourceNotSupported';
    }
}
