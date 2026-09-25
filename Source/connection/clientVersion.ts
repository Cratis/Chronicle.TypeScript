// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/** Version of the installed Chronicle client package. */
export const clientVersion = (require('@cratis/chronicle/package.json') as { version: string }).version;
