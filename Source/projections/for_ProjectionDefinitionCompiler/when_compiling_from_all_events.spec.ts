// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { field } from '@cratis/fundamentals';
import { beforeEach, chai, describe, it } from 'vitest';
import { fromAllEvents, getFromAllEventsMetadata } from '../../index.js';
import { eventType } from '../../events/eventTypeDecorator.js';
import { childrenFrom } from '../modelBound/childrenFrom.js';
import { fromAll, getFromAllMetadata } from '../modelBound/fromAll.js';
import { fromEvery, getFromEveryMetadata } from '../modelBound/fromEvery.js';
import { fromEvent } from '../modelBound/fromEvent.js';
import { isModelBoundProjection } from '../modelBound/isModelBoundProjection.js';
import { nested } from '../modelBound/nested.js';
import { TypeIntrospector } from '../../types/index.js';
import { ReadModelScenario } from '../../testing/ReadModelScenario.js';
import { UnsupportedProjectionOperation } from '../../testing/projections/UnsupportedProjectionOperation.js';
import { compileModelBound } from './given/compile_model_bound.js';

chai.should();

class Model {
    id = '';
    title = '';
    source = '';
    sequence = '';
}
for (const property of ['id', 'title', 'source', 'sequence']) field(String)(Model.prototype, property);

function discoveredByExistingReaders(type: Function): boolean {
    return TypeIntrospector.getTrackedProperties(type).some(property =>
        !!getFromEveryMetadata(type.prototype, property) || !!getFromAllMetadata(type.prototype, property));
}

describe('when compiling legacy fromAllEvents without explicit event subscriptions', () => {
    let result: ReturnType<typeof compileModelBound>;
    beforeEach(() => {
        class Candidate extends Model {}
        fromAllEvents()(Candidate.prototype, 'title');
        fromAllEvents(undefined, 'sequenceNumber')(Candidate.prototype, 'sequence');
        fromEvery(undefined, 'eventSourceId')(Candidate.prototype, 'source');
        result = compileModelBound(Candidate);
    });
    it('should subscribe to every event without expanding a known event list', () => {
        result.definition.SubscribesToAllEvents.should.be.true;
        result.definition.From.should.deep.equal([]);
        result.definition.FromEvery.should.deep.equal([]);
    });
    it('should merge content and context mappings into All including children', () => {
        result.definition.All!.should.deep.equal({ Properties: {
            title: 'title', sequence: '$eventContext(SequenceNumber)', source: '$eventContext(EventSourceId)'
        }, IncludeChildren: true, AutoMap: 0 });
    });
    it('should preserve the distinct decorator in subscription and mapping diagnostics', () => {
        result.compiled.provenance.get(result.definition)!.should.include.deep.members([
            { contractPath: 'SubscribesToAllEvents', declaration: '@fromAllEvents' },
            { contractPath: 'All', declaration: '@fromAllEvents' },
            { contractPath: 'All.Properties.title', declaration: '@fromAllEvents' },
            { contractPath: 'All.Properties.source', declaration: '@fromEvery' }
        ]);
    });
});

describe('when using legacy fromAllEvents in a read-model scenario', () => {
    it('should reject the subscription before events can be seeded', () => {
        class Candidate extends Model {}
        fromAllEvents('title')(Candidate.prototype, 'title');
        (() => new ReadModelScenario(Candidate, { readModels: [Candidate], eventTypes: [], projections: [], reducers: [] }))
            .should.throw(UnsupportedProjectionOperation, 'SubscribesToAllEvents (@fromAllEvents)');
    });
});

