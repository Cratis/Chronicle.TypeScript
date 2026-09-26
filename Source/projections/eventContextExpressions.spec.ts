// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { Constructor, field } from '@cratis/fundamentals';
import { chai, describe, expect, it } from 'vitest';
import type { IClientArtifactsProvider } from '../artifacts/index.js';
import type { ChronicleConnection } from '../connection/index.js';
import { InvalidEventContextPropertyError } from '../index.js';
import { eventType } from '../events/eventTypeDecorator.js';
import { ProjectionBuilderFor } from './declarative/ProjectionBuilderFor.js';
import { projection } from './declarative/projection.js';
import { childrenFrom } from './modelBound/childrenFrom.js';
import { fromEvent } from './modelBound/fromEvent.js';
import { fromEvery } from './modelBound/fromEvery.js';
import { nested } from './modelBound/nested.js';
import { setFromContext } from './modelBound/setFromContext.js';
import { ProjectionDefinitionCompiler } from './ProjectionDefinitionCompiler.js';
import { Projections } from './Projections.js';

class Recorded { reference!: string; }
eventType()(Recorded);
class Removed {}
eventType()(Removed);
class Child { happened!: Date; }
setFromContext(Recorded, 'occurred')(Child.prototype, 'happened');
class Model { occurred!: Date; happened!: Date; viaAccessor!: Date; children!: Child[]; detail!: Child; }
setFromContext(Recorded)(Model.prototype, 'occurred');
setFromContext(Recorded, 'occurred')(Model.prototype, 'happened');
setFromContext(Recorded, context => context.occurred)(Model.prototype, 'viaAccessor');
childrenFrom(Recorded, Child)(Model.prototype, 'children');
field(Child)(Model.prototype, 'detail');
nested(Model.prototype, 'detail');
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
    Nested: Record<string, { From: FromRecord[] }>;
}

function declarative(configure: (builder: ProjectionBuilderFor<Model>) => void): Definition {
    const builder = new ProjectionBuilderFor<Model>();
    configure(builder);
    return builder.build('context-spec', 'Model') as unknown as Definition;
}

function modelBound(readModel: Constructor = Model): Definition {
    const artifacts: IClientArtifactsProvider = {
        projections: [], readModels: [readModel], globalForHandlers: [], eventTypes: [Recorded],
        reactors: [], reducers: [], seeders: [], constraints: [], webhooks: [], eventTypeMigrations: []
    };
    return new ProjectionDefinitionCompiler(artifacts, 'test-sink').compile([], [readModel]).definitions[0] as unknown as Definition;
}

function compileDeclarative(configure: (builder: ProjectionBuilderFor<Model>) => void): void {
    class InvalidDeclarativeProjection {
        define(builder: ProjectionBuilderFor<Model>): void { configure(builder); }
    }
    projection('invalid-context', Model)(InvalidDeclarativeProjection);
    const artifacts: IClientArtifactsProvider = {
        projections: [InvalidDeclarativeProjection], readModels: [Model], globalForHandlers: [], eventTypes: [Recorded],
        reactors: [], reducers: [], seeders: [], constraints: [], webhooks: [], eventTypeMigrations: []
    };
    new ProjectionDefinitionCompiler(artifacts, 'test-sink').compile([InvalidDeclarativeProjection], []);
}

