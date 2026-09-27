// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Guid, JsonSerializer } from '@cratis/fundamentals';
import { getEventTypeFor } from '../events/eventTypeDecorator.js';
import { getTagsFor } from '../events/tagDecorator.js';
import { mergeTags } from '../events/mergeTags.js';
import { identityProvider } from '../identity/index.js';
import { causationManager, CausationType } from '../auditing/index.js';
import { correlationIdManager } from '../correlation/index.js';
import type { AppendOptions } from './AppendOptions.js';

/** The production client and in-process scenario share the single-append serialization boundary. */
export function prepareSingleAppend(event: object, options?: AppendOptions) {
    const eventType = getEventTypeFor(event.constructor as Function);
    const correlationId = options?.correlationId === undefined
        ? Guid.as(correlationIdManager.current.value)
        : Guid.as(options.correlationId);
    const content = JsonSerializer.serialize(event);
    const tags = mergeTags(getTagsFor(event.constructor as Function), options?.tags);
    const causationChain = causationManager.run(CausationType.appendEvent, { eventType: eventType.id.value },
        () => causationManager.getCurrentChain());
    const identity = identityProvider.getCurrent();
    return { eventType, correlationId, content, tags, causationChain, identity };
}
