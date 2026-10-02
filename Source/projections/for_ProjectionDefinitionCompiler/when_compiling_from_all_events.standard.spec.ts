// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { field } from '@cratis/fundamentals';
import { chai, describe, it, type Assertion } from 'vitest';
import { fromAllEvents, getFromAllEventsMetadata, fromAll, getFromAllMetadata, fromEvery, getFromEveryMetadata } from '../index.js';
import { TypeIntrospector } from '../../types/index.js';
import { ReadModelScenario } from '../../testing/ReadModelScenario.js';
import { UnsupportedProjectionOperation } from '../../testing/projections/UnsupportedProjectionOperation.js';
import { compileModelBound } from './given/compile_model_bound.js';

chai.should();
function should(value: unknown): Assertion { return (value as { should: Assertion }).should; }

class AllModel {
    @field(String) id = '';
    @field(String) @fromAllEvents('name') title = '';
    @field(String) @fromAllEvents(undefined, 'sequenceNumber') sequence = '';
    @field(String) @fromEvery(undefined, 'eventSourceId') source = '';
    constructor() { throw new Error('Model discovery must not construct the model'); }
}

describe('when compiling standard fromAllEvents without explicit event subscriptions', () => {
    it('should emit the subscription and shared mappings without constructing the model', () => {
        const { definition } = compileModelBound(AllModel);
        should(definition.SubscribesToAllEvents).be.true;
        should(definition.From).deep.equal([]);
        should(definition.FromEvery).deep.equal([]);
        should(definition.All).deep.equal({ Properties: {
            title: 'name', sequence: '$eventContext(SequenceNumber)', source: '$eventContext(EventSourceId)'
        }, IncludeChildren: true, AutoMap: 0 });
    });

    it('should discover a model using only fromAllEvents through existing Arc style readers', () => {
        class OnlyAll {
            @field(String) @fromAllEvents() title = '';
            constructor() { throw new Error('Discovery must not construct the model'); }
        }
        class Derived extends OnlyAll {}
        for (const type of [OnlyAll, Derived]) {
            should(TypeIntrospector.getTrackedProperties(type).some(property =>
                !!getFromEveryMetadata(type.prototype, property) || !!getFromAllMetadata(type.prototype, property))).be.true;
            should(getFromAllMetadata(type.prototype, 'title')).deep.equal({ property: undefined, contextProperty: undefined });
            should(getFromEveryMetadata(type.prototype, 'title') === undefined).be.true;
            should(compileModelBound(type).definition.SubscribesToAllEvents).be.true;
        }
    });

    it('should inherit and override mappings without leaking the subscription to a sibling', () => {
        class Base { @field(String) id = ''; }
        class All extends Base { @field(String) @fromAllEvents('name') title = ''; }
        class Derived extends All {}
        class Override extends All { @field(String) @fromAllEvents('derivedName') override title = ''; }
        class Alias extends Base { @field(String) @fromAll('name') title = ''; }
        should(compileModelBound(Derived).definition.SubscribesToAllEvents).be.true;
        should(compileModelBound(Derived).definition.All).deep.equal(compileModelBound(All).definition.All);
        should(compileModelBound(Override).definition.All!.Properties.title).equal('derivedName');
        should(compileModelBound(All).definition.All!.Properties.title).equal('name');
        should(compileModelBound(Alias).definition.SubscribesToAllEvents === undefined).be.true;
        should(getFromAllEventsMetadata(Alias.prototype, 'title') === undefined).be.true;
    });

    it('should reject all-event scenarios before replay with the standard decorator declaration', () => {
        should(() => new ReadModelScenario(AllModel, { readModels: [AllModel], eventTypes: [], projections: [], reducers: [] }))
            .throw(UnsupportedProjectionOperation, 'SubscribesToAllEvents (@fromAllEvents)');
    });

    it('should prefer fromAllEvents in either decorator order without changing the alias metadata', () => {
        class Both {
            @field(String) id = '';
            @field(String) @fromEvery('everyName') @fromAll('aliasName') @fromAllEvents('newName') title = '';
            @field(String) @fromAllEvents('otherName') @fromAll('aliasName') @fromEvery('everyName') other = '';
        }
        const { compiled, definition } = compileModelBound(Both);
        should(definition.SubscribesToAllEvents).be.true;
        should(definition.All!.Properties).deep.equal({ title: 'newName', other: 'otherName' });
        should(getFromAllMetadata(Both.prototype, 'title')!.property).equal('aliasName');
        should(getFromEveryMetadata(Both.prototype, 'title')!.property).equal('everyName');
        should(compiled.provenance.get(definition)).include.deep.members([
            { contractPath: 'SubscribesToAllEvents', declaration: '@fromAllEvents' },
            { contractPath: 'All.Properties.title', declaration: '@fromAllEvents' }
        ]);
    });
});
