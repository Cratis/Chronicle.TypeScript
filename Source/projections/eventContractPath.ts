// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ContractEventType } from './declarative/ProjectionBuilderCore.js';

/** Stable, generation-aware path shared by provenance and capability diagnostics. */
export function eventContractPath(section: string, eventType: ContractEventType): string {
    return `${section}[${eventType.Id}:${eventType.Generation}]`;
}
