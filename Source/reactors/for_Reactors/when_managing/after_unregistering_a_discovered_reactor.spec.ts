// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, beforeEach, chai, describe, it } from 'vitest';
import { runtime_reactors } from '../given/runtime_reactors.fixture.js';
import { OnCustomSequence, request } from './given/managed_reactors.js';

chai.should();

describe('when managing a discovered reactor after unregistering it', () => {
    let context: runtime_reactors;
    beforeEach(async () => {
        context = new runtime_reactors();
        context.artifacts.push(OnCustomSequence);
        await context.reactors.register();
        await context.reactors.unregister('on-custom');
        await context.reactors.replay('on-custom');
    });
    afterEach(() => context.reactors.dispose());
    it('should still target its declared sequence', () => context.replay.mock.calls[0][0].should.deep.equal(request('on-custom', 'custom')));
});

describe('when waiting for a decorated reactor that is not registered yet', () => {
    let context: runtime_reactors;
    beforeEach(async () => {
        context = new runtime_reactors();
        context.artifacts.push(OnCustomSequence);
        context.information.mockResolvedValue({ IsSubscribed: true } as never);
        await context.reactors.waitTillSubscribed('on-custom');
    });
    afterEach(() => context.reactors.dispose());
    it('should poll the declared sequence', () => (context.information.mock.calls[0][0] as object).should.deep.equal(request('on-custom', 'custom')));
});