describe('when discovering and inheriting legacy fromAllEvents metadata', () => {
    class AllModel extends Model {}
    fromAllEvents('name')(AllModel.prototype, 'title');
    class Derived extends AllModel {}
    class Sibling extends Model {}
    fromAll('restrictedName')(Sibling.prototype, 'title');

    it('should discover a model using only fromAllEvents with Arc style existing readers', () => {
        discoveredByExistingReaders(AllModel).should.be.true;
        isModelBoundProjection(AllModel).should.be.true;
        getFromAllMetadata(AllModel.prototype, 'title')!.should.deep.equal({ property: 'name', contextProperty: undefined });
        (getFromEveryMetadata(AllModel.prototype, 'title') === undefined).should.be.true;
    });
    it('should inherit discovery and the subscription without affecting a sibling', () => {
        discoveredByExistingReaders(Derived).should.be.true;
        compileModelBound(Derived).definition.SubscribesToAllEvents.should.be.true;
        compileModelBound(Derived).definition.All!.should.deep.equal(compileModelBound(AllModel).definition.All);
        (compileModelBound(Sibling).definition.SubscribesToAllEvents === undefined).should.be.true;
        (getFromAllEventsMetadata(Sibling.prototype, 'title') === undefined).should.be.true;
    });
    it('should keep derived annotations independent from the base', () => {
        class Override extends AllModel {}
        fromAllEvents('derivedName')(Override.prototype, 'title');
        compileModelBound(Override).definition.All!.Properties.title.should.equal('derivedName');
        compileModelBound(AllModel).definition.All!.Properties.title.should.equal('name');
    });
});

describe('when compiling fromAllEvents on a child model', () => {
    class Child { id = ''; title = ''; }
    field(String)(Child.prototype, 'id');
    field(String)(Child.prototype, 'title');
    fromAllEvents('name')(Child.prototype, 'title');
    class Added { id = ''; name = ''; }
    eventType('from-all-events-child-added')(Added);
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
    it('should collect the child mapping by bare name in the root All without subscribing to all events', () => {
        const { compiled, definition } = compileModelBound(Parent);
        definition.All!.should.deep.equal({ Properties: { title: 'name' }, IncludeChildren: true, AutoMap: 0 });
        definition.Children.items.All!.Properties.should.deep.equal({});
        compiled.provenance.get(definition)!.should.include.deep.members([
            { contractPath: 'All', declaration: '@fromAllEvents' },
            { contractPath: 'All.Properties.title', declaration: '@fromAllEvents' }
        ]);
    });
    it('should emit the subscription only at the root when the parent opts in', () => {
        class AllParent extends Parent {}
        fromAllEvents(undefined, 'eventSourceId')(AllParent.prototype, 'source');
        const { definition } = compileModelBound(AllParent);
        definition.SubscribesToAllEvents.should.be.true;
        definition.All!.should.deep.equal({
            Properties: { source: '$eventContext(EventSourceId)', title: 'name' }, IncludeChildren: true, AutoMap: 0
        });
        ('SubscribesToAllEvents' in definition.Children.items).should.be.false;
    });
    it('should share one bare-name mapping when a later child member shadows a root member', () => {
        class AllParent extends Model { items: Child[] = []; }
        fromAllEvents('rootName')(AllParent.prototype, 'title');
        field(Array, { genericArguments: [Child] })(AllParent.prototype, 'items');
        childrenFrom(Added, 'id')(AllParent.prototype, 'items');
        compileModelBound(AllParent).definition.All!.Properties.should.deep.equal({ title: 'name' });
    });
});

