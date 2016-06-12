let chai = require("chai"),
    Future = require("../future.js").default

chai.use(require("sinon-chai"))
chai.use(require("chai-as-promised"))

Promise.config({
  longStackTraces: true
})

chai.use((_chai, utils) => {
  chai.Assertion.addProperty("future", function future() {
    this.assert(
        Future.isFuture(this._obj),
        "expected #{this} to be a Future",
        "expected #{this} to not be a Future"
        )

    // Allow further chaining using .eventually
    this._obj = Future.await(this._obj)
  })
})

global.Promise = require("bluebird")
global.expect = chai.expect
global.sinon = require("sinon")
