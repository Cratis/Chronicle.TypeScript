// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { AppendedEventResponse } from '@cratis/chronicle.contracts';

/** Shared metadata shape; generated services use distinct observation-state enum types. */
export type WireEventContext = Omit<NonNullable<AppendedEventResponse['Context']>, 'ObservationState'> & {
    /** Numeric wire value shared by the generated observation-state enums. */
    ObservationState: number;
    /** Store metadata is carried by observer deliveries, but not every read response. */
    EventStore?: string;
    /** Namespace metadata is carried by observer deliveries, but not every read response. */
    Namespace?: string;
};
