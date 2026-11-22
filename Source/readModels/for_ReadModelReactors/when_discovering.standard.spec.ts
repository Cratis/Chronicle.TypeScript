// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it } from 'vitest';
import { DefaultClientArtifactsProvider } from '../../artifacts/DefaultClientArtifactsProvider.js';
import { TypeDiscoverer } from '../../types/TypeDiscoverer.js';
import { getReadModelReactorHandlers, getReadModelReactorMetadata, readModelReactor } from '../readModelReactor.js';
import type { IReadModelReactor } from '../IReadModelReactor.js';
import type { ReadModelChangeset } from '../ReadModelChangeset.js';

chai.should();
class StandardModel { value = ''; }
class Base { modified(_model: StandardModel) {} }
@readModelReactor(StandardModel, 'standard-read-model-reactor')
class StandardReactor extends Base implements IReadModelReactor<StandardModel> {
    constructor() { super(); throw new Error('Discovery must not construct a reactor'); }
    added(_model: StandardModel, _change: ReadModelChangeset<StandardModel>) {}
    override modified(_model: StandardModel) {}
}

describe('when discovering read-model reactors with standard decorators', () => {
    it('should discover the explicit id and referenced model without activation', () => {
        const provider = new DefaultClientArtifactsProvider(TypeDiscoverer.default);
        provider.readModelReactors.should.include(StandardReactor);
        provider.readModels.should.include(StandardModel);
        getReadModelReactorMetadata(StandardReactor)!.id.should.equal('standard-read-model-reactor');
        getReadModelReactorHandlers(StandardReactor).should.deep.equal(['added', 'modified']);
    });
    it('should allow inherited methods but not inherited class metadata', () => {
        @readModelReactor(StandardModel, 'inherited-read-model-reactor')
        class Inherited extends Base {}
        class Undecorated extends StandardReactor {}
        getReadModelReactorHandlers(Inherited).should.deep.equal(['modified']);
        (() => getReadModelReactorHandlers(Undecorated)).should.throw('Missing @readModelReactor');
    });
    it('should reject duplicate metadata on the same class', () => {
        (() => readModelReactor(StandardModel)(StandardReactor)).should.throw('Duplicate');
    });
    it('should reject an empty, static-only or non-method handler without constructing', () => {
        class Empty {}
        class StaticOnly { static added() {} }
        class Malformed { get added() { throw new Error('Getter must not execute'); } }
        for (const type of [Empty, StaticOnly, Malformed]) {
            readModelReactor(StandardModel)(type);
            (() => getReadModelReactorHandlers(type)).should.throw();
        }
    });
});
