import Future from "../future.js"

// Change `returns a future for ...` to `returns a ... in the future`

// Need this to access the actual future object and not the proxy.
function createFuture() {
  let future = Object.create(Future.prototype)
  Future.call(future, null)
  return future
}

function describeMethod(method, block) {
  const isStatic = method[0] === "."
  method = method.slice(1)

  describe(method, function decoratedDescribe() {
    if (isStatic) {
      it(`has a static method ${method}`, () => {
        expect(Future).to.itself.respondTo(method)
      })
    } else {
      it(`has an instance method ${method}`, () => {
        expect(Future).to.respondTo(method)
      })
    }

    block.apply(this, arguments)
  })
}

describe("Future", () => {
  describeMethod(".all", () => {
    it("returns a Promise", () => {
      expect(Future.all([])).to.be.a("promise")
    })

    it("handles futures", () => {
      let foo = { bar: "baz" }
      return expect(Future.all([Future.from(foo)])).to.become([foo])
    })

    it("handles promises", () => {
      let foo = { bar: "baz" }
      return expect(Future.all([Promise.resolve(foo)])).to.become([foo])
    })

    it("handles values", () => {
      let foo = { bar: "baz" }
      return expect(Future.all([foo])).to.become([foo])
    })

    it("handles a mix of futures, promises and values", () => {
      let foo = { a: "a" }, bar = [1, 2, 3], baz = "spam"
        return expect(Future.all([
          Future.from(foo),
          Promise.resolve(bar),
          baz
        ])).to.become([foo, bar, baz])
    })
  })

  describeMethod(".await", () => {
    it("returns a Promise", () => {
      expect(Future.await(new Future(null))).to.be.a("promise")
    })

    it("awaits the provided future", () => {
      let target = { bar: "baz" }
      expect(Future.await(new Future(target))).to.become(target)
    })

    it("throws a TypeError on invalid input", () => {
      expect(Future.await.bind(Future, null)).to.throw(TypeError)
    })
  })

  describeMethod(".from", () => {
    it("returns a future", () => {
      expect(Future.from(null)).to.be.a.future
    })
  })

  describeMethod(".isFuture", () => {
    it("returns a boolean", () => {
      expect(Future.isFuture(null)).to.be.a("boolean")
    })

    it("returns true for futures only", () => {
      expect(Future.isFuture(null)).to.be.false
      expect(Future.isFuture(new Future(null))).to.be.true
    })
  })

  describeMethod(".getPrototypeOf", () => {
    it("returns a future for the protoype", () => {
      return expect(Future.getPrototypeOf(new Future([]))).to.be.a.future
        .and.become(Array.prototype)
    })
  })

  describeMethod(".setPrototypeOf", () => {
    it("sets the prototype in the future", () => {
      let target = {}
      return expect(Future.setPrototypeOf(new Future(target), Array.prototype)).to.be.a.future
        .and.eventually.be.true
        .then(() => expect(Object.getPrototypeOf(target)).to.equal(Array.prototype))
    })
  })

  describeMethod(".isExtensible", () => {
    it("returns true if the future object is extensible", () => {
      return expect(Future.isExtensible(new Future({}))).to.be.a.future
        .and.eventually.be.true
    })
  })

  describeMethod(".preventExtensions", () => {
    it("returns a future boolean", () => {
      return expect(Future.preventExtensions(new Future({}))).to.be.a.future
        .and.eventually.be.a("boolean")
    })
  })

  describeMethod(".getOwnPropertyDescriptor", () => {
    it("returns a future property descriptor", () => {
      let target = { foo: "bar" }
      return expect(Future.getOwnPropertyDescriptor(new Future(target), "foo")).to.be.a.future
        .and.eventually.deep.equal(Object.getOwnPropertyDescriptor(target, "foo"))
    })
  })

  describeMethod(".defineProperty", () => {
    it("defines the provided property on the future object", () => {
      let target = {}
      return expect(Future.defineProperty(new Future(target), "foo", { value: "bar" })).to.be.a.future
        .and.eventually.be.a("boolean")
        .then(() => expect(target).to.have.a.property("foo", "bar"))
    })
  })

  describeMethod(".has", () => {
    it("returns true if the future value has the provided key", () => {
      return expect(Future.has(new Future({ foo: "bar" }), "foo")).to.be.a.future
        .and.eventually.be.true
    })

    it("returns false if the future value hasn't the provided key", () => {
      return expect(Future.has(new Future({}), "foo")).to.be.a.future
        .and.eventually.be.false
    })
  })

  describeMethod(".enumerate", () => {
    it("is a generator", () => {
      expect(Future.enumerate).to.be.a("function")
      expect(Future.enumerate.constructor).to.not.equal(Function)
      expect(Future.enumerate.constructor.name).to.match(/Generator/)
    })

    it("follows `for of` sematics")
    it("enumerates over all of the future properties")
    it("rejects all enqueued futures if the source future is rejected")
    it("continues to yield futures indefinitly")
    it("correctly marks the overflow futures")
  })

  describeMethod(".ownKeys", () => {
    it("returns the property names of the future object", () => {
      return expect(Future.ownKeys(new Future({ foo: 1, bar: 2 }))).to.be.a.future
        .and.eventually.deep.equal(["foo", "bar"])
    })

    it("doesn't include the property symbols")
    it("dosen't include non-enumerable properties")
  })

  describeMethod("#apply", () => {
    it("calls the future function and returns its result")
  })

  describeMethod("#construct", () => {
    it("creates a new object from the future class/constructor")
  })

  describeMethod("#deleteProperty", () => {
    it("deletes the provided key on the future object")
  })

  describeMethod("#get", () => {
    it("gets the provided property of the future object")
    it("handles `Symbol.iterator` separately to support `for of` future iterables")
    it("respects non-writable and -configurable properties")
    it("respects non-configurable properties with an undefined getter")
  })

  describeMethod("#set", () => {
    it("sets the provided property of the future object to the provided value")
    it("respects non-writable and -configurable properties")
  })

  describeMethod("#valueOf", () => {
    it("returns the proxy to the future")
  })
})
