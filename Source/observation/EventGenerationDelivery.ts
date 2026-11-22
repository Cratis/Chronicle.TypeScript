// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { EventGenerationDelivery as WireDelivery } from '@cratis/chronicle.contracts';

/** Controls which generation the kernel delivers to an observer. */
export enum EventGenerationDelivery {
    /** Preserves the kernel's compatibility delivery behavior (the default). */
    Compatibility = 0,
    /** Delivers released content in the subscribed generation. Requires kernel 19.41.0 or later. */
    Pinned = 1
}

/** Maps client policy (including omitted legacy metadata) to the wire contract. */
export function toWireGenerationDelivery(delivery?: EventGenerationDelivery): WireDelivery {
    return delivery === EventGenerationDelivery.Pinned ? WireDelivery.Pinned : WireDelivery.Compatibility;
}
