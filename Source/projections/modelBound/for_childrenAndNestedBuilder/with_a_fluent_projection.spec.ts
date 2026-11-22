// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { describe, it } from 'vitest';
import { fluent } from './given/compiled_projection.js';
import { assertCompositeDefinition, assertOracleInputAndCreation, assertRegisteredDefinition, assertScenarioRemainsRejected } from './given/assertions.js';

describe('when compiling composite child keys through the declarative builder', () => {
    it('should already preserve composite keys without synthesizing an identifier mapper', () => assertCompositeDefinition(fluent, {}));
    it('should register the same definition through the production registration path', () => assertRegisteredDefinition(fluent));
    it('should match the compiler-derived kernel creation and update fixture', () => assertOracleInputAndCreation(fluent));
    it('should keep composite child keys rejected by ReadModelScenario', () => assertScenarioRemainsRejected(fluent));
});
