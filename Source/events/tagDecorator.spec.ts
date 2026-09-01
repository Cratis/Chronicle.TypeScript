// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { describe, expect, it } from 'vitest';
import { getTagsFor, tag, tags } from './tagDecorator';
import { filterEventsByTag, getFilterTagsFor } from './filterEventsByTagDecorator';

describe('tag', () => {
    describe('when a class carries no tags', () => {
        class Untagged {}

        it('should report no tags', () => {
            expect(getTagsFor(Untagged)).toEqual([]);
        });
    });

    describe('when decorating a class with a single tag', () => {
        class SingleTagged {}
        tag('analytics')(SingleTagged);

        it('should carry that tag', () => {
            expect(getTagsFor(SingleTagged).map(_ => _.value)).toEqual(['analytics']);
        });
    });

    describe('when decorating a class with several tags at once', () => {
        class MultiTagged {}
        tag('analytics', 'user-action')(MultiTagged);

        it('should carry every tag', () => {
            expect(getTagsFor(MultiTagged).map(_ => _.value)).toEqual(['analytics', 'user-action']);
        });
    });

    describe('when applying the decorator more than once', () => {
        class Accumulated {}
        tag('first')(Accumulated);
        tag('second')(Accumulated);

        it('should accumulate rather than replace', () => {
            expect(getTagsFor(Accumulated).map(_ => _.value)).toEqual(['first', 'second']);
        });
    });

    describe('when the same tag is applied twice', () => {
        class Duplicated {}
        tag('same')(Duplicated);
        tag('same')(Duplicated);

        it('should keep it once', () => {
            expect(getTagsFor(Duplicated).map(_ => _.value)).toEqual(['same']);
        });
    });

    describe('when using the plural tags decorator', () => {
        class PluralTagged {}
        tags('a', 'b')(PluralTagged);

        it('should behave identically to tag', () => {
            expect(getTagsFor(PluralTagged).map(_ => _.value)).toEqual(['a', 'b']);
        });
    });

    describe('when two classes are tagged separately', () => {
        class FirstTagged {}
        class SecondTagged {}
        tag('one')(FirstTagged);
        tag('two')(SecondTagged);

        it('should not leak tags between them', () => {
            expect(getTagsFor(FirstTagged).map(_ => _.value)).toEqual(['one']);
            expect(getTagsFor(SecondTagged).map(_ => _.value)).toEqual(['two']);
        });
    });
});

describe('filterEventsByTag', () => {
    describe('when a class carries no filter', () => {
        class Unfiltered {}

        it('should report no filter tags', () => {
            expect(getFilterTagsFor(Unfiltered)).toEqual([]);
        });
    });

    describe('when decorating a class with a filter tag', () => {
        class Filtered {}
        filterEventsByTag('vip')(Filtered);

        it('should carry that filter tag', () => {
            expect(getFilterTagsFor(Filtered).map(_ => _.value)).toEqual(['vip']);
        });
    });

    describe('when applying the decorator more than once', () => {
        class MultiFiltered {}
        filterEventsByTag('vip')(MultiFiltered);
        filterEventsByTag('premium')(MultiFiltered);

        it('should accumulate, so the observer handles events carrying any of them', () => {
            expect(getFilterTagsFor(MultiFiltered).map(_ => _.value)).toEqual(['vip', 'premium']);
        });
    });

    describe('when a class is both labeled and filtered', () => {
        class LabeledAndFiltered {}
        tag('reporting')(LabeledAndFiltered);
        filterEventsByTag('vip')(LabeledAndFiltered);

        it('should keep labeling and filtering separate', () => {
            expect(getTagsFor(LabeledAndFiltered).map(_ => _.value)).toEqual(['reporting']);
            expect(getFilterTagsFor(LabeledAndFiltered).map(_ => _.value)).toEqual(['vip']);
        });
    });
});
