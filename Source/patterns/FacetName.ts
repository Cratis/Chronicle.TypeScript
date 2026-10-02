// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Well-known contextual dimensions mined from an event's context. */
export enum FacetName {
    CommandType = 'CommandType',
    InitiatorType = 'InitiatorType',
    InitiatorId = 'InitiatorId',
    OnBehalfOf = 'OnBehalfOf',
    CausedByCommand = 'CausedByCommand',
    CorrelationRootId = 'CorrelationRootId',
    AggregateType = 'AggregateType',
    Year = 'Year',
    Month = 'Month',
    Day = 'Day',
    TimeBucket = 'TimeBucket'
}
