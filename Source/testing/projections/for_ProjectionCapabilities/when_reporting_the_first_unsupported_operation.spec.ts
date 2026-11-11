// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { chai, describe, it } from 'vitest';
import { ProjectionCapabilities } from '../ProjectionCapabilities.js';
import { UnsupportedProjectionOperation } from '../UnsupportedProjectionOperation.js';
import { Changed } from './given/Changed.js';
import { compileDeclarative } from './given/compile.js';

chai.should();

describe('when reporting the first unsupported operation', () => {
    const compile = () => compileDeclarative(builder => builder.from(Changed));

    it('should reject definition membership before missing evidence', () => {
        const { compiled, definition } = compile();
        (() => ProjectionCapabilities.validate({ ...compiled, definitions: [], provenance: new Map(), eventSchemas: new Map() }, definition))
            .should.throw(UnsupportedProjectionOperation, 'Definition (contract): definition is not part of this compile');
    });

    it('should reject missing provenance before a missing event catalog', () => {
        const { compiled, definition } = compile();
        (() => ProjectionCapabilities.validate({ ...compiled, provenance: new Map(), eventSchemas: new Map() }, definition))
            .should.throw(UnsupportedProjectionOperation, 'Definition (contract): capability provenance is unavailable');
    });

    it('should reject a missing catalog before passive projections', () => {
        const { compiled, definition } = compile();
        definition.IsActive = false;
        (() => ProjectionCapabilities.validate({ ...compiled, eventSchemas: new Map() }, definition))
            .should.throw(UnsupportedProjectionOperation, 'Definition (contract): event-schema catalog is unavailable');
    });

    it('should reject passive projections before malformed read-model schemas', () => {
        const { compiled, definition } = compile();
        definition.IsActive = false;
        compiled.readModels[0].Schema = '{';
        (() => ProjectionCapabilities.validate(compiled, definition))
            .should.throw(UnsupportedProjectionOperation, 'IsActive (contract): passive projections require a kernel-backed test');
    });

    it('should report malformed model schemas with their source declaration', () => {
        const { compiled, definition } = compile();
        compiled.readModels[0].Schema = '{';
        (() => ProjectionCapabilities.validate(compiled, definition))
            .should.throw(UnsupportedProjectionOperation, 'ReadModel.Schema (.from): read-model schema is not valid JSON');
    });

    it('should reject malformed initial JSON before invalid subscription keys', () => {
        const { compiled, definition } = compile();
        definition.InitialModelState = '[';
        definition.From[0].Value.Key = 'unsupported';
        (() => ProjectionCapabilities.validate(compiled, definition))
            .should.throw(UnsupportedProjectionOperation, 'InitialModelState (.withInitialValues): initial values must be a JSON object');
    });

    it('should report the first initial value in JSON property order', () => {
        const { compiled, definition } = compile();
        definition.InitialModelState = '{"unknownFirst":1,"unknownSecond":2}';
        (() => ProjectionCapabilities.validate(compiled, definition))
            .should.throw(UnsupportedProjectionOperation, 'InitialModelState.unknownFirst (.withInitialValues): initial value has no read-model schema');
    });

    it('should validate a destination schema before interpreting its expression', () => {
        const { compiled, definition } = compileDeclarative(builder => builder.from(Changed, from => from.set(model => model.state).to(event => event.name)));
        definition.From[0].Value.Properties.state = '$setOnce(name)';
        const schema = JSON.parse(compiled.readModels[0].Schema);
        schema.properties.state = { type: 'string', format: 'unsupported' };
        compiled.readModels[0].Schema = JSON.stringify(schema);
        (() => ProjectionCapabilities.validate(compiled, definition)).should.throw(UnsupportedProjectionOperation,
            "expression '$setOnce(name)': schema type/format 'string/unsupported' requires a kernel-backed test");
    });
});
