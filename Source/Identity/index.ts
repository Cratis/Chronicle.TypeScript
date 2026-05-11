// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

export { Identity } from './Identity';
export type { IIdentityProvider } from './IIdentityProvider';
export { IdentityProvider } from './IdentityProvider';

import { IdentityProvider } from './IdentityProvider';

/**
 * The default singleton {@link IdentityProvider} for the process.
 * Use this to get and set the identity for the current async call context.
 */
export const identityProvider = new IdentityProvider();
