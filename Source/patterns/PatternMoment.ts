// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * An instant with its own UTC offset, which a JavaScript Date alone cannot retain.
 * The offset is fixed for this instant, not an IANA time zone or a daylight-saving rule.
 */
export interface PatternMoment {
    /** The instant to ask about. Must be a valid Date. */
    readonly instant: Date;
    /** Minutes east of UTC, from -840 to 840 inclusive, in whole minutes. For example, +02:00 is 120. */
    readonly offsetMinutes: number;
}
