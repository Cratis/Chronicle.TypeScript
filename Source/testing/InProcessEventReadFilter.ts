// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { AppendedEvent } from '../events/AppendedEvent.js';
import type { InProcessEventReadCriteria } from './InProcessEventReadCriteria.js';

/** Applies the same source, route-sentinel, and event-type semantics to each read surface. */
export class InProcessEventReadFilter {
    constructor(private readonly criteria: InProcessEventReadCriteria) {}

    matches(event: AppendedEvent): boolean {
        return this.source(event) && this.sourceType(event) && this.streamType(event) && this.streamId(event) && this.eventType(event);
    }

    private source(event: AppendedEvent): boolean {
        return this.criteria.source === undefined || event.context.eventSourceId === this.criteria.source;
    }

    private sourceType(event: AppendedEvent): boolean {
        const value = this.criteria.sourceType;
        return value === undefined || value === 'Default' || event.context.eventSourceType === value;
    }

    private streamType(event: AppendedEvent): boolean {
        const value = this.criteria.streamType;
        return value === undefined || value === 'All' || event.context.eventStreamType === value;
    }

    private streamId(event: AppendedEvent): boolean {
        const value = this.criteria.streamId;
        return value === undefined || value === 'Default' || event.context.eventStreamId === value;
    }

    private eventType(event: AppendedEvent): boolean {
        return !this.criteria.ids.length || this.criteria.ids.includes(event.eventType.id.value);
    }
}
