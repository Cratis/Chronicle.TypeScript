// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** A pair of JSON-serializable payload values in an ordered migration value map. */
export interface ValueMapping {
    /** The source payload value to match, including null or a numeric enum value. */
    readonly from: unknown;

    /** The replacement payload value. */
    readonly to: unknown;
}
