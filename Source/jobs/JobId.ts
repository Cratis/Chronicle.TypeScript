// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Guid } from '@cratis/fundamentals';

/**
 * Represents the unique identifier of a job.
 */
export class JobId {
    constructor(readonly value: Guid) {}

    /**
     * Creates a {@link JobId} from a string or Guid.
     * @param value - The value to create from.
     * @returns A {@link JobId} instance.
     */
    static from(value: string | Guid): JobId {
        return new JobId(typeof value === 'string' ? Guid.parse(value) : value);
    }

    /** @inheritdoc */
    toString(): string {
        return this.value.toString();
    }
}
