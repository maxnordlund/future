// If v8 is too old, shim proxies and reflect.
if (require("semver").lt("4.9.0", process.versions.v8.replace(/\.([0-9]+)$/, "-$1"))) {
  require("harmony-reflect")
}

try {
  var Promise = require("bluebird")
  global.Promise = Promise
} catch(_error) {
  // Just keep on moving if bluebird isn't available
}

module.exports = exports = require("./dist/node.js")
