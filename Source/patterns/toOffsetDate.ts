// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { PatternMoment } from './PatternMoment.js';

/**
 * Produces a date whose UTC fields represent the moment's wall-clock fields.
 * Internal only: the shifted value must never be used as an actual instant.
 * @param moment - An instant and its explicit offset.
 * @returns The shifted date for reading UTC calendar fields.
 */
export function toOffsetDate(moment: PatternMoment): Date {
    if (!Number.isInteger(moment.offsetMinutes) || Math.abs(moment.offsetMinutes) > 14 * 60) {
        throw new RangeError('The moment offset must be a whole number of minutes between -840 and 840.');
    }
    const milliseconds = moment.instant.getTime();
    const shifted = new Date(milliseconds + moment.offsetMinutes * 60_000);
    if (!Number.isFinite(milliseconds) || !Number.isFinite(shifted.getTime())) {
        throw new RangeError('The moment must represent a valid date at its offset.');
    }
    return shifted;
}
