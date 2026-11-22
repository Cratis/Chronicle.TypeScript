// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** A completed single or batch append measurement with its metric dimensions. */
export interface AppendMetricsContext {
    readonly eventCount: number;
    readonly durationInSeconds: number;
    readonly attributes: Record<string, string>;
}
