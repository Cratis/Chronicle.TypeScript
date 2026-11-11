// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Reports the first unsupported operation at its original contract path. */
export type ProjectionCapabilityReject = (path: string, reason: string, fallback?: string) => never;
