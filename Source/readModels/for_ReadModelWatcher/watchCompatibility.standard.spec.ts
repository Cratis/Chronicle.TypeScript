// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import { chai, describe, expectTypeOf, it } from 'vitest';
import type { IReadModels } from '../IReadModels.js';
import type { ReadModels } from '../ReadModels.js';
import type { ReadModelChangeset } from '../ReadModelChangeset.js';

chai.should();

describe('when implementing the original watch contract', () => {
    it('should keep exactly the signature exported on main', () => {
        expectTypeOf<IReadModels['watch']>().toEqualTypeOf<
            <TReadModel>(readModelType: Constructor<TReadModel>) => AsyncIterable<ReadModelChangeset<TReadModel>>
        >();
        expectTypeOf<ReadModels['watch']>().toEqualTypeOf<IReadModels['watch']>();
    });

    it('should accept an existing async generator implementation without watcher members', async () => {
        const mock: Pick<IReadModels, 'watch'> = {
            async *watch<TReadModel>(readModelType: Constructor<TReadModel>) {
                yield { namespace: 'tenant', key: 'one', readModel: new readModelType(), removed: false };
            }
        };
        const iterator = mock.watch(class Model {})[Symbol.asyncIterator]();
        (await iterator.next()).value.key.should.equal('one');
    });
});
