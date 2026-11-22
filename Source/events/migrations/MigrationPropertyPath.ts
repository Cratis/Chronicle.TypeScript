// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * A payload property path of up to eight segments. Root properties remain valid,
 * including whole arrays, dates and objects; nested paths traverse objects only.
 * Optional and nullable objects can be traversed, but arrays, dates and functions cannot.
 */
export type MigrationPropertyPath<T, Depth extends readonly unknown[] = []> = (keyof T & string) | {
    [Key in keyof T & string]: Depth['length'] extends 7 ? never
        : NonNullable<T[Key]> extends readonly unknown[] | Date | ((...arguments_: never[]) => unknown) ? never
        : NonNullable<T[Key]> extends object
            ? `${Key}.${MigrationPropertyPath<NonNullable<T[Key]>, [...Depth, unknown]>}`
            : never;
}[keyof T & string];
