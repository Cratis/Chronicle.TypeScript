// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { vi } from 'vitest';
import { QueryResultIEnumerableBehaviorPatternDetailsResponse, QueryResultIEnumerablePatternScopeResponse } from '@cratis/chronicle.contracts';
import type { PatternsClient } from '@cratis/chronicle.contracts';
import type { ChronicleConnection } from '../../../connection/index.js';
import { Patterns } from '../../Patterns.js';

export class a_patterns_service {
    response = QueryResultIEnumerableBehaviorPatternDetailsResponse.create({ IsAuthorized: true });
    scopesResponse = QueryResultIEnumerablePatternScopeResponse.create({ IsAuthorized: true });
    client = {
        matchingPatterns: vi.fn<PatternsClient['matchingPatterns']>().mockImplementation(async () => this.response),
        usualActions: vi.fn<PatternsClient['usualActions']>().mockImplementation(async () => this.response),
        patternsForScope: vi.fn<PatternsClient['patternsForScope']>().mockImplementation(async () => this.response),
        allPatternScopes: vi.fn<PatternsClient['allPatternScopes']>().mockImplementation(async () => this.scopesResponse),
        allPatterns: vi.fn<PatternsClient['allPatterns']>()
    } satisfies PatternsClient;
    patterns = new Patterns('accounts', 'tenant-a', { patterns: this.client } as unknown as ChronicleConnection);
}
