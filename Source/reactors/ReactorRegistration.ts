// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import type { IReactorDefinition } from './IReactorDefinition.js';
import { ReactorRegistrationKind } from './ReactorRegistrationKind.js';

/** The identity retained independently of any particular observation attempt. */
export type ReactorRegistration =
    { readonly id: string; readonly kind: ReactorRegistrationKind.Discovered; readonly type: Constructor } |
    { readonly id: string; readonly kind: ReactorRegistrationKind.Fluent | ReactorRegistrationKind.Delegate; readonly definition: IReactorDefinition };
