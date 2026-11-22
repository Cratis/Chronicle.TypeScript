// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { field } from '@cratis/fundamentals';
import { describe, it } from 'vitest';
import { pii } from '../../../compliance/pii.js';
import { encrypted } from '../../../confidentiality/encrypted.js';
import { eventType } from '../../../events/eventTypeDecorator.js';
import { fromEvent } from '../../../projections/modelBound/fromEvent.js';
import { setFrom } from '../../../projections/modelBound/setFrom.js';
import { Changed, candidateFor } from './given/compiled_projection.js';
import { assertOracleInput, assertOracleReads } from './given/oracle_input.js';
import { assertProtectedKeyRejected } from './given/protected_key.js';

@fromEvent(Changed, { key: 'targetId' })
class Model {
    @field(String) id!: string;
    @field(String) @setFrom(Changed, 'title') name!: string;
}
export const standard = candidateFor('routed-root-standard', Model, []);

@eventType('RoutedStandardPiiChanged')
class PiiChanged {
    @field(String) @pii() targetId!: string;
    @field(String) title!: string;
}
@eventType('RoutedStandardEncryptedChanged')
class EncryptedChanged {
    @field(String) @encrypted() targetId!: string;
    @field(String) title!: string;
}
@fromEvent(PiiChanged, { key: 'targetId' })
class PiiModel {
    @field(String) id!: string;
    @field(String) @setFrom(PiiChanged, 'title') name!: string;
}
@fromEvent(EncryptedChanged, { key: 'targetId' })
class EncryptedModel {
    @field(String) id!: string;
    @field(String) @setFrom(EncryptedChanged, 'title') name!: string;
}

describe('when routing standard-decorator root events by content', () => {
    it('should retain the exact compiler input sent to the kernel oracle', () => assertOracleInput(standard));
    it('should match every kernel prefix and repeated public read', () => assertOracleReads(standard));
    it('should reject an unmapped PII key', () => assertProtectedKeyRejected(
        candidateFor('routed-root-protected-standard', PiiModel, [], [PiiChanged]), 'compliance', 'PII'));
    it('should reject an unmapped encrypted key', () => assertProtectedKeyRejected(
        candidateFor('routed-root-protected-standard', EncryptedModel, [], [EncryptedChanged]), 'security', 'EncryptedSubject'));
});
