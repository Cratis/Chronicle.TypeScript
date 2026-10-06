// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it } from 'vitest';
import { InvalidNamedTag } from '../../InvalidNamedTag.js';
import { mergeNamedTags } from '../../mergeNamedTags.js';
import type { NamedTag } from '../../NamedTag.js';

chai.should();

describe('when merging named tags with invalid entries', () => {
    it('should reject a null element', () => (() => mergeNamedTags([null as unknown as NamedTag])).should.throw(InvalidNamedTag));
    it('should reject a plain object with a blank name', () =>
        (() => mergeNamedTags([{ name: ' ', value: 'x' } as NamedTag])).should.throw(InvalidNamedTag));
    it('should reject a string instead of a collection', () =>
        (() => mergeNamedTags('name' as unknown as NamedTag[])).should.throw(InvalidNamedTag));
});
