// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { field } from '@cratis/fundamentals';
import { chai, describe, it } from 'vitest';
import { eventType } from '../../../events/eventTypeDecorator.js';
import type { IProjectionBuilderFor } from '../../../projections/declarative/IProjectionBuilderFor.js';
import { childrenFrom } from '../../../projections/modelBound/childrenFrom.js';
import { entersOn } from '../../../projections/modelBound/entersOn.js';
import { eventSequence } from '../../../projections/modelBound/eventSequence.js';
import { fromEvent } from '../../../projections/modelBound/fromEvent.js';
import { fromAll } from '../../../projections/modelBound/fromAll.js';
import { fromEvery } from '../../../projections/modelBound/fromEvery.js';
import { join } from '../../../projections/modelBound/join.js';
import { nested } from '../../../projections/modelBound/nested.js';
import { addFrom } from '../../../projections/modelBound/addFrom.js';
import { passive } from '../../../projections/modelBound/passive.js';
import { removedWithJoin } from '../../../projections/modelBound/removedWithJoin.js';
import { removedWith } from '../../../projections/modelBound/removedWith.js';
import { variantOf } from '../../../projections/modelBound/variantOf.js';
import { ProjectionCapabilities } from '../ProjectionCapabilities.js';
import { UnsupportedProjectionOperation } from '../UnsupportedProjectionOperation.js';
import { Changed } from './given/Changed.js';
import { Removed } from './given/Removed.js';
import { compileDeclarative, compileModelBound } from './given/compile.js';
import { Model } from './given/Model.js';

chai.should();

