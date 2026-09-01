// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { pii } from './pii';
import { PIINotSupportedOnEventSourceId } from './PIINotSupportedOnEventSourceId';

// Decorators are applied as plain function calls (rather than `@decorator` syntax) so these
// fixtures don't depend on the test runner's decorator-syntax support.

describe('pii', () => {
    describe('when applied to the eventSourceId property', () => {
        class SomeEvent {
            eventSourceId = '';
        }

        it('should throw PIINotSupportedOnEventSourceId', () => {
            expect(() => pii()(SomeEvent.prototype, 'eventSourceId')).toThrow(PIINotSupportedOnEventSourceId);
        });

        it('should describe why the property cannot be encrypted', () => {
            expect(() => pii()(SomeEvent.prototype, 'eventSourceId')).toThrow(/event source identifier/);
        });
    });

    describe('when applied to any other property', () => {
        class SomeEvent {
            eventSourceId = '';
            name = '';
        }

        it('should not throw', () => {
            expect(() => pii()(SomeEvent.prototype, 'name')).not.toThrow();
        });
    });
});
