// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { field } from '@cratis/fundamentals';
import { chai, describe, it, type Assertion } from 'vitest';
import { fromAll } from '../modelBound/fromAll.js';
import { fromEvery } from '../modelBound/fromEvery.js';
import { ReadModelScenario } from '../../testing/ReadModelScenario.js';
import { UnsupportedProjectionOperation } from '../../testing/projections/UnsupportedProjectionOperation.js';
import { compileModelBound } from './given/compile_model_bound.js';

chai.should();
function should(value: unknown): Assertion { return (value as { should: Assertion }).should; }

class AllModel {
    @field(String) id = '';
    @field(String) @fromAll('name') title = '';
    @field(String) @fromAll(undefined, 'sequenceNumber') lastType = '';
    @field(String) @fromEvery(undefined, 'eventSourceId') source = '';
}
class EveryModel {
    @field(String) id = '';
    @field(String) @fromEvery('name') title = '';
}

describe('when compiling standard fromAll without explicit event subscriptions', () => {
    it('should emit restricted shared mappings without constructing the model', () => {
        const { definition } = compileModelBound(AllModel);
        should(definition.SubscribesToAllEvents === undefined).be.true;
        should(definition.From).deep.equal([]);
        should(definition.FromEvery).deep.equal([]);
        should(definition.All).deep.equal({ Properties: {
            title: 'name', lastType: '$eventContext(SequenceNumber)', source: '$eventContext(EventSourceId)'
        }, IncludeChildren: false, AutoMap: 0 });
    });

    it('should leave fromEvery subscriptions and child behavior unchanged', () => {
        const { definition } = compileModelBound(EveryModel);
        should(definition.SubscribesToAllEvents === undefined).be.true;
        should(definition.All).deep.equal({ Properties: { title: 'name' }, IncludeChildren: false, AutoMap: 0 });
    });

    it('should inherit the restricted mappings without expanding subscriptions', () => {
        class Derived extends AllModel {}
        const { definition } = compileModelBound(Derived);
        should(definition.SubscribesToAllEvents === undefined).be.true;
        should(definition.All).deep.equal(compileModelBound(AllModel).definition.All);
        should(compileModelBound(EveryModel).definition.SubscribesToAllEvents === undefined).be.true;
    });

    it('should reject the shared mappings before replay with the standard decorator declaration', () => {
        class Candidate {
            @field(String) id = '';
            @field(String) @fromAll('name') title = '';
        }
        should(() => new ReadModelScenario(Candidate, { readModels: [Candidate], eventTypes: [], projections: [], reducers: [] }))
            .throw(UnsupportedProjectionOperation, 'All (@fromAll)');
    });

    it('should preserve fromEvery precedence when both decorators target one property', () => {
        class Both {
            @field(String) id = '';
            @field(String) @fromEvery('oldName') @fromAll('newName') title = '';
        }
        const { definition } = compileModelBound(Both);
        should(definition.SubscribesToAllEvents === undefined).be.true;
        should(definition.All!.Properties.title).equal('oldName');
    });
});
