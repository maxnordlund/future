/** @module future */

/**
 * Map from future proxy objects back to their parent future object.
 *
 * @private
 * @type {Map<Proxy, Future>}
 */
const links = new WeakMap()

/**
 * Class representing a future value.
 *
 * This is similar to a {@link Promise}, and indeed this is implemented using
 * them. However unlike promises, a future is used just like the value it
 * represents. These are recorded and when the actual value is realized, the
 * operations will be played back onto that value in the _exact_ same order.
 *
 * To be able to do that without a type system, that has perfect knowledge of
 * the return values of all operations, this implementaion uses a {@link Proxy}.
 * However their are a number of invariants that a proxy handler needs to
 * uphold, and since we're dealing with a future value, this is not always
 * possible to do faithfully.
 *
 * Therefore not all traps have been implemented, and for the rest it will
 * uphold all invariants. This means that it sometimes might _not_ return a
 * future as one might expect. But if it didn't, it would have thrown a
 * TypeError instead.
 *
 * Then the question is which traps got choosen?
 * First, the traps can be divided into two broad categories, those that appear
 * to operate directly on the object, and those that appear as special methods
 * on {@link Object}/{@link Reflect}. Only the first category were considered,
 * with the rest implemented as static methods on the {@link Future} class.
 *
 * For the second category only one got excluded, for the `in` operator, since
 * it requires the trap to return a boolean. It is also implemeted as a static
 * method.
 *
 * There are a few more static methods needed, since all operations are
 * recorded by the {@link Proxy}. These allow you to await for one or an
 * iterable of futures/promises, create new futures from any source and finally
 * test if an {@link Proxy} object is a {@link Future}.
 *
 * Because of the use of {@link Proxy} objects, direct creation of future
 * objects is strongly discouraged, use {@link Future.from} instead.
 */
export default class Future {
  static all(targets) {
    return Promise.all(Array.from(targets).map(target => {
      if (Future.isFuture(target)) {
        return Future.await(target)
      } else {
        return Promise.resolve(target)
      }
    }))
  }

  static await(target) {
    return _get(target).source
  }

  static from(value) {
    return (new Future(value)).valueOf()
  }

  static isFuture(target) {
    return links.has(target)
  }

  static getPrototypeOf(target) {
    return _spliceOperator(_get(target), "getPrototypeOf")
  }

  static setPrototypeOf(target, prototype) {
    return _spliceOperator(_get(target), "setPrototypeOf", prototype)
  }

  static isExtensible(target) {
    return _spliceOperator(_get(target), "isExtensible")
  }

  static preventExtensions(target) {
    return _spliceOperator(_get(target), "preventExtensions")
  }

  static getOwnPropertyDescriptor(target, property) {
    return _spliceOperator(_get(target), "getOwnPropertyDescriptor", property)
  }

  static defineProperty(target, property, descriptor) {
    return _spliceOperator(_get(target), "defineProperty", property, descriptor)
  }

  static has(target, property) {
    return _spliceOperator(_get(target), "has", property)
  }

  // for...of
  static *enumerate(target) {
    yield* _enumerate(_get(target).source.then(source => source[Symbol.iterator]()))
  }

  static ownKeys(target) {
    return _spliceOperator(_get(target), "ownKeys")
  }

  constructor(source) {
    // Always coerce it into a Promise
    this.source = Promise.resolve(source)

    // Proxy an function to allow trapping both `apply` and `construct`
    this.value = new Proxy(() => {}, this)

    // Set a back link from the proxy to this using a WeakMap to ensure
    // proper isolation, and because proxies are finicky
    links.set(this.value, this)
  }

  apply(target, thisArg, parameters) {
    return _spliceOperator(this, "apply", thisArg, parameters)
  }

  construct(target, parameters) {
    return _spliceOperator(this, "construct", parameters)
  }

