// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { chai, describe, it } from 'vitest';
import { childrenFrom } from '../../../projections/modelBound/childrenFrom.js';
import { entersOn } from '../../../projections/modelBound/entersOn.js';
import { fromEvent } from '../../../projections/modelBound/fromEvent.js';
import { variantOf } from '../../../projections/modelBound/variantOf.js';
import { getEventTypeJsonSchemaFor } from '../../../events/eventTypeDecorator.js';
import { ProjectionDefinitionCompiler } from '../../../projections/ProjectionDefinitionCompiler.js';
import type { IClientArtifactsProvider } from '../../../artifacts/index.js';
import { Changed } from './given/Changed.js';
import { Removed } from './given/Removed.js';
import { Model } from './given/Model.js';
import { compileDeclarative, compileModelBound } from './given/compile.js';

chai.should();

describe('when compiling capability evidence', () => {
    it('should retain model-bound variant declarations before joins and sibling removal obscure them', () => {
        class Identity {}
        class First extends Model {}
        class Second extends Model {}
        fromEvent(Changed)(First);
        fromEvent(Removed)(Second);
        variantOf(Identity, 'id')(First);
        variantOf(Identity, 'id')(Second);
        entersOn(Changed)(First);
        entersOn(Removed)(Second);
        const artifacts: IClientArtifactsProvider = {
            readModels: [First, Second], projections: [], eventTypes: [Changed, Removed], globalForHandlers: [],
            reactors: [], reducers: [], seeders: [], constraints: [], webhooks: [], eventTypeMigrations: []
        };
        const compiled = new ProjectionDefinitionCompiler(artifacts, 'test-sink').compile([], [First, Second]);
        const first = compiled.definitions[0];
        compiled.provenance.get(first)!.should.deep.include({ contractPath: 'Variant', declaration: '@variantOf' });
        compiled.provenance.get(first)!.should.deep.include({ contractPath: 'EntersOn[capability-changed:1]', declaration: '@entersOn' });
        compiled.eventSchemas.get(first)!.has('capability-removed:1:0').should.be.true;
        (first.RemovedWith?.length ?? 0).should.equal(1);
    });

    it('should retain declarative variant provenance before update-only joins replace From', () => {
        class Identity {}
        const { compiled, definition } = compileDeclarative(builder => builder
            .variantOf(Identity, model => model.id).entersOn(Changed).from(Changed).from(Removed));
        compiled.provenance.get(definition)!.should.deep.include({ contractPath: 'Variant', declaration: '.variantOf' });
        compiled.provenance.get(definition)!.should.deep.include({ contractPath: 'From[capability-removed:1]', declaration: '.from' });
        (definition.Join?.length ?? 0).should.equal(1);
        compiled.eventSchemas.get(definition)!.has('capability-removed:1:0').should.be.true;
    });

    it('should catalog child events even though no root From entry refers to them', () => {
        const { compiled, definition } = compileModelBound(model => childrenFrom(Removed)(model.prototype, 'name'));
        compiled.eventSchemas.get(definition)!.has('capability-removed:1:0').should.be.true;
        compiled.provenance.get(definition)!.should.deep.include({ contractPath: 'Children.name', declaration: '@childrenFrom' });
    });

    it('should isolate event schemas from later compiles and registration metadata', () => {
        const first = compileModelBound();
        const second = compileModelBound();
        const firstSchema = first.compiled.eventSchemas.get(first.definition)!.get('capability-changed:1:0')!.schema;
        const secondSchema = second.compiled.eventSchemas.get(second.definition)!.get('capability-changed:1:0')!.schema;
        firstSchema.properties!.name.type = 'boolean';
        secondSchema.properties!.name.type.should.equal('string');
        getEventTypeJsonSchemaFor(Changed).properties!.name.type.should.equal('string');
    });
});
