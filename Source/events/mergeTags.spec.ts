// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { describe, expect, it } from 'vitest';
import { Tag } from './Tag';
import { mergeTags } from './mergeTags';

describe('mergeTags', () => {
    describe('when merging a single source of strings', () => {
        it('should return the values unchanged', () => {
            expect(mergeTags(['a', 'b'])).toEqual(['a', 'b']);
        });
    });

    describe('when merging several sources', () => {
        it('should combine them in order', () => {
            expect(mergeTags(['a'], ['b'], ['c'])).toEqual(['a', 'b', 'c']);
        });
    });

    describe('when the same value appears in more than one source', () => {
        it('should keep only the first occurrence', () => {
            expect(mergeTags(['a', 'b'], ['b', 'c'])).toEqual(['a', 'b', 'c']);
        });
    });

    describe('when a source holds Tag instances', () => {
        it('should unwrap them to their values', () => {
            expect(mergeTags([new Tag('a')], ['b'])).toEqual(['a', 'b']);
        });
    });

    describe('when a source is undefined', () => {
        it('should skip it', () => {
            expect(mergeTags(['a'], undefined, ['b'])).toEqual(['a', 'b']);
        });
    });

    describe('when a value is blank', () => {
        it('should drop it, so an empty tag never reaches the wire', () => {
            expect(mergeTags(['a', '', '   '])).toEqual(['a']);
        });
    });

    describe('when there are no sources at all', () => {
        it('should return an empty list', () => {
            expect(mergeTags()).toEqual([]);
        });
    });
});
