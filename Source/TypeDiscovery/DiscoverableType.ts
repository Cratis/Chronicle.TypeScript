// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Represents a class constructor that can be discovered through decorators.
 */
export type DiscoverableType = Function & (abstract new (...args: never[]) => unknown);
