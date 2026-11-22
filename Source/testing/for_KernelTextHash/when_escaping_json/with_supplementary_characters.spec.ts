// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it } from 'vitest';
import { kernelEscapedJson } from '../../KernelTextHash.js';

chai.should();

describe('when escaping JSON with supplementary characters', () => {
    it('should write each surrogate as an uppercase escape', () => {
        kernelEscapedJson(JSON.stringify({ key: '\u{1f600}' })).should.equal('{"key":"\\uD83D\\uDE00"}');
    });

    it('should escape the highest scalar and adjacent pairs', () => {
        kernelEscapedJson('"\u{10ffff}\u{10000}\u{1f600}\u{1f642}"').should.equal('"\\uDBFF\\uDFFF\\uD800\\uDC00\\uD83D\\uDE00\\uD83D\\uDE42"');
    });

    it('should keep BMP characters, quotes and escapes literal', () => {
        const json = JSON.stringify({ key: '\u00e9\u4eac\u0301"\\\n\u0000' });
        kernelEscapedJson(json).should.equal(json);
    });

    it('should not touch literal backslash-u text or escape it twice', () => {
        const json = JSON.stringify({ key: '\\uD83D\\uDE00' });
        kernelEscapedJson(json).should.equal(json);
        kernelEscapedJson(kernelEscapedJson(JSON.stringify('\u{1f600}'))).should.equal('"\\uD83D\\uDE00"');
    });
});
