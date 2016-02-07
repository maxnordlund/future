const links = new WeakMap()

export default class Future {
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
  * @private
  * @param {string} operator to apply to the future value
  * @param {...*} parameters for the Reflect operator function
  * @return {Promise} for the result of the operation
  */
function _spliceOperator(future, operator, ...parameters) {
  let original = future.source,
      result = original.then(value => Reflect[operator](value, ...parameters))

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
