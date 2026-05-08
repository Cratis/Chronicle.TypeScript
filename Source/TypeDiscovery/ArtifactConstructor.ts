// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Represents a class constructor for a discoverable artifact type.
 */
export type ArtifactConstructor = Function & (abstract new (...args: never[]) => unknown);
