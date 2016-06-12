let chai = require("chai"),
    Future = require("../future.js").default

global.Promise = require("bluebird")
global.sinon = require("sinon")
global.expect = chai.expect

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

    // Allow further chaining using chai-as-promised
    this._obj = Future.await(this._obj)
    utils.flag(this, "eventually", true)
  })

  // Add `should` like `have` and `been` for readability
  chai.Assertion.addProperty("should", function should() {})
  chai.Assertion.addProperty("will", function will() {})
  chai.Assertion.addProperty("for", function _for() {})
  chai.Assertion.addProperty("does", function does() {})

  chai.Assertion.addMethod("andThen", function andThen(newExpected) {
    // By setting the `eventually` flag, chai as promised plays along nicely
    this._obj = Promise.resolve(newExpected)
    utils.flag(this, "eventually", true)
  })
})

chai.use(require("sinon-chai"))
// Has to call this last to make it pick up everything else
chai.use(require("chai-as-promised"))
