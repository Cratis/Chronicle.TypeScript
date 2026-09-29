// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';

/**
 * Decides the container name a read model is stored under: the collection, table, or file the sink writes to.
 * The identifier the read model is registered and queried by is not affected.
 *
 * When no policy is configured the container name is the read model identifier.
 * @param identifier - The read model identifier.
 * @param readModelType - The read model class, when the client knows it. A projection whose read model is only
 * named by identifier has no class, so this is undefined.
 * @returns The container name to register the read model with.
 */
export type ReadModelNamingPolicy = (identifier: string, readModelType?: Constructor) => string;
