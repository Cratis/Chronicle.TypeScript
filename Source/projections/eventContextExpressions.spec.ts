// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { Constructor } from '@cratis/fundamentals';
import { chai, describe, it } from 'vitest';
import type { IClientArtifactsProvider } from '../artifacts/index.js';
import { eventType } from '../events/eventTypeDecorator.js';
import { ProjectionBuilderFor } from './declarative/ProjectionBuilderFor.js';
import { childrenFrom } from './modelBound/childrenFrom.js';
import { fromEvent } from './modelBound/fromEvent.js';
import { fromEvery } from './modelBound/fromEvery.js';
import { setFromContext } from './modelBound/setFromContext.js';
import { ProjectionDefinitionCompiler } from './ProjectionDefinitionCompiler.js';

class Recorded { reference!: string; }
eventType()(Recorded);
class Removed {}
eventType()(Removed);
class Child { happened!: Date; }
setFromContext(Recorded, 'occurred')(Child.prototype, 'happened');
class Model { occurred!: Date; happened!: Date; viaAccessor!: Date; children!: Child[]; }
setFromContext(Recorded)(Model.prototype, 'occurred');
setFromContext(Recorded, 'occurred')(Model.prototype, 'happened');
setFromContext(Recorded, context => context.occurred)(Model.prototype, 'viaAccessor');
childrenFrom(Recorded, Child)(Model.prototype, 'children');
fromEvery(undefined, 'sequenceNumber')(Model.prototype, 'happened');
fromEvent(Recorded)(Model);

interface FromRecord { Value: { Properties: Record<string, string>; Key: string; ParentKey: string } }
interface JoinRecord { Value: { Properties: Record<string, string>; Key: string } }
interface Definition {
    From: FromRecord[];
    Join: JoinRecord[];
    All: { Properties: Record<string, string> };
    RemovedWith: Array<{ Value: { Key: string } }>;
    Children: Record<string, { From: FromRecord[] }>;
}

function declarative(configure: (builder: ProjectionBuilderFor<Model>) => void): Definition {
    const builder = new ProjectionBuilderFor<Model>();
    configure(builder);
    return builder.build('context-spec', 'Model') as unknown as Definition;
}

function modelBound(): Definition {
    const artifacts: IClientArtifactsProvider = {
        projections: [], readModels: [Model as Constructor], globalForHandlers: [], eventTypes: [Recorded],
        reactors: [], reducers: [], seeders: [], constraints: [], webhooks: [], eventTypeMigrations: []
    };
    return new ProjectionDefinitionCompiler(artifacts, 'test-sink').compile([], [Model as Constructor]).definitions[0] as unknown as Definition;
}

chai.should();

describe('event context expressions', () => {
    it('should map a model-bound implicit context property to the kernel expression', () => {
        modelBound().From[0].Value.Properties.occurred.should.equal('$eventContext(Occurred)');
    });

    it('should map a model-bound explicit context property to the kernel expression', () => {
        modelBound().From[0].Value.Properties.happened.should.equal('$eventContext(Occurred)');
    });

    it('should map a model-bound context accessor to the kernel expression', () => {
        modelBound().From[0].Value.Properties.viaAccessor.should.equal('$eventContext(Occurred)');
    });

    it('should map a child model-bound context property to the kernel expression', () => {
        modelBound().Children.children.From[0].Value.Properties.happened.should.equal('$eventContext(Occurred)');
    });

    it('should map a model-bound fromEvery context property to the kernel expression', () => {
        modelBound().All.Properties.happened.should.equal('$eventContext(SequenceNumber)');
    });

    it('should set an event context property on a declarative from mapping', () => {
        declarative(builder => builder.from(Recorded, from => from.set(model => model.happened).toEventContextProperty('occurred')))
            .From[0].Value.Properties.happened.should.equal('$eventContext(Occurred)');
    });

    it('should set an event context property on a declarative join mapping', () => {
        declarative(builder => builder.join(Recorded, join => join.on(model => model.occurred).set(model => model.happened).toEventContextProperty('occurred')))
            .Join[0].Value.Properties.happened.should.equal('$eventContext(Occurred)');
    });

    it('should set an event context property on a declarative fromEvery mapping', () => {
        declarative(builder => builder.fromEvery(all => all.set(model => model.happened).toEventContextProperty('sequenceNumber')))
            .All.Properties.happened.should.equal('$eventContext(SequenceNumber)');
    });

    it('should preserve PascalCase and capitalize every nested context segment', () => {
        declarative(builder => builder.from(Recorded, from => from.set(model => model.happened).toEventContextProperty('CausedBy.name')))
            .From[0].Value.Properties.happened.should.equal('$eventContext(CausedBy.Name)');
    });

    it('should use a context property as a from key', () => {
        declarative(builder => builder.from(Recorded, from => from.usingKeyFromContext('eventSourceId')))
            .From[0].Value.Key.should.equal('$eventContext(EventSourceId)');
    });

    it('should use a context property as a from parent key', () => {
        declarative(builder => builder.from(Recorded, from => from.usingParentKeyFromContext('eventSourceId')))
            .From[0].Value.ParentKey.should.equal('$eventContext(EventSourceId)');
    });

    it('should use a context property as a join key', () => {
        declarative(builder => builder.join(Recorded, join => join.on(model => model.occurred).usingKeyFromContext('eventSourceId')))
            .Join[0].Value.Key.should.equal('$eventContext(EventSourceId)');
    });

    it('should leave a join parent key unset because JoinDefinition has no parent key', () => {
        declarative(builder => builder.join(Recorded, join => join.on(model => model.occurred).usingParentKeyFromContext('eventSourceId')))
            .Join[0].Value.Key.should.equal('$eventSourceId');
    });

    it('should use a context property as a removal key', () => {
        declarative(builder => builder.removedWith(Removed, removed => removed.usingKeyFromContext('eventSourceId')))
            .RemovedWith[0].Value.Key.should.equal('$eventContext(EventSourceId)');
    });

    it('should use a context property on a declarative child and child parent key', () => {
        const child = declarative(builder => builder.children<Child>(model => model.children, children => children
            .from(Recorded, from => from.usingParentKeyFromContext('eventSourceId')
                .set(model => model.happened).toEventContextProperty('occurred'))));
        child.Children.children.From[0].Value.ParentKey.should.equal('$eventContext(EventSourceId)');
        child.Children.children.From[0].Value.Properties.happened.should.equal('$eventContext(Occurred)');
    });
});
