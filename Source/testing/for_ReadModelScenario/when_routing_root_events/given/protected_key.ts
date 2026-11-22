// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { expect } from 'vitest';
import { ProjectionCapabilities } from '../../../projections/ProjectionCapabilities.js';
import { UnsupportedProjectionOperation } from '../../../projections/UnsupportedProjectionOperation.js';
import type { candidateFor } from './compiled_projection.js';

export function assertProtectedKeyRejected(candidate: ReturnType<typeof candidateFor>, protection: 'compliance' | 'security', metadataType: string): void {
    const compiled = candidate.compile();
    const definition = compiled.definitions[0];
    const eventSchema = [...compiled.eventSchemas.get(definition)!.values()][0].schema;
    expect(eventSchema.properties!.targetId[protection]).to.deep.equal([{ metadataType, details: '' }]);
    expect(definition.From[0].Value!.Properties).to.deep.equal({ name: 'title' });
    expect(JSON.parse(compiled.readModels[0].Schema).properties).not.to.have.property('targetId');
    expect(() => ProjectionCapabilities.validate(compiled, definition)).to.throw(UnsupportedProjectionOperation)
        .with.property('message').that.includes('Model').and.includes('From[').and.includes('].Key')
        .and.includes('protected fields require a kernel-backed test');
}
