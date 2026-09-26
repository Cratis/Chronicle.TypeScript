// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it, vi } from 'vitest';
import type { IClientArtifactsProvider } from '../../../artifacts/index.js';
import type { ChronicleConnection } from '../../../connection/index.js';
import { eventType } from '../../eventTypeDecorator.js';
import { Constraints } from '../Constraints.js';
import { removeConstraint } from '../removeConstraint.js';
import { unique } from '../unique.js';

const should = chai.should();

@eventType('legacy-reserved')
class Reserved {
    @unique('LegacyValue', 'Already reserved') value = '';
}

@removeConstraint('LegacyValue')
class BaseRelease {}

@eventType('legacy-released')
class Released extends BaseRelease {}

describe('when registering legacy decorators with an inherited removal', () => {
    it('should register the inherited removal and the decorated property', async () => {
        const register = vi.fn().mockResolvedValue({});
        const artifacts = { eventTypes: [Reserved, Released], constraints: [] } as unknown as IClientArtifactsProvider;
        const constraints = new Constraints('store', { constraints: { register } } as unknown as ChronicleConnection, artifacts);
        await constraints.register();
        const definition = register.mock.calls[0][0].Constraints[0];
        definition.Name.should.equal('LegacyValue');
        definition.Definition.Value0.EventDefinitions.should.deep.equal([{ EventTypeId: 'legacy-reserved', Properties: ['value'] }]);
        definition.RemovedWith.should.deep.equal(['legacy-released']);
    });
});