  deleteProperty(target, property) {
    let descriptor = Reflect.getOwnPropertyDescriptor(target, property)

    // Invariant: can only delete configurable properties.
    if (descriptor && !descriptor.configurable) return false

    _spliceOperator(this, "deleteProperty", property, value, receiver)
    return true // Assume we can delete the property in the future
  }

  // for...in
  *enumerate(target) {
    yield* _enumerate(this.source.then(Reflect.enumerate))
  }

  get(target, property, receiver) {
    let descriptor = Reflect.getOwnPropertyDescriptor(target, property)

    // Invariants
    if (descriptor && !descriptor.configurable) {
      // Must return non-writable, non-configurable data properties.
      // Only data descriptors have a boolean writable property.
      if (descriptor.writable === false) return Reflect.get(target, property, receiver)

      // Must return `undefined` for non-configurable accessor properties with
      // an undefined getter
      if (descriptor.get === undefined) return undefined
    }

    return _spliceOperator(this, "get", property, receiver)
  }

  set(target, property, value, receiver) {
    let descriptor = Reflect.getOwnPropertyDescriptor(target, property)

    // Invarient: can only set an configurable, writable, or setter property.
    if (descriptor && !(descriptor.configurable || descriptor.writable || descriptor.set)) {
      return false
    }

    _spliceOperator(this, "set", property, value, receiver)
    return true // Assume we can set the property in the future
  }

  /**
   * Returns the proxy object associated with this future.
   *
   * @return {Proxy}
   */
  valueOf() {
    return this.value
  }
}

/**
 * Gets the parent future object of the provided proxy, or throws a TypeError.
 *
 * @private
 * @param {Proxy} target proxy object to look up
 * @throws {TypeError} if the target is not a future proxy object
 * @return {Future}
 */
function _get(target) {
  if (!links.has(target)) throw new TypeError("argument is not a Future")
  return links.get(target)
}

/**
  * Splices the source Promise chain with the provides Reflect operation, to
  * ensure that the operations happen in the same order even when they occur
  * across asynchronous boundaries.
  *
  * All of the parameters are awaited for, so you can call a future method with
  * future values as parameters without worry.
  *
  * @private
  * @param {string} operator to apply to the future value
  * @param {...*} parameters for the Reflect operator function
  * @return {Promise} for the result of the operation
  */
function _spliceOperator(future, operator, ...parameters) {
  let original = future.source,
      result = Future.all([original, ...parameters]).then(Reflect[operator])

  future.source = result.then(_ => original)
  return result
}

/**
 * Turns an Promise for an iterable into an iterator of futures for the values
 * yielded by the iterable.
 *
 * Since the iterables bounds are not know until the promise resolves, this will
 * yield new Futures until that point. Therefore you should await each future
 * to avoid unbounded memory allocation.
 *
 * Because of this, each value is wrapped in an IteratorResult, so if you are
 * overzealous you can recover by inspecting the `done` property.
 *
 * @private
 * @param {Promise<Iterable<T>>}
 * @return {Generator<IteratorResult<void, Future<T>>>}
 * @template T
 */
function* _enumerate(source) {
  let done = false,
      backlog = [],
      overflow = []

  // Wait until the source has been resolved then process the backlog,
  // handling any overflow in either direction.
  source.then(values => {
    for (let value of values) {
      if (backlog.length) {
        backlog.pop().resolve({ done, value })
      } else {
        overflow.push(Future.from({ done, value }))
      }
    }

    // This stops the while loop below
    done = true
    if (backlog.length) {
      backlog.forEach({ resolve } => resolve({ done }))
      backlog.length = 0 // Truncate the backlog to free memory
    }
  }).catch(error => {
    done = true

    // Reject any queued promises
    backlog.forEach({ reject } => reject(error))
    overflow.forEach({ reject } => reject(error))

    // Truncate both arrays to free memory
    backlog.length = 0
    overflow.length = 0
  })

  while (!done) {
    yield Future.from(new Promise((resolve, reject) => {
      backlog.push({ resolve, reject })
    }))
  }

  yield* overflow
}
