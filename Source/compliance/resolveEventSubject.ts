// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { TypeIntrospector } from '../types/TypeIntrospector.js';
import { hasSubjectMetadata } from './subject.js';

/** Resolves the first annotated event property using the .NET SubjectResolver's value semantics. */
export function resolveEventSubject(event: object): string | undefined {
    const type = event.constructor;
    const property = TypeIntrospector.getTrackedProperties(type)
        .find(property => hasSubjectMetadata(type.prototype, property));
    if (property === undefined) return undefined;
    const value: unknown = Reflect.get(event, property);
    if (value === undefined || value === null) return undefined;
    // Strings (including empty strings) are subjects; concepts and other values use ToString.
    if (typeof value === 'string') return value;
    const subject = value.toString();
    return subject === null || subject === undefined || subject === '' ? undefined : subject;
}