function register(projections: Constructor[], readModels: Constructor[]): Promise<void> {
    const artifacts: IClientArtifactsProvider = {
        projections, readModels, globalForHandlers: [], eventTypes: [Recorded],
        reactors: [], reducers: [], seeders: [], constraints: [], webhooks: [], eventTypeMigrations: []
    };
    return new Projections('test-store', 'test-namespace', {} as ChronicleConnection, artifacts, 'test-sink').register();
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

    it('should map a nested model-bound context property to the kernel expression', () => {
        modelBound().Nested.detail.From[0].Value.Properties.happened.should.equal('$eventContext(Occurred)');
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
        declarative(builder => builder.from(Recorded, from => from.set(model => model.happened).toEventContextProperty('CausedBy.subject')))
            .From[0].Value.Properties.happened.should.equal('$eventContext(CausedBy.Subject)');
    });

    it('should allow a kernel-derived function on a known context property', () => {
        declarative(builder => builder.from(Recorded, from => from.set(model => model.happened).toEventContextProperty('occurred.week()')))
            .From[0].Value.Properties.happened.should.equal('$eventContext(Occurred.Week())');
    });

    it('should normalize a mixed-case kernel-derived function', () => {
        declarative(builder => builder.from(Recorded, from => from.set(model => model.happened).toEventContextProperty('occurred.WEEK()')))
            .From[0].Value.Properties.happened.should.equal('$eventContext(Occurred.Week())');
    });

    it('should reject a derived function the kernel does not recognize', () => {
        expect(() => compileDeclarative(builder => builder.fromEvery(all =>
            all.set(model => model.happened).toEventContextProperty('occurred.ISOWeek()'))))
            .toThrow(/Invalid event context property 'occurred.ISOWeek\(\)'.*'InvalidDeclarativeProjection'/);
    });

    it('should map an identity reached through onBehalfOf recursively', () => {
        declarative(builder => builder.from(Recorded, from => from.set(model => model.happened).toEventContextProperty('causedBy.onBehalfOf.onBehalfOf.userName')))
            .From[0].Value.Properties.happened.should.equal('$eventContext(CausedBy.OnBehalfOf.OnBehalfOf.UserName)');
    });

    it('should reject unknown identity members including those nested under onBehalfOf', () => {
        for (const path of ['causedBy.unknown', 'causedBy.onBehalfOf.unknown', 'causedBy.subject.name']) {
            expect(() => compileDeclarative(builder => builder.fromEvery(all =>
                all.set(model => model.happened).toEventContextProperty(path))))
                .toThrow(`Invalid event context property '${path}'`);
        }
    });

    it('should allow members of the kernel causation record', () => {
        declarative(builder => builder.from(Recorded, from => from.set(model => model.happened).toEventContextProperty('causation.type')))
            .From[0].Value.Properties.happened.should.equal('$eventContext(Causation.Type)');
    });

    it('should reject unknown causation members and deeper paths', () => {
        for (const path of ['causation.unknown', 'causation.properties.unknown']) {
            expect(() => compileDeclarative(builder => builder.fromEvery(all =>
                all.set(model => model.happened).toEventContextProperty(path))))
                .toThrow(`Invalid event context property '${path}'`);
        }
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

    it('should name the model-bound projection and read model identifier on registration failure', async () => {
        class InvalidModel { static readonly readModelId = 'invalid-model-id'; happened!: Date; }
        setFromContext(Recorded, 'invalidProperty')(InvalidModel.prototype, 'happened');
        fromEvent(Recorded)(InvalidModel);
        const attempt = register([], [InvalidModel]);
        await expect(attempt).rejects.toThrow("Invalid event context property 'invalidProperty' in projection 'InvalidModel' (read model 'invalid-model-id').");
        await expect(attempt).rejects.toMatchObject({ cause: expect.any(InvalidEventContextPropertyError) });
    });

    it('should reject an unknown nested identity member in a model-bound projection', () => {
        class InvalidIdentityModel { happened!: string; }
        setFromContext(Recorded, 'causedBy.missing')(InvalidIdentityModel.prototype, 'happened');
        fromEvent(Recorded)(InvalidIdentityModel);
        expect(() => modelBound(InvalidIdentityModel))
            .toThrow(/Invalid event context property 'causedBy.missing'.*'InvalidIdentityModel'/);
    });

    it('should reject an invalid implicit model-bound context property at registration', () => {
        class ImplicitInvalidModel { unknown!: string; }
        setFromContext(Recorded)(ImplicitInvalidModel.prototype, 'unknown');
        fromEvent(Recorded)(ImplicitInvalidModel);
        expect(() => modelBound(ImplicitInvalidModel)).toThrow(/Invalid event context property 'unknown'.*'ImplicitInvalidModel'/);
    });

    it('should name the declarative projection and read model identifier on registration failure', async () => {
        class InvalidDeclarativeModel { static readonly readModelId = 'declarative-model-id'; happened!: Date; }
        class InvalidDeclarativeProjection {
            define(builder: ProjectionBuilderFor<InvalidDeclarativeModel>): void {
                builder.from(Recorded, from => from.set(model => model.happened).toEventContextProperty('unknown'));
            }
        }
        projection('invalid-context', InvalidDeclarativeModel)(InvalidDeclarativeProjection);
        const attempt = register([InvalidDeclarativeProjection], [InvalidDeclarativeModel]);
        await expect(attempt).rejects.toThrow("Invalid event context property 'unknown' in projection 'InvalidDeclarativeProjection' (read model 'declarative-model-id').");
        await expect(attempt).rejects.toMatchObject({ cause: expect.any(InvalidEventContextPropertyError) });
    });

    it('should reject an invalid declarative all-set context property at registration', () => {
        expect(() => compileDeclarative(builder => builder.fromEvery(all =>
            all.set(model => model.happened).toEventContextProperty('unknown'))))
            .toThrow(/Invalid event context property 'unknown'.*'InvalidDeclarativeProjection'.*'Model'/);
    });

    it('should reject invalid context paths that the kernel cannot parse', () => {
        expect(() => compileDeclarative(builder => builder.fromEvery(all =>
            all.set(model => model.happened).toEventContextProperty('causedBy.subject[0]'))))
            .toThrow(/Invalid event context property 'causedBy.subject\[0\]'.*'InvalidDeclarativeProjection'/);
    });

    it('should reject invalid context properties in key and parent-key APIs at registration', () => {
        const mappings = [
            (builder: ProjectionBuilderFor<Model>) => builder.from(Recorded, from => from.usingKeyFromContext('missingKey')),
            (builder: ProjectionBuilderFor<Model>) => builder.from(Recorded, from => from.usingParentKeyFromContext('missingParent')),
            (builder: ProjectionBuilderFor<Model>) => builder.join(Recorded, join => join.on(model => model.occurred).usingKeyFromContext('missingJoinKey')),
            (builder: ProjectionBuilderFor<Model>) => builder.removedWith(Removed, removed => removed.usingKeyFromContext('missingRemovalKey'))
        ];
        for (const configure of mappings) {
            expect(() => compileDeclarative(configure)).toThrow(/Invalid event context property 'missing.*' in projection 'InvalidDeclarativeProjection'/);
        }
    });

    it('should use a context property on a declarative child and child parent key', () => {
        const child = declarative(builder => builder.children<Child>(model => model.children, children => children
            .from(Recorded, from => from.usingParentKeyFromContext('eventSourceId')
                .set(model => model.happened).toEventContextProperty('occurred'))));
        child.Children.children.From[0].Value.ParentKey.should.equal('$eventContext(EventSourceId)');
        child.Children.children.From[0].Value.Properties.happened.should.equal('$eventContext(Occurred)');
    });
});