describe('when compiling fromAllEvents on nested and inherited child models', () => {
    class Detail { label = ''; sequence = ''; }
    field(String)(Detail.prototype, 'label');
    field(String)(Detail.prototype, 'sequence');
    fromAllEvents()(Detail.prototype, 'label');
    fromAllEvents(undefined, 'sequenceNumber')(Detail.prototype, 'sequence');
    class Added { id = ''; }
    eventType('from-all-events-nested-child-added')(Added);
    field(String)(Added.prototype, 'id');
    class Child { id = ''; title = ''; ignored = ''; detail = new Detail(); }
    field(String)(Child.prototype, 'id');
    field(String)(Child.prototype, 'title');
    field(String)(Child.prototype, 'ignored');
    field(Detail)(Child.prototype, 'detail');
    fromAllEvents('name')(Child.prototype, 'title');
    fromEvery('ignoredEvery')(Child.prototype, 'ignored');
    fromAll('ignoredAlias')(Child.prototype, 'ignored');
    nested(Child.prototype, 'detail');
    class InheritedChild extends Child {}
    class Group { children: InheritedChild[] = []; }
    field(Array, { genericArguments: [InheritedChild] })(Group.prototype, 'children');
    childrenFrom(Added, 'id')(Group.prototype, 'children');
    class Parent { groups: Group[] = []; detail = new Detail(); }
    field(Array, { genericArguments: [Group] })(Parent.prototype, 'groups');
    childrenFrom(Added, 'id')(Parent.prototype, 'groups');
    field(Detail)(Parent.prototype, 'detail');
    nested(Parent.prototype, 'detail');

    it('should collect grandchild and nested mappings into the root without path prefixes or legacy child mappings', () => {
        const { definition } = compileModelBound(Parent);
        definition.All!.should.deep.equal({
            Properties: { title: 'name', label: 'label', sequence: '$eventContext(SequenceNumber)' },
            IncludeChildren: true, AutoMap: 0
        });
        (definition.SubscribesToAllEvents === undefined).should.be.true;
        definition.Children.groups.Children.children.All!.Properties.should.deep.equal({});
        definition.Children.groups.Children.children.Nested.detail.All!.Properties.should.deep.equal({});
        definition.Nested.detail.All!.Properties.should.deep.equal({});
    });
    it('should collect a nested-only mapping without widening the root subscription', () => {
        class NestedOnly { detail = new Detail(); }
        fromEvent(Added)(NestedOnly);
        field(Detail)(NestedOnly.prototype, 'detail');
        nested(NestedOnly.prototype, 'detail');
        const { definition } = compileModelBound(NestedOnly);
        definition.All!.should.deep.equal({
            Properties: { label: 'label', sequence: '$eventContext(SequenceNumber)' }, IncludeChildren: true, AutoMap: 0
        });
        (definition.SubscribesToAllEvents === undefined).should.be.true;
        ('SubscribesToAllEvents' in definition.Nested.detail).should.be.false;
    });
});

describe('when opting into fromAllEvents alongside inherited restricted mappings', () => {
    it('should promote inherited fromEvery and fromAll mappings into the same shared All block', () => {
        class Restricted extends Model {}
        fromEvery(undefined, 'eventSourceId')(Restricted.prototype, 'source');
        fromAll(undefined, 'sequenceNumber')(Restricted.prototype, 'sequence');
        class AllModel extends Restricted {}
        fromAllEvents('name')(AllModel.prototype, 'title');
        const { definition } = compileModelBound(AllModel);
        definition.SubscribesToAllEvents.should.be.true;
        definition.All!.should.deep.equal({
            Properties: { title: 'name', source: '$eventContext(EventSourceId)', sequence: '$eventContext(SequenceNumber)' },
            IncludeChildren: true, AutoMap: 0
        });
        compileModelBound(Restricted).definition.All!.IncludeChildren.should.be.false;
    });
});

for (const allEventsFirst of [true, false]) {
    describe(`when all shared mapping decorators target one legacy property with fromAllEvents ${allEventsFirst ? 'first' : 'last'}`, () => {
        it('should prefer the explicit subscription without overwriting compatibility metadata', () => {
            class Candidate extends Model {}
            if (allEventsFirst) fromAllEvents('newName')(Candidate.prototype, 'title');
            fromEvery('everyName')(Candidate.prototype, 'title');
            fromAll('aliasName')(Candidate.prototype, 'title');
            if (!allEventsFirst) fromAllEvents('newName')(Candidate.prototype, 'title');
            const { compiled, definition } = compileModelBound(Candidate);
            definition.SubscribesToAllEvents.should.be.true;
            definition.All!.Properties.title.should.equal('newName');
            getFromAllMetadata(Candidate.prototype, 'title')!.property!.should.equal('aliasName');
            getFromEveryMetadata(Candidate.prototype, 'title')!.property!.should.equal('everyName');
            compiled.provenance.get(definition)!.should.include.deep.members([
                { contractPath: 'All.Properties.title', declaration: '@fromAllEvents' }
            ]);
        });
    });
}
