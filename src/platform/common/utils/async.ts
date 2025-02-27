// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { BaseError } from '../../errors/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PromiseFunction = (...any: any[]) => Promise<any>;

/**
 * Error type thrown when a timeout occurs
 */
export class TimedOutError extends BaseError {
    constructor(message: string) {
        super('timeout', message);
    }
}

export async function sleep(timeout: number): Promise<number> {
    return new Promise<number>((resolve) => {
        setTimeout(() => resolve(timeout), timeout);
    });
}

export async function waitForPromise<T>(promise: Promise<T>, timeout: number): Promise<T | null> {
    // Set a timer that will resolve with null
    return new Promise<T | null>((resolve, reject) => {
        const timer = setTimeout(() => resolve(null), timeout);
        promise
            .then((result) => {
                // When the promise resolves, make sure to clear the timer or
                // the timer may stick around causing tests to wait
                clearTimeout(timer);
                resolve(result);
            })
            .catch((e) => {
                clearTimeout(timer);
                reject(e);
            });
    });
}

export async function waitForCondition(
    condition: () => Promise<boolean>,
    timeout: number,
    interval: number
): Promise<boolean> {
    // Set a timer that will resolve with null
    return new Promise<boolean>((resolve) => {
        let finish: (result: boolean) => void;
        const timer = setTimeout(() => finish(false), timeout);
        const intervalId = setInterval(() => {
            condition()
                .then((r) => {
                    if (r) {
                        finish(true);
                    }
                })
                .catch((_e) => finish(false));
        }, interval);
        finish = (result: boolean) => {
            clearTimeout(timer);
            clearInterval(intervalId);
            resolve(result);
        };
    });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isPromise<T>(v: any): v is Promise<T> {
    return typeof v?.then === 'function' && typeof v?.catch === 'function';
}

//======================
// Deferred

// eslint-disable-next-line @typescript-eslint/naming-convention
export interface Deferred<T> {
    readonly promise: Promise<T>;
    readonly resolved: boolean;
    readonly rejected: boolean;
    readonly completed: boolean;
    readonly value?: T;
    resolve(value?: T | PromiseLike<T>): void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    reject(reason?: any): void;
}

class DeferredImpl<T> implements Deferred<T> {
    private _resolve!: (value: T | PromiseLike<T>) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private _reject!: (reason?: any) => void;
    private _resolved: boolean = false;
    private _rejected: boolean = false;
    private _promise: Promise<T>;
    private _value: T | undefined;
    public get value() {
        return this._value;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(private scope: any = null) {
        // eslint-disable-next-line
        this._promise = new Promise<T>((res, rej) => {
            this._resolve = res;
            this._reject = rej;
        });
    }
    public resolve(value?: T | PromiseLike<T>) {
        this._value = value as T | undefined;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this._resolve.apply(this.scope ? this.scope : this, arguments as any);
        this._resolved = true;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public reject(_reason?: any) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this._reject.apply(this.scope ? this.scope : this, arguments as any);
        this._rejected = true;
    }
    get promise(): Promise<T> {
        return this._promise;
    }
    get resolved(): boolean {
        return this._resolved;
    }
    get rejected(): boolean {
        return this._rejected;
    }
    get completed(): boolean {
        return this._rejected || this._resolved;
    }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createDeferred<T>(scope: any = null): Deferred<T> {
    return new DeferredImpl<T>(scope);
}

export function createDeferredFrom<T>(promise: Promise<T>): Deferred<T> {
    const deferred = createDeferred<T>();
    promise
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .then(deferred.resolve.bind(deferred) as any)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .catch(deferred.reject.bind(deferred) as any);

    return deferred;
}
export function createDeferredFromPromise<T>(promise: Promise<T>): Deferred<T> {
    const deferred = createDeferred<T>();
    promise.then(deferred.resolve.bind(deferred)).catch(deferred.reject.bind(deferred));
    return deferred;
}

//================================
// iterators

/**
 * An iterator that yields nothing.
 */
export function iterEmpty<T>(): AsyncIterator<T, void> {
    // eslint-disable-next-line no-empty,@typescript-eslint/no-empty-function
    return (async function* () {})() as unknown as AsyncIterator<T, void>;
}

type NextResult<T> = { index: number } & (
    | { result: IteratorResult<T, T | void>; err: null }
    | { result: null; err: Error }
);
async function getNext<T>(it: AsyncIterator<T, T | void>, indexMaybe?: number): Promise<NextResult<T>> {
    const index = indexMaybe === undefined ? -1 : indexMaybe;
    try {
        const result = await it.next();
        return { index, result, err: null };
    } catch (err) {
        return { index, err, result: null };
    }
}

// eslint-disable-next-line no-empty,@typescript-eslint/no-empty-function
export const NEVER: Promise<unknown> = new Promise(() => {});

/**
 * Yield everything produced by the given iterators as soon as each is ready.
 *
 * When one of the iterators has something to yield then it gets yielded
 * right away, regardless of where the iterator is located in the array
 * of iterators.
 *
 * @param iterators - the async iterators from which to yield items
 * @param onError - called/awaited once for each iterator that fails
 */
export async function* chain<T>(
    iterators: AsyncIterator<T, T | void>[],
    onError?: (err: Error, index: number) => Promise<void>
    // Ultimately we may also want to support cancellation.
): AsyncIterator<T, void> {
    const promises = iterators.map(getNext);
    let numRunning = iterators.length;
    while (numRunning > 0) {
        const { index, result, err } = await Promise.race(promises);
        if (err !== null) {
            promises[index] = NEVER as Promise<NextResult<T>>;
            numRunning -= 1;
            if (onError !== undefined) {
                await onError(err, index);
            }
            // XXX Log the error.
        } else if (result!.done) {
            promises[index] = NEVER as Promise<NextResult<T>>;
            numRunning -= 1;
            // If R is void then result.value will be undefined.
            if (result!.value !== undefined) {
                yield result!.value;
            }
        } else {
            promises[index] = getNext(iterators[index], index);
            // Only the "return" result can be undefined (void),
            // so we're okay here.
            yield result!.value as T;
        }
    }
}

/**
 * Map the async function onto the items and yield the results.
 *
 * @param items - the items to map onto and iterate
 * @param func - the async function to apply for each item
 * @param race - if `true` (the default) then results are yielded
 *               potentially out of order, as soon as each is ready
 */
export async function* mapToIterator<T, R = T>(
    items: T[],
    func: (item: T) => Promise<R>,
    race = true
): AsyncIterator<R, void> {
    if (race) {
        const iterators = items.map((item) => {
            async function* generator() {
                yield func(item);
            }
            return generator();
        });
        yield* iterable(chain(iterators));
    } else {
        yield* items.map(func);
    }
}

/**
 * Convert an iterator into an iterable, if it isn't one already.
 */
export function iterable<T>(iterator: AsyncIterator<T, void>): AsyncIterableIterator<T> {
    const it = iterator as AsyncIterableIterator<T>;
    if (it[Symbol.asyncIterator] === undefined) {
        it[Symbol.asyncIterator] = () => it;
    }
    return it;
}

/**
 * Get everything yielded by the iterator.
 */
export async function flattenIterator<T>(iterator: AsyncIterator<T, void>): Promise<T[]> {
    const results: T[] = [];
    // We are dealing with an iterator, not an iterable, so we have
    // to iterate manually rather than with a for-await loop.
    let result = await iterator.next();
    while (!result.done) {
        results.push(result.value);
        result = await iterator.next();
    }
    return results;
}

/**
 * Provides the ability to chain promises.
 */
export class PromiseChain {
    private currentPromise: Promise<void | undefined> = Promise.resolve(undefined);
    /**
     * Chain the provided promise after all previous promises have successfully completed.
     * If the previously chained promises have failed, then this call will fail.
     */
    public async chain<T>(promise: () => Promise<T>): Promise<T> {
        const deferred = createDeferred<T>();
        const previousPromise = this.currentPromise;
        this.currentPromise = this.currentPromise.then(async () => {
            try {
                const result = await promise();
                deferred.resolve(result);
            } catch (ex) {
                deferred.reject(ex);
                throw ex;
            }
        });
        // Wait for previous promises to complete.
        await previousPromise;
        return deferred.promise;
    }
    /**
     * Chain the provided promise after all previous promises have completed (ignoring errors in previous promises).
     */
    public chainFinally<T>(promise: () => Promise<T>): Promise<T> {
        const deferred = createDeferred<T>();
        this.currentPromise = this.currentPromise.finally(() =>
            promise()
                .then((result) => deferred.resolve(result))
                .catch((ex) => deferred.reject(ex))
        );
        return deferred.promise;
    }
}
