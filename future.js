/** @module future */

/**
 * Map from future proxy objects back to their parent future object.
 *
 * @private
 * @type {Map<Proxy, Future>}
 */
const links = new WeakMap()

/**
 * An function sentinel value used in the {@link Proxy} objects below.
 *
 * In order to support callable futures, the proxy needs to point to a callable
 * object, aka a function. However this means there are some properties already
 * defined which messes with some of the proxy traps. To combat this we scrub
 * the sentinel by clearing its prototype and deleting all properties that can
 * be deleted.
 *
 * @private
 * @type {function(): void}
 */
function SENTINEL() {}
Object.setPrototypeOf(SENTINEL, null)
Object.getOwnPropertyNames(SENTINEL)
.concat(Object.getOwnPropertySymbols(SENTINEL))
.filter(key => Object.getOwnPropertyDescriptor(SENTINEL, key).configurable))
.forEach(key => delete SENTINEL[key])

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
 */
export default class Future {
  /**
   * Waits for all the provided futures/promises and returns a promise for when
   * all of those are resolved. Preserves order of the input.
   *
   * @param {ArrayLike<(Future<*>|Promise<*>)>} targets to wait for
   * @return {Promise<Array<*>>} for when all the provided targets have resolved
   */
  static all(targets) {
    return Promise.all(Array.from(targets).map(target => {
      if (Future.isFuture(target)) {
        return Future.await(target)
      } else {
        return Promise.resolve(target)
      }
    }))
  }

  /**
   * Awaits the provided future proxy object and returns a promise for when the
   * corresponding future resolves.
   *
   * @param {Future<T>} target future proxy object
   * @return {Promise<T>} for when the provided future resolves
   * @throws {TypeError} if the target isn't an future proxy object
   * @template T
   */
  static await(target) {
    return _get(target).source
  }

  /**
   * Cast any value into an future.
   *
   * If the provided value is a future or promise, then that is awaited for,
   * otherwise it's coerced into a promise using {@link Promise.resolve}.
   *
   * @param {T} value to cast into an future
   * @return {Future<T>} for that value
   * @template T
   */
  static from(value) {
    return (new Future(value)).valueOf()
  }

  /**
   * Checks if the provided value is a future proxy object.
   *
   * @param {*} value to check
   * @return {Boolean} if the provided value is a future
   */
  static isFuture(value) {
    return links.has(value)
  }

  /**
   * {@link Proxy} trap for {@link Object.getPrototypeOf}
   *
   * @param {Future<*>} target future
   * @return {Future<U>}
   * @template U
   *
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/handler/getPrototypeOf}
   */
  static getPrototypeOf(target) {
    return _spliceOperator(_get(target), "getPrototypeOf")
  }

  /**
   * {@link Proxy} trap for {@link Object.setPrototypeOf}
   *
   * @param {Future<*>} target future
   * @return {Future<U>}
   * @template U
   *
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/handler/setPrototypeOf}
   */
  static setPrototypeOf(target, prototype) {
    return _spliceOperator(_get(target), "setPrototypeOf", prototype)
  }

  /**
   * {@link Proxy} trap for {@link Object.isExtensible}
   *
   * @param {Future<*>} target future
   * @return {Future<Boolean>}
   *
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/handler/isExtensible}
   */
  static isExtensible(target) {
    return _spliceOperator(_get(target), "isExtensible")
  }

  /**
   * {@link Proxy} trap for {@link Object.preventExtensions}
   *
   * @param {Future<*>} target future
   * @return {Future<Boolean>}
   *
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/handler/preventExtensions}
   */
  static preventExtensions(target) {
    return _spliceOperator(_get(target), "preventExtensions")
  }

  /**
   * @typedef {Object} dataDescriptor
   * @property {U} value
   * @property {Boolean} writable
   * @property {Boolean} configurable
   * @property {Boolean} enumerable
   * @template U
   */

  /**
   * @typedef {Object} accessorDescriptor
   * @property {function(): U} get
   * @property {function(U): U} set
   * @property {Boolean} configurable
   * @property {Boolean} enumerable
   * @template U
   */

