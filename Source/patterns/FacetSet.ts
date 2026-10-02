// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * A partial context of facet names and values. Use {@link FacetName} for well-known names;
 * custom names are also supported. An empty object constrains nothing. Empty values are omitted from queries.
 */
export type FacetSet = Readonly<Record<string, string>>;
