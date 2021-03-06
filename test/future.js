import Future from "../future.js"

// Convenience function to reduce boilerplate. It handles `respondTo` and table
// based testing. Just return an hash of test name to paramter list and it will
// verify Futures' implementation against Reflects' since they are very similar
function describeMethod(method, block) {
  const isStatic = (method[0] === ".")
  method = method.slice(1)

  describe(method, function decoratedDescribe() {
    let subject

    if (isStatic) {
      it("is a static method", () => {
        expect(Future).to.itself.respondTo(method)
      })

      subject = () => Future
    } else {
      it("is an instance method", () => {
        expect(Future).to.respondTo(method)
      })

      subject = () => new Future(null)
    }

    let table = Object(block.apply(this, arguments))
    Object.keys(table).forEach((name) => {
      it(name, () => {
        let parameters = table[name],
            original = parameters.slice()

        parameters[0] = new Future(parameters[0])
        return expect(subject()[method](...parameters)).to.be.a.future
          .and.become(Reflect[method](...original))
      })
    })
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
    // Can't use expect(...).to.be.a.future here since that uses Future.await

    it("returns a Promise", () => {
      expect(Future.await(new Future(null))).to.be.a("promise")
    })

    it("waits until the provided future resolves", () => {
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
    // Can't use expect(...).to.be.a.future here since that uses Future.isFuture

    it("returns a boolean", () => {
      expect(Future.isFuture(null)).to.be.a("boolean")
    })

    it("returns true for futures only", () => {
      expect(Future.isFuture(null)).to.be.false
      expect(Future.isFuture(new Future(null))).to.be.true
    })
  })

  describeMethod(".getPrototypeOf", () => {
    return {
      "returns a future for the protoype": [[]]
    }
  })

  describeMethod(".setPrototypeOf", () => {
    it("sets the prototype in the future", () => {
      let target = {}
      return expect(Future.setPrototypeOf(new Future(target), Array.prototype)).to
        .be.a.future.that.will.be.true
        .then(() => expect(Object.getPrototypeOf(target)).to.equal(Array.prototype))
    })
  })

  describeMethod(".isExtensible", () => {
    it("returns true if the future object is extensible", () => {
      return expect(Future.isExtensible(new Future({}))).to.be.a.future.that.will.be.true
    })
  })

  describeMethod(".preventExtensions", () => {
    it("returns a boolean in the future", () => {
      return expect(Future.preventExtensions(new Future({}))).to.be.a.future.for.a("boolean")
    })
  })

  describeMethod(".getOwnPropertyDescriptor", () => {
    return {
      "returns a property descriptor in the future": [{ foo: "bar" }, "foo"]
    }
  })

  describeMethod(".defineProperty", () => {
    it("defines the provided property on the future object", () => {
      let target = {}
      return expect(Future.defineProperty(new Future(target), "foo", { value: "bar" })).to
        .be.a.future.for.a("boolean")
        .andThen(target).should.have.a.property("foo", "bar")
    })
  })

  describeMethod(".has", () => {
    return {
      "returns true if the future value has the provided key": [{ foo: "bar" }, "foo"],
      "returns false if the future value hasn't the provided key": [{}, "foo"]
    }
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
    let nonEnumerableTarget = {}
    Object.defineProperty(nonEnumerableTarget, "foo", {
      value: "bar",
      enumerable: false
    })

    return {
      "returns the property names of the future object": [{ foo: 1, bar: 2 }],
      "this includes property symbols": [{ [Symbol.iterator]: "@@iterator" }],
      "this includes non-enumerable properties": [nonEnumerableTarget]
    }
  })

  describeMethod("#apply", () => {
    it("calls the future function and returns its result", () => {
      let target = { sentinel: true },
          stub = sinon.stub().returns(target),
          futureFunction = new Future(stub)

      return expect(futureFunction("some parameters")).to
        .be.a.future.that.will.become(target)
        .andThen(stub).should.have.been.calledWith("some parameters")
    })

    it("sets the `this` value of the future function", () => {
      let context = { sentinel: true, method() {} },
          spy = sinon.spy(context, "method"),
          target = new Future(context)

      return expect(target.method()).to.be.a.future
        .andThen(spy).should.have.been.calledOn(context)
    })
  })

  describeMethod("#construct", () => {
    it("creates a new object from the future class/constructor", () => {
      class Foo {}
      let FutureFoo = new Future(Foo)

      return expect(new FutureFoo("some parameters")).to.be.a.future.for.an.instanceof(Foo)
    })
  })

  describeMethod("#deleteProperty", () => {
    it("deletes the provided key on the future object", () => {
      let target = new Future({ foo: "bar", baa: "zar" })

      delete target.foo
      return expect(target).to.be.a.future.that.does.not.have.property("foo")
    })
  })

  describeMethod("#get", () => {
    it("gets the provided property of the future object", () => {
      let target = new Future({ foo: "bar", baa: "zar" })

      return expect(target.foo).to.be.a.future.that.will.become("bar")
    })

    it("handles `Symbol.iterator` separately to support `for of` future iterables")
    it("respects non-writable and -configurable properties")
    it("respects non-configurable properties with an undefined getter")
  })

  describeMethod("#set", () => {
    it("sets the provided property of the future object to the provided value", () => {
      let target = new Future({ foo: "bar", baa: "zar" })

      target.foo = "something different"
      return expect(target).to.be.a.future
        .that.will.have.a.property("foo", "something different")
    })

    it("respects non-writable and -configurable properties")
  })

  describeMethod("#valueOf", () => {
    it("returns the proxy to the future value", () => {
      // Need this to access the actual future object and not the proxy.
      let internal = Object.create(Future.prototype)
      Future.call(internal, null)

      expect(internal.valueOf() === internal, "internal.valueOf() === interal").to.be.false
      return expect(internal.valueOf()).to.be.a.future
    })
  })
})
