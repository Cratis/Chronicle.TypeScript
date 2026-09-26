// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it } from 'vitest';
import { ChronicleOptions } from '../../../ChronicleOptions.js';
import type { ClientArtifactsActivator } from '../../ClientArtifactsActivator.js';

chai.should();

describe('when configuring an artifact activator', () => {
    it('should retain the activator in development options', () => {
        const activator: ClientArtifactsActivator = type => ({ instance: new type() });
        ChronicleOptions.development({ artifactActivator: activator }).artifactActivator!.should.equal(activator);
    });

    it('should forward the activator from a connection string', () => {
        const activator: ClientArtifactsActivator = type => ({ instance: new type() });
        ChronicleOptions.fromConnectionString('chronicle://localhost:35000', { artifactActivator: activator })
            .artifactActivator!.should.equal(activator);
    });
});
