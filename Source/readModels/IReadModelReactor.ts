// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ReadModelChangeset } from './ReadModelChangeset.js';

/** Optional convention handlers for a single read model. Returns may be asynchronous. */
export interface IReadModelReactor<TReadModel> {
    added?(model: TReadModel, changeset: ReadModelChangeset<TReadModel>): unknown;
    modified?(model: TReadModel, changeset: ReadModelChangeset<TReadModel>): unknown;
    removed?(model: TReadModel, changeset: ReadModelChangeset<TReadModel>): unknown;
}
