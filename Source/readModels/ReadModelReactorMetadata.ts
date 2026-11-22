// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';

/** Discovery metadata for one client-managed read-model reactor. */
export interface ReadModelReactorMetadata {
    readonly id: string;
    readonly readModel: Constructor;
}