  /**
   * @typedef {(dataDescriptor<U>|accessorDescriptor<U>)} descriptor
   */

  /**
   * {@link Proxy} trap for {@link Object.getOwnPropertyDescriptor}
   *
   * @param {Future<*>} target future
   * @param {String} property to get property descriptor for
   * @return {Future<descriptor>}
   * @template U
   *
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/handler/getOwnPropertyDescriptor}
   */
  static getOwnPropertyDescriptor(target, property) {
    return _spliceOperator(_get(target), "getOwnPropertyDescriptor", property)
  }

  /**
   * {@link Proxy} trap for {@link Object.defineProperty}
   *
   * @param {Future<*>} target future
   * @param {String} property to define
   * @param {descriptor} descriptor for the property definition
   * @return {Future<U>}
   * @template U
   *
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/handler/defineProperty}
   */
  static defineProperty(target, property, descriptor) {
    return _spliceOperator(_get(target), "defineProperty", property, descriptor)
  }

  /**
   * {@link Proxy} trap for the in operator
   *
   * @param {*} target This is always the sentinel defined above
   * @param {Future<*>} target future
   * @param {String} property to check for existence
   * @return {Future<Boolean>}
   *
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/handler/has}
   */
  static has(target, property) {
    return _spliceOperator(_get(target), "has", property)
  }

  /**
   * Unlike the deprecated proxy trap for enumerate, this does not follow
   * `for...in` semantics but `for...of` semantics instead.
   *
   * This allows futures for iterables to be looped over easily, instead of
   * being limited to loop over the properties of the future value.
   * To make this case more convenient the future proxy object special cases
   * the well known symobl {@link Symbol.iterator} using this method.
   *
   * Since the iterables bounds are not know until the promise resolves, this
   * will yield new Futures until that point. Therefore you should await each
   * future to avoid unbounded memory allocation.
   *
   * Because of this, each value is wrapped in an IteratorResult, so if you are
   * overzealous you can recover by inspecting the `done` property.
   * The downside is that you need to unwrap every value awaited for. But with
   * destructuring assignment this becomes less of an issue.
   *
   * @example
   *    async function futureIterableExample() {
   *      // Future for some sort of (perhaps infinite) iterable
   *      let futureIterable = Future.from(new Set([1, 2, 3]))
   *      for (let futureValue of futureITerable) {
   *        // Must await each value to ensure bounded memory usage
   *        let {done, value} = await futureValue
   *        console.log("Look ma, I'm using values from the future", value)
   *
   *        // Safety measure if you don't await properly and get too many
   *        // future values using the `for..of` above.
   *        if (done) break
   *      }
   *    }
   *
   * @param {Future<Iterable<T>>} target to iterate over
   * @return {Generator<IteratorResult<void, Future<T>>>}
   * @template T
   */
  static *enumerate(target) {
    yield* _enumerate(_get(target).source.then(source => source[Symbol.iterator]()))
  }

  /**
   * {@link Proxy} trap for {@link Object.getOwnPropertyNames}
   *
   * @param {Future<*>} target future
   * @return {Future<Array<String>>}
   *
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/handler/ownKeys}
   */
  static ownKeys(target) {
    return _spliceOperator(_get(target), "ownKeys")
  }

  constructor(source) {
    // Always coerce it into a Promise
    if (Future.isFuture(target)) {
      this.source = Future.await(target)
    } else {
      this.source = Promise.resolve(target)
    }

    // Proxy an function to allow trapping both `apply` and `construct`
    this.value = new Proxy(SENTINEL, this)

    // Set a back link from the proxy to this using a WeakMap to ensure
    // proper isolation, and because proxies are finicky
    links.set(this.value, this)

    // Return the proxy for this Future to make it easier to use
    return this.value
  }

  /**
   * {@link Proxy} trap for a function call.
   *
   * @param {*} target This is always the sentinel defined above
   * @param {*} thisArg this argument for the call
   * @param {Array<*>} parameters for the call
   * @return {Future<U>}
   * @template U
   *
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/handler/apply}
   */
  apply(target, thisArg, parameters) {
    return _spliceOperator(this, "apply", thisArg, parameters)
  }

