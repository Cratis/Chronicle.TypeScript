// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { DayOfWeek } from './DayOfWeek.js';
import type { PatternMoment } from './PatternMoment.js';
import { toOffsetDate } from './toOffsetDate.js';

const days = [DayOfWeek.Sunday, DayOfWeek.Monday, DayOfWeek.Tuesday, DayOfWeek.Wednesday,
    DayOfWeek.Thursday, DayOfWeek.Friday, DayOfWeek.Saturday];

/**
 * Reads the day at a moment's own offset, using Chronicle's English day names.
 * @param moment - The instant and the offset it occurred at.
 * @returns The day of week used by the Day facet.
 * @throws {RangeError} If the date or offset is invalid.
 */
export function toDayOfWeek(moment: PatternMoment): DayOfWeek {
    return days[toOffsetDate(moment).getUTCDay()];
}
