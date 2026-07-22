// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * The strategy used to select one server address from a multi-host connection string
 * (or a resolved set of `chronicle+srv://` addresses) for each connect/reconnect attempt.
 */
export enum LoadBalancerMode {
    /**
     * Probes every candidate's current connection count and picks the least-loaded one,
     * breaking ties randomly. The default strategy.
     */
    LeastConnections = 'least-connections',

    /**
     * Cycles through candidates in order, starting from a random offset chosen once per
     * strategy instance.
     */
    RoundRobin = 'round-robin',

    /**
     * Picks a uniformly random candidate on every call.
     */
    Random = 'random'
}