  /**
   * {@link Proxy} trap for the new operator
   *
   * @param {*} target This is always the sentinel defined above
   * @param {Array<*>} parameters for the constructor
   * @return {Future<U>}
   * @template U
   *
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/handler/construct}
   */
  construct(target, parameters) {
    return _spliceOperator(this, "construct", parameters)
  }

  /**
   * {@link Proxy} trap for deleting a property value.
   *
   * This always returns true on the assumption that the deletion will go
   * through in the future.
   *
   * @param {*} target This is always the sentinel defined above
   * @param {String} property to delete
   * @return {Boolean}
   *
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/handler/deleteProperty}
   */
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

  /**
   * {@link Proxy} trap for getting a property value.
   *
   * This special cases the well known symbol {@link Symbol.iterator} to support
   * iterating over future values. To do this it uses {@link Future.enumerate},
   * with its caveats.
   *
   * @param {*} target This is always the sentinel defined above
   * @param {String} property to get
   * @param {*} receiver of the assigment
   * @return {Future<U>}
   * @template U
   *
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/handler/get}
   */
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

    /** Special case the well known symbol {@link Symbol.iterator} */
    if (property === Symbol.iterator) return Future.enumerate(target)

    return _spliceOperator(this, "get", property, receiver)
  }

  /**
   * {@link Proxy} trap for setting a property value.
   *
   * This always returns true on the assumption that the assignment will go
   * through in the future.
   *
   * @param {*} target This is always the sentinel defined above
   * @param {String} property to set
   * @param {*} value to set the property to
   * @param {*} receiver of the assigment
   * @return {Boolean}
   *
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/handler/set}
   */
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
   * @return {Proxy<Future<T>>}
   * @template T
   */
  valueOf() {
    return this.value
  }
}

/**
 * Gets the parent future object of the provided proxy, or throws a TypeError.
 *
 * @private
 * @param {Proxy<Future<T>>} target proxy object to look up
 * @throws {TypeError} if the target is not a future proxy object
 * @return {Future<T>}
 * @template T
 */
function _get(target) {
  if (!links.has(target)) throw new TypeError("argument is not a Future")
  return links.get(target)
}

/**
  * Splices the source Promise chain with the provided Reflect operation, to
  * ensure that the operations happen in the same order even when they occur
  * across asynchronous boundaries.
  *
  * All of the parameters are awaited for, so you can call a future method with
  * future values as parameters without worry.
  *
  * @private
  * @param {Future<T>} future to splice into
  * @param {string} operator to apply to the future value
  * @param {...*} parameters for the Reflect operator function
  * @return {Promise<U>} for the result of the operation
  * @template T, U
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
 * overzealous you can recover by inspecting the `done` property. The downside
 * is that you need to unwrap every value awaited for. But with destructuring
 * assignment this becomes less of an issue.
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
    // This stops the while loop below
    done = true

    for (let value of values) {
      if (backlog.length) {
        backlog.unshift().resolve({ done, value })
      } else {
        overflow.push(Future.from({ done, value }))
      }
    }

    // Clear the backlog, since there aren't enough values to yield
    if (backlog.length) {
      backlog.forEach({ resolve } => resolve({ done }))
      backlog.length = 0 // Truncate the backlog to free memory
    }
  }).catch(error => {
    // This stops the while loop below
    done = true

    // Reject any queued promises
    backlog.forEach({ reject } => reject(error))
    overflow.forEach({ reject } => reject(error))

    // Truncate both arrays to free memory
    backlog.length = 0
    overflow.length = 0
  })

  // This is stopped by the resolution of the source promise, in both cases.
  while (!done) {
    // All of the below before the `yield` happens synchronously, so it's safe
    // to abbreviate it a bit.
    yield Future.from(new Promise((resolve, reject) => {
      backlog.push({ resolve, reject })
    }))
  }

  yield* overflow
}
