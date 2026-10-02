// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { field } from '@cratis/fundamentals';
import { beforeEach, chai, describe, it } from 'vitest';
import { eventType } from '../../events/eventTypeDecorator.js';
import { childrenFrom } from '../modelBound/childrenFrom.js';
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
    it('should subscribe to every event without expanding a known event list', () => {
        result.definition.SubscribesToAllEvents.should.be.true;
        result.definition.From.should.deep.equal([]);
        result.definition.FromEvery.should.deep.equal([]);
    });
    it('should merge content and context mappings with fromEvery into All', () => {
        result.definition.All!.Properties.should.deep.equal({ title: 'title', lastType: '$eventContext(SequenceNumber)', source: '$eventContext(EventSourceId)' });
        result.definition.All!.IncludeChildren.should.be.true;
    });
    it('should preserve the decorator in the subscription diagnostic', () => {
        result.compiled.provenance.get(result.definition)!.should.include.deep.members([
            { contractPath: 'SubscribesToAllEvents', declaration: '@fromAll' }
        ]);
    });
});

describe('when using legacy fromAll in a read-model scenario', () => {
    it('should reject the subscription before events can be seeded', () => {
        class Candidate extends Model {}
        fromAll('title')(Candidate.prototype, 'title');
        (() => new ReadModelScenario(Candidate, { readModels: [Candidate], eventTypes: [], projections: [], reducers: [] }))
            .should.throw(UnsupportedProjectionOperation, 'SubscribesToAllEvents (@fromAll)');
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
    it('should subscribe the derived model without changing an undecorated sibling', () => {
        class AllModel extends Model {}
        fromAll('name')(AllModel.prototype, 'title');
        class Derived extends AllModel {}
        compileModelBound(Derived).definition.SubscribesToAllEvents.should.be.true;
        class EveryModel extends Model {}
        fromEvery('name')(EveryModel.prototype, 'title');
        (compileModelBound(EveryModel).definition.SubscribesToAllEvents === undefined).should.be.true;
    });
});

describe('when compiling fromAll on a child model', () => {
    class Child { id = ''; title = ''; }
    field(String)(Child.prototype, 'id');
    field(String)(Child.prototype, 'title');
    fromAll('name')(Child.prototype, 'title');
    class Added { id = ''; name = ''; }
    eventType('from-all-child-added')(Added);
    field(String)(Added.prototype, 'id');
    field(String)(Added.prototype, 'name');
    class Parent extends Model { items: Child[] = []; }
    field(Array, { enumerable: true, genericArguments: [Child] })(Parent.prototype, 'items');
    childrenFrom(Added, 'id')(Parent.prototype, 'items');

    it('should not widen the root subscription from child metadata', () => {
        const { definition } = compileModelBound(Parent);
        (definition.SubscribesToAllEvents === undefined).should.be.true;
        ('SubscribesToAllEvents' in definition.Children.items).should.be.false;
    });

    it('should emit the subscription only at the root when the parent also uses fromAll', () => {
        class AllParent extends Parent {}
        fromAll('name')(AllParent.prototype, 'title');
        const { definition } = compileModelBound(AllParent);
        definition.SubscribesToAllEvents.should.be.true;
        definition.All!.IncludeChildren.should.be.true;
        ('SubscribesToAllEvents' in definition.Children.items).should.be.false;
    });
});

describe('when both all-event decorators target the same legacy property', () => {
    it('should use fromAll mapping precedence like the model-bound dotnet builder', () => {
        class Candidate extends Model {}
        fromEvery('oldName')(Candidate.prototype, 'title');
        fromAll('newName')(Candidate.prototype, 'title');
        const { definition } = compileModelBound(Candidate);
        definition.SubscribesToAllEvents.should.be.true;
        definition.All!.Properties.title.should.equal('newName');
    });
});
