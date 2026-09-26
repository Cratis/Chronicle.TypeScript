// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Materialized state and explicit removal status for one source. */
export type ReadModelState<T> = { instance: T | null; deleted: boolean };
