// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Validated read criteria; route sentinels deliberately do not narrow history. */
export interface InProcessEventReadCriteria {
    readonly source?: string;
    readonly sourceType?: string;
    readonly streamType?: string;
    readonly streamId?: string;
    readonly ids: readonly string[];
}
