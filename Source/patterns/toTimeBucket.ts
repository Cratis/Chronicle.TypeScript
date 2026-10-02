// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { PatternMoment } from './PatternMoment.js';
import { TimeBucket } from './TimeBucket.js';
import { toOffsetDate } from './toOffsetDate.js';

/**
 * Buckets a moment using its own offset, matching DateTimeOffset.ToTimeBucket() in Chronicle.
 * @param moment - The instant and the offset it occurred at, not the machine's offset.
 * @returns The time bucket, with inclusive starts and exclusive ends.
 * @throws {RangeError} If the date or offset is invalid.
 */
export function toTimeBucket(moment: PatternMoment): TimeBucket {
    const hour = toOffsetDate(moment).getUTCHours();
    if (hour >= 5 && hour < 8) return TimeBucket.EarlyMorning;
    if (hour >= 8 && hour < 11) return TimeBucket.Morning;
    if (hour >= 11 && hour < 14) return TimeBucket.Midday;
    if (hour >= 14 && hour < 17) return TimeBucket.Afternoon;
    if (hour >= 17 && hour < 22) return TimeBucket.Evening;
    return TimeBucket.Night;
}
