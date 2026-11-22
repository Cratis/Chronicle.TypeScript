// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { field } from '@cratis/fundamentals';
import { describe, it } from 'vitest';
import { pii } from '../../../compliance/pii.js';
import { encrypted } from '../../../confidentiality/encrypted.js';
import { eventType } from '../../../events/eventTypeDecorator.js';
import { projection } from '../../../projections/declarative/projection.js';
import type { IProjectionBuilderFor } from '../../../projections/declarative/IProjectionBuilderFor.js';
import { Model, candidateFor, fluent } from './given/compiled_projection.js';
import { assertProtectedKeyRejected } from './given/protected_key.js';
import { assertOracleInput, assertOracleReads } from './given/oracle_input.js';

@eventType('RoutedFluentPiiChanged')
class PiiChanged {
    @field(String) @pii() targetId!: string;
    @field(String) title!: string;
}
@eventType('RoutedFluentEncryptedChanged')
class EncryptedChanged {
    @field(String) @encrypted() targetId!: string;
    @field(String) title!: string;
}

function protectedCandidate(event: typeof PiiChanged | typeof EncryptedChanged) {
    @projection('routed-root-protected-fluent', Model)
    class ProtectedProjection {
        define(builder: IProjectionBuilderFor<Model>): void {
            builder.from(event, from => from.usingKey(value => value.targetId).set(model => model.name).to(value => value.title));
        }
    }
    return candidateFor('routed-root-protected-fluent', Model, [ProtectedProjection], [event]);
}

describe('when routing fluent root events by content', () => {
    it('should retain the exact compiler input sent to the kernel oracle', () => assertOracleInput(fluent));
    it('should match every kernel prefix and repeated public read', () => assertOracleReads(fluent));
    it('should reject an unmapped PII key', () => assertProtectedKeyRejected(protectedCandidate(PiiChanged), 'compliance', 'PII'));
    it('should reject an unmapped encrypted key', () => assertProtectedKeyRejected(protectedCandidate(EncryptedChanged), 'security', 'EncryptedSubject'));
});
