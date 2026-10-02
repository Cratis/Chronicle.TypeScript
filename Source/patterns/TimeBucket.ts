// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Parts of a day, using the same names and boundaries as Chronicle's pattern miner. */
export enum TimeBucket {
    /** 05:00 inclusive to 08:00 exclusive. */
    EarlyMorning = 'EarlyMorning',
    /** 08:00 inclusive to 11:00 exclusive. */
    Morning = 'Morning',
    /** 11:00 inclusive to 14:00 exclusive. */
    Midday = 'Midday',
    /** 14:00 inclusive to 17:00 exclusive. */
    Afternoon = 'Afternoon',
    /** 17:00 inclusive to 22:00 exclusive. */
    Evening = 'Evening',
    /** 22:00 inclusive to 05:00 exclusive, crossing midnight. */
    Night = 'Night'
}