describe('when rejecting unsupported operations before any event is seeded', () => {
    const modelBound = [
        { name: 'children', configure: (model: Function) => childrenFrom(Removed)(model.prototype, 'name'), path: 'Children.name (@childrenFrom)', reason: 'children projections' },
        { name: 'nested', configure: (model: Function) => nested(model.prototype, 'name'), path: 'Nested.name (@nested)', reason: 'nested projections' },
        { name: 'join', configure: (model: Function) => join(Removed, 'name')(model.prototype, 'name'), path: 'Join[capability-removed:1] (@join)', reason: 'joins' },
        { name: 'removedWithJoin', configure: (model: Function) => removedWithJoin(Removed)(model), path: 'RemovedWithJoin[capability-removed:1] (@removedWithJoin)', reason: 'removedWithJoin' },
        { name: 'fromEvery', configure: (model: Function) => fromEvery('name')(model.prototype, 'name'), path: 'All (@fromEvery)', reason: 'fromEvery/all' },
        { name: 'fromAll', configure: (model: Function) => fromAll('name')(model.prototype, 'name'), path: 'All (@fromAll)', reason: 'fromEvery/all' },
        { name: 'passive', configure: (model: Function) => passive(model), path: 'IsActive (@passive)', reason: 'passive projections' },
        { name: 'event sequence', configure: (model: Function) => eventSequence('custom')(model), path: 'EventSequenceId (@eventSequence)', reason: 'non-default event sequences' },
        { name: 'custom key', configure: (model: Function) => fromEvent(Removed, { key: 'name' })(model), path: 'From[capability-removed:1].Key (@fromEvent)', reason: 'only $eventSourceId' },
        { name: 'constant key', configure: (model: Function) => fromEvent(Removed, { constantKey: 'fixed' })(model), path: 'From[capability-removed:1].Key (@fromEvent)', reason: 'only $eventSourceId' },
        { name: 'parent key', configure: (model: Function) => fromEvent(Removed, { parentKey: 'name' })(model), path: 'From[capability-removed:1].ParentKey (@fromEvent)', reason: 'parent keys' },
        { name: 'removal key', configure: (model: Function) => removedWith(Removed, 'name')(model), path: 'RemovedWith[capability-removed:1].Key (@removedWith)', reason: 'only $eventSourceId' },
        { name: 'removal parent key', configure: (model: Function) => removedWith(Removed, undefined, 'parent')(model), path: 'RemovedWith[capability-removed:1].ParentKey (@removedWith)', reason: 'parent keys' }
    ];
    for (const testCase of modelBound) {
        it(`should reject model-bound ${testCase.name} with declaration and path`, () => {
            const { compiled, definition } = compileModelBound(testCase.configure);
            (() => ProjectionCapabilities.validate(compiled, definition)).should.throw(UnsupportedProjectionOperation)
                .with.property('message').that.includes(testCase.path).and.includes(testCase.reason);
        });
    }

    it('should reject model-bound variants even before cross-wired removal is visible', () => {
        class Identity {}
        const { compiled, definition } = compileModelBound(model => {
            variantOf(Identity, 'id')(model);
            entersOn(Changed)(model);
        });
        (() => ProjectionCapabilities.validate(compiled, definition)).should.throw(UnsupportedProjectionOperation,
            'Candidate, Variant (@variantOf): variants require a kernel-backed test');
    });

    it('should reject declarative variants with their original declaration', () => {
        class Identity {}
        const { compiled, definition } = compileDeclarative(builder => builder.variantOf(Identity, model => model.id).entersOn(Changed).from(Changed));
        (() => ProjectionCapabilities.validate(compiled, definition)).should.throw(UnsupportedProjectionOperation,
            'Candidate, Variant (.variantOf): variants require a kernel-backed test');
    });

    const declarative: Array<{ name: string; define: (builder: IProjectionBuilderFor<Model>) => void; path: string }> = [
        { name: 'custom key', define: builder => { builder.from(Changed, from => from.usingKey(event => event.name)); }, path: 'From[capability-changed:1].Key (.from().usingKey)' },
        { name: 'constant key', define: builder => { builder.from(Changed, from => from.usingConstantKey('fixed')); }, path: 'From[capability-changed:1].Key (.from().usingConstantKey)' },
        { name: 'context key', define: builder => { builder.from(Changed, from => from.usingKeyFromContext('eventSourceId')); }, path: 'From[capability-changed:1].Key (.from().usingKeyFromContext)' },
        { name: 'context parent key', define: builder => { builder.from(Changed, from => from.usingParentKeyFromContext('eventSourceId')); }, path: 'From[capability-changed:1].ParentKey (.from().usingParentKeyFromContext)' },
        { name: 'composite key', define: builder => { builder.from(Changed, from => from.usingCompositeKey<{ name: string }>(key => key.set(target => target.name, event => event.name))); }, path: 'From[capability-changed:1].Key (.from().usingCompositeKey)' },
        { name: 'parent key', define: builder => { builder.from(Changed, from => from.usingParentKey(event => event.name)); }, path: 'From[capability-changed:1].ParentKey (.from().usingParentKey)' },
        { name: 'join', define: builder => { builder.from(Changed).join(Removed, join => join.on(model => model.id)); }, path: 'Join[capability-removed:1] (.join)' },
        { name: 'children', define: builder => { builder.from(Changed).children(model => model.labels, child => child.from(Removed)); }, path: 'Children.labels (.children)' },
        { name: 'nested', define: builder => { builder.from(Changed).nested(model => model.details, child => child.clearWith(Removed)); }, path: 'Nested.details (.nested)' },
        { name: 'removedWithJoin', define: builder => { builder.from(Changed).removedWithJoin(Removed); }, path: 'RemovedWithJoin[capability-removed:1] (.removedWithJoin)' },
        { name: 'removal key', define: builder => { builder.from(Changed).removedWith(Changed, removal => removal.usingKey(event => event.name)); }, path: 'RemovedWith[capability-changed:1].Key (.removedWith)' },
        { name: 'fromEvery', define: builder => { builder.from(Changed).fromEvery(all => all.set(model => model.name).toEventSourceId()); }, path: 'All (.fromEvery)' },
        { name: 'empty fromEvery', define: builder => { builder.from(Changed).fromEvery(all => all.excludeChildProjections()); }, path: 'All (.fromEvery)' },
        { name: 'passive', define: builder => { builder.from(Changed).passive(); }, path: 'IsActive (.passive)' },
        { name: 'event sequence', define: builder => { builder.from(Changed).fromEventSequence('custom'); }, path: 'EventSequenceId (.fromEventSequence)' }
    ];
    for (const testCase of declarative) {
        it(`should reject declarative ${testCase.name} with declaration and path`, () => {
            const { compiled, definition } = compileDeclarative(testCase.define);
            (() => ProjectionCapabilities.validate(compiled, definition)).should.throw(UnsupportedProjectionOperation)
                .with.property('message').that.includes(testCase.path);
        });
    }

    it('should reject the same event-type id with multiple declared generations', () => {
        class NewGeneration { name!: string; }
        field(String)(NewGeneration.prototype, 'name');
        eventType('capability-changed', 2)(NewGeneration);
        const { compiled, definition } = compileModelBound(model => fromEvent(NewGeneration)(model), [NewGeneration]);
        (() => ProjectionCapabilities.validate(compiled, definition)).should.throw(UnsupportedProjectionOperation,
            'multiple generations of the same event-type id');
    });

    it('should reject a literal legacy $context. wire expression as unknown with its declaration', () => {
        const { compiled, definition } = compileDeclarative(builder => builder.from(Changed, from => from.set(model => model.state).toEventContextProperty('eventType')));
        definition.From[0].Value.Properties.state = '$context.eventType';
        (() => ProjectionCapabilities.validate(compiled, definition)).should.throw(UnsupportedProjectionOperation)
            .with.property('message').that.includes('(.from().setFromContext)')
                .and.includes("expression '$context.eventType'").and.includes('$eventContext(...)');
    });

    for (const property of ['causedBy', 'causedBy.onBehalfOf', 'causation', 'tags', 'observationState', 'eventType']) {
        it(`should reject unproven ${property} context mappings with provenance`, () => {
            const { compiled, definition } = compileDeclarative(builder => builder.from(Changed, from =>
                from.set(model => model.state).toEventContextProperty(property)));
            (() => ProjectionCapabilities.validate(compiled, definition)).should.throw(UnsupportedProjectionOperation)
                .with.property('message').that.includes('From[capability-changed:1].Properties.state (.from().setFromContext)')
                .and.includes('kernel-backed test');
        });
    }

    it('should reject raw Occurred until the kernel conversion is consistent', () => {
        const { compiled, definition } = compileDeclarative(builder => builder.from(Changed, from =>
            from.set(model => model.state).toEventContextProperty('occurred')));
        (() => ProjectionCapabilities.validate(compiled, definition)).should.throw(UnsupportedProjectionOperation)
            .with.property('message').that.includes('(.from().setFromContext)')
                .and.includes('raw Occurred is converted inconsistently by the kernel');
    });

    it('should reject a client-emitted derived context function at the phase-one boundary', () => {
        const { compiled, definition } = compileDeclarative(builder => builder.from(Changed, from =>
            from.set(model => model.state).toEventContextProperty('occurred.week()')));
        definition.From[0].Value.Properties.state.should.equal('$eventContext(Occurred.Week())');
        (() => ProjectionCapabilities.validate(compiled, definition)).should.throw(UnsupportedProjectionOperation)
            .with.property('message').that.includes('(.from().setFromContext)')
                .and.includes("expression '$eventContext(Occurred.Week())': derived event-context functions require a kernel-backed test");
    });

    for (const expression of [
        '$eventContext(Occurred.Date)', '$eventContext(EventSourceId.Part)', '$eventContext(CausedBy.Unknown)',
        '$eventContext(CausedBy.OnBehalfOf.UserName)', '$eventContext(Causation.Type)', '$eventContext(Tags.Name)',
        '$eventContext(Occurred.ISOWeek())', '$eventContext(Occurred1)', '$eventContext(_Occurred)',
        '$eventContext(occurred)'
    ]) {
        it(`should reject unsupported event-context expression ${expression}`, () => {
            const { compiled, definition } = compileDeclarative(builder => builder.from(Changed, from => from.set(model => model.state).to(event => event.name)));
            definition.From[0].Value.Properties.state = expression;
            (() => ProjectionCapabilities.validate(compiled, definition)).should.throw(UnsupportedProjectionOperation)
                .with.property('message').that.includes(`expression '${expression}'`);
        });
    }

    it('should reject multiple generations on a declarative projection', () => {
        class NewGeneration { name!: string; }
        field(String)(NewGeneration.prototype, 'name');
        eventType('capability-changed', 2)(NewGeneration);
        const { compiled, definition } = compileDeclarative(builder => builder.from(Changed).from(NewGeneration), [NewGeneration]);
        (() => ProjectionCapabilities.validate(compiled, definition)).should.throw(UnsupportedProjectionOperation,
            'multiple generations of the same event-type id');
    });

    for (const format of ['float', 'decimal', 'duration', 'int64']) {
        it(`should reject ${format} arithmetic rather than approximate the kernel`, () => {
            const { compiled, definition } = compileDeclarative(builder => builder.from(Changed, from => from.add(model => model.total).with(event => event.quantity)));
            const schema = JSON.parse(compiled.readModels[0].Schema) as { properties: { total: { type: string; format?: string } } };
            schema.properties.total.format = format;
            compiled.readModels[0].Schema = JSON.stringify(schema);
            (() => ProjectionCapabilities.validate(compiled, definition)).should.throw(UnsupportedProjectionOperation)
                .with.property('message').that.includes('From[capability-changed:1].Properties.total');
        });
    }

    for (const format of ['float', 'decimal', 'duration', 'int64']) {
        it(`should reject model-bound ${format} arithmetic`, () => {
            const { compiled, definition } = compileModelBound(model => addFrom(Changed, 'quantity')(model.prototype, 'total'));
            const schema = JSON.parse(compiled.readModels[0].Schema) as { properties: { total: { format?: string } } };
            schema.properties.total.format = format;
            compiled.readModels[0].Schema = JSON.stringify(schema);
            (() => ProjectionCapabilities.validate(compiled, definition)).should.throw(UnsupportedProjectionOperation)
                .with.property('message').that.includes('(@addFrom)').and.includes("expression '$add(quantity)'");
        });
    }

    it('should reject an inferred AutoMap target with an unsupported format', () => {
        const { compiled, definition } = compileModelBound();
        const schema = JSON.parse(compiled.readModels[0].Schema) as { properties: { quantity: { format?: string } } };
        schema.properties.quantity.format = 'float';
        compiled.readModels[0].Schema = JSON.stringify(schema);
        (() => ProjectionCapabilities.validate(compiled, definition)).should.throw(UnsupportedProjectionOperation)
            .with.property('message').that.includes('From[capability-changed:1].AutoMap.quantity');
    });

    it('should reject declarative inferred AutoMap with its real source declaration', () => {
        const { compiled, definition } = compileDeclarative(builder => builder.from(Changed));
        const schema = JSON.parse(compiled.readModels[0].Schema) as { properties: { quantity: { format?: string } } };
        schema.properties.quantity.format = 'float';
        compiled.readModels[0].Schema = JSON.stringify(schema);
        (() => ProjectionCapabilities.validate(compiled, definition)).should.throw(UnsupportedProjectionOperation)
            .with.property('message').that.includes('From[capability-changed:1].AutoMap.quantity (.from (AutoMap))');
    });

    it('should validate AutoMap against every participating event, including the second source', () => {
        class Second { state!: string; }
        field(String)(Second.prototype, 'state');
        eventType('second-source')(Second);
        const { compiled, definition } = compileDeclarative(builder => builder.from(Changed).from(Second), [Second]);
        const schema = JSON.parse(compiled.readModels[0].Schema) as { properties: { state: { format?: string } } };
        schema.properties.state.format = 'float';
        compiled.readModels[0].Schema = JSON.stringify(schema);
        (() => ProjectionCapabilities.validate(compiled, definition)).should.throw(UnsupportedProjectionOperation)
            .with.property('message').that.includes('From[second-source:1].AutoMap.state (.from (AutoMap))');
    });

    it('should reject ambiguous AutoMap sources that differ only by case', () => {
        class Ambiguous { name!: string; Name!: string; }
        field(String)(Ambiguous.prototype, 'name');
        field(String)(Ambiguous.prototype, 'Name');
        eventType('ambiguous-source')(Ambiguous);
        const { compiled, definition } = compileDeclarative(builder => builder.from(Ambiguous), [Ambiguous]);
        (() => ProjectionCapabilities.validate(compiled, definition)).should.throw(UnsupportedProjectionOperation)
            .with.property('message').that.includes('From[ambiguous-source:1].AutoMap.name (.from (AutoMap))').and.includes('name, Name');
    });

    it('should reject identifiers with unsupported schemas', () => {
        const { compiled, definition } = compileModelBound();
        const schema = JSON.parse(compiled.readModels[0].Schema) as { properties: { id: { type: string } } };
        schema.properties.id.type = 'boolean';
        compiled.readModels[0].Schema = JSON.stringify(schema);
        (() => ProjectionCapabilities.validate(compiled, definition)).should.throw(UnsupportedProjectionOperation)
            .with.property('message').that.includes('ReadModel.Schema.id (@fromEvent)');
    });

    it('should reject dynamically addressed destinations and unsupported expressions', () => {
        const { compiled, definition } = compileDeclarative(builder => builder.from(Changed, from => from.setThisValue().to(event => event.name)));
        (() => ProjectionCapabilities.validate(compiled, definition)).should.throw(UnsupportedProjectionOperation)
            .with.property('message').that.includes('From[capability-changed:1].Properties.$this');
    });

    it('should reject participating event types missing from discovered registration artifacts', () => {
        class Undiscovered {}
        eventType()(Undiscovered);
        const { compiled, definition } = compileDeclarative(builder => builder.from(Undiscovered));
        (() => ProjectionCapabilities.validate(compiled, definition)).should.throw(UnsupportedProjectionOperation)
            .with.property('message').that.includes('From[').and.includes('(.from)').and.includes('participating event schema is unavailable');
    });
});
