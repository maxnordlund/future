import Future from "../future.js"

// Need this to access the actual future object and not the proxy.
function createFuture() {
  let future = Object.create(Future.prototype)
  Future.call(future, null)
  return future
}

function describeMethod(method, block) {
  const isStatic = method[0] === "."
  method = method.slice(1)

  if (isStatic) {
    it(`has a static method ${method}`, () => {
      expect(Future).to.itself.respondTo(method)
    })
  } else {
    it(`has an instance method ${method}`, () => {
      expect(Future).to.respondTo(method)
    })
  }

  describe(method, block)
   // () => {
   // let check, name
   // if (typeof returnType === "string") {
   //   name = returnType
   //   check = "an"
   // } else {
   //   name = returnType.name
   //   check = "instanceof"
   // }

   // if (isStatic) {
   //   it(`returns a ${name}`, () => {
   //     expect(Future[method](new Future(null))).to.be[check](returnType)
   //   })
   // } else {
   //   it(`returns a ${name}`, () => {
   //     expect(createFuture()[method](new Future(null))).to.be[check](returnType)
   //   })
   // }

   // block()
  //})
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
      let foo = { bar: "baz" }
      expect(Future.await(new Future(foo))).to.become(foo)
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
        .and.eventually.become(Array.prototype)
    })
  })

  describeMethod(".setPrototypeOf", () => {
    it("sets the prototype in the future", () => {
      return expect(Future.setPrototypeOf(new Future([]), Array.prototype)).to.be.a.future
        .and.eventually.be.true
    })
  })

  describeMethod(".isExtensible", () => {
    it("returns a future boolean", () => {
      return expect(Future.isExtensible(new Future({}))).to.be.a.future
          .and.eventually.be.a("boolean")
    })
  })

  describeMethod(".preventExtensions", () => {
    it("returns a future boolean", () => {
      return expect(Future.preventExtensions(new Future({}))).to.be.a.future
          .and.eventually.be.a("boolean")
    })
  })

  describeMethod(".getOwnPropertyDescriptor", () => {})

  describeMethod(".defineProperty", () => {})

  describeMethod(".has", () => {
    it("returns a future boolean", () => {
      return expect(Future.has(new Future({}), "foo")).to.be.a.future
          .and.eventually.be.a("boolean")
    })
  })

  describeMethod(".enumerate", () => {})

  describeMethod(".ownKeys", () => {})

  describeMethod("#apply", () => {})

  describeMethod("#construct", () => {})

  describeMethod("#deleteProperty", () => {})

  describeMethod("#get", () => {})

  describeMethod("#set", () => {})

  describeMethod("#valueOf", () => {})
})
