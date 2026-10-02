// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { field } from '@cratis/fundamentals';
import { beforeEach, chai, describe, it } from 'vitest';
import { fromAll } from '../modelBound/fromAll.js';
import { fromEvery } from '../modelBound/fromEvery.js';
import { ReadModelScenario } from '../../testing/ReadModelScenario.js';
import { UnsupportedProjectionOperation } from '../../testing/projections/UnsupportedProjectionOperation.js';
import { compileModelBound } from './given/compile_model_bound.js';

chai.should();

class Model {
    id = '';
    title = '';
    source = '';
    lastType = '';
}
for (const property of ['id', 'title', 'source', 'lastType']) field(String)(Model.prototype, property);

describe('when compiling legacy fromAll without explicit event subscriptions', () => {
    let result: ReturnType<typeof compileModelBound>;
    beforeEach(() => {
        class Candidate extends Model {}
        fromAll()(Candidate.prototype, 'title');
        fromAll(undefined, 'sequenceNumber')(Candidate.prototype, 'lastType');
        fromEvery(undefined, 'eventSourceId')(Candidate.prototype, 'source');
        result = compileModelBound(Candidate);
    });
    it('should keep the alias from expanding the event subscription', () => {
        (result.definition.SubscribesToAllEvents === undefined).should.be.true;
        result.definition.From.should.deep.equal([]);
        result.definition.FromEvery.should.deep.equal([]);
    });
    it('should merge content and context mappings with fromEvery into All', () => {
        result.definition.All!.Properties.should.deep.equal({ title: 'title', lastType: '$eventContext(SequenceNumber)', source: '$eventContext(EventSourceId)' });
        result.definition.All!.IncludeChildren.should.be.false;
    });
    it('should preserve the decorator in the mapping diagnostic', () => {
        result.compiled.provenance.get(result.definition)!.should.include.deep.members([
            { contractPath: 'All.Properties.title', declaration: '@fromAll' }
        ]);
    });
});

describe('when using legacy fromAll in a read-model scenario', () => {
    it('should reject the all-event mapping before events can be seeded', () => {
        class Candidate extends Model {}
        fromAll('title')(Candidate.prototype, 'title');
        (() => new ReadModelScenario(Candidate, { readModels: [Candidate], eventTypes: [], projections: [], reducers: [] }))
            .should.throw(UnsupportedProjectionOperation, 'All (@fromAll)');
    });
});

describe('when compiling legacy fromEvery without fromAll', () => {
    it('should preserve the existing sparse definition and child flag', () => {
        class Candidate extends Model {}
        fromEvery('name')(Candidate.prototype, 'title');
        const { definition } = compileModelBound(Candidate);
        (definition.SubscribesToAllEvents === undefined).should.be.true;
        definition.All!.should.deep.equal({ Properties: { title: 'name' }, IncludeChildren: false, AutoMap: 0 });
    });
});

describe('when inheriting legacy fromAll metadata', () => {
    it('should inherit the restricted mapping without changing a sibling', () => {
        class AllModel extends Model {}
        fromAll('name')(AllModel.prototype, 'title');
        class Derived extends AllModel {}
        const { definition } = compileModelBound(Derived);
        (definition.SubscribesToAllEvents === undefined).should.be.true;
        definition.All!.should.deep.equal({ Properties: { title: 'name' }, IncludeChildren: false, AutoMap: 0 });
        class EveryModel extends Model {}
        fromEvery('name')(EveryModel.prototype, 'title');
        (compileModelBound(EveryModel).definition.SubscribesToAllEvents === undefined).should.be.true;
    });
});

describe('when both all-event decorators target the same legacy property', () => {
    it('should preserve fromEvery mapping precedence', () => {
        class Candidate extends Model {}
        fromEvery('oldName')(Candidate.prototype, 'title');
        fromAll('newName')(Candidate.prototype, 'title');
        const { definition } = compileModelBound(Candidate);
        (definition.SubscribesToAllEvents === undefined).should.be.true;
        definition.All!.Properties.title.should.equal('oldName');
    });
});
