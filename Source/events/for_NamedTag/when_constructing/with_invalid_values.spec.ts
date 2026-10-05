// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it } from 'vitest';
import { InvalidNamedTag } from '../../InvalidNamedTag.js';
import { NamedTag } from '../../NamedTag.js';

chai.should();

describe('when constructing a named tag with invalid values', () => {
    it('should reject an empty name', () => (() => new NamedTag('', 'value')).should.throw(InvalidNamedTag));
    it('should reject a whitespace name', () => (() => new NamedTag(' \t', 'value')).should.throw(InvalidNamedTag));
    it('should reject a name of only next-line characters like .NET', () => (() => new NamedTag('\u0085', 'value')).should.throw(InvalidNamedTag));
    it('should reject a missing name', () => (() => new NamedTag(undefined as unknown as string, 'value')).should.throw(InvalidNamedTag));
    it('should reject a null value', () => (() => new NamedTag('name', null as unknown as string)).should.throw(InvalidNamedTag));
    it('should reject a non-string value', () => (() => new NamedTag('name', 42 as unknown as string)).should.throw(InvalidNamedTag));
});
