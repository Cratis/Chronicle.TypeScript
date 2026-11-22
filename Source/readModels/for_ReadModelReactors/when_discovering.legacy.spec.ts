// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it } from 'vitest';
import { readModelReactor, getReadModelReactorMetadata, getReadModelReactorHandlers } from '../readModelReactor.js';
import { DefaultClientArtifactsProvider } from '../../artifacts/DefaultClientArtifactsProvider.js';
import { TypeDiscoverer } from '../../types/TypeDiscoverer.js';

chai.should();
class LegacyModel {}
@readModelReactor(LegacyModel, 'legacy-read-model-reactor')
class LegacyReactor { removed(_model: LegacyModel) {} }

describe('when discovering read-model reactors with legacy decorators', () => {
    it('should preserve explicit metadata and discover convention methods', () => {
        getReadModelReactorMetadata(LegacyReactor)!.readModel.should.equal(LegacyModel);
        getReadModelReactorHandlers(LegacyReactor).should.deep.equal(['removed']);
        new DefaultClientArtifactsProvider(TypeDiscoverer.default).readModelReactors.should.include(LegacyReactor);
    });
});
