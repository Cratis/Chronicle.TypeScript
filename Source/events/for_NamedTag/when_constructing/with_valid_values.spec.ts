// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it } from 'vitest';
import { NamedTag } from '../../NamedTag.js';

chai.should();

describe('when constructing a named tag with a name and an empty value', () => {
    const tag = new NamedTag('import-batch', '');
    it('should keep the name exactly', () => tag.name.should.equal('import-batch'));
    it('should keep the empty value', () => tag.value.should.equal(''));
    it('should be immutable', () => Object.isFrozen(tag).should.be.true);
});

describe('when comparing named tags', () => {
    it('should treat the same name and value as equal', () => new NamedTag('a', 'B').equals(new NamedTag('a', 'B')).should.be.true);
    it('should compare values case-sensitively', () => new NamedTag('a', 'B').equals(new NamedTag('a', 'b')).should.be.false);
});
