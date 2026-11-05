// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ObservationOrigin as ContractObservationOrigin } from '@cratis/chronicle.contracts';

/** The path a delivery of events to an observer came from. */
export enum ObservationOrigin {
    /** The origin is not known, for example because the kernel does not report it. */
    Unknown = 0,

    /** The events were appended now and delivered to an observer that is up to date. */
    Live = 1,

    /** The events were read from storage for an observer that is behind. */
    CatchUp = 2,

    /** The events were read from storage for an observer that was rewound. */
    Replay = 3,

    /** The events were read from storage to recover a failed or deferred partition. */
    Retry = 4
}

/**
 * Converts the origin the kernel reports to the client {@link ObservationOrigin}.
 * @param origin - The origin on the wire, or undefined when the kernel does not report one.
 * @returns The client {@link ObservationOrigin}.
 */
export function toObservationOrigin(origin: ContractObservationOrigin | undefined): ObservationOrigin {
    switch (origin) {
        case ContractObservationOrigin.Live: return ObservationOrigin.Live;
        case ContractObservationOrigin.CatchingUp: return ObservationOrigin.CatchUp;
        case ContractObservationOrigin.Replaying: return ObservationOrigin.Replay;
        case ContractObservationOrigin.Retrying: return ObservationOrigin.Retry;
        default: return ObservationOrigin.Unknown;
    }
}
