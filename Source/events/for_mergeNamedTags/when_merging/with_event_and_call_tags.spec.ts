// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { mergeNamedTags } from '../../mergeNamedTags.js';
import { NamedTag } from '../../NamedTag.js';

chai.should();

describe('when merging event and call named tags', () => {
    let result: NamedTag[];
    beforeEach(() => {
        result = mergeNamedTags(
            [new NamedTag('side', 'debit'), new NamedTag('transfer', 't-1')],
            [new NamedTag('transfer', 't-1'), new NamedTag('transfer', 'T-1'), new NamedTag('side', 'credit')]);
    });
    it('should keep the first occurrence of each exact pair in order, including several values per name', () =>
        result.map(tag => [tag.name, tag.value]).should.deep.equal([
            ['side', 'debit'], ['transfer', 't-1'], ['transfer', 'T-1'], ['side', 'credit']
        ]));
});

describe('when merging plain named tag objects', () => {
    let result: NamedTag[];
    beforeEach(() => { result = mergeNamedTags([{ name: 'channel', value: 'web' } as NamedTag]); });
    it('should return validated named tag instances', () => result[0].should.be.instanceOf(NamedTag));
});

describe('when merging no named tags', () => {
    it('should return an empty list', () => mergeNamedTags(undefined, null, []).should.deep.equal([]));
});
