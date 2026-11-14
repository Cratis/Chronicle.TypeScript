// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Names the edge a relation follows: a function returning the edge class, which is resolved when the views are
 * validated so the classes can be declared in any order, or the edge type string, for example MEMBER_OF.
 */
export type GraphViewEdgeReference = (() => Function) | string;
