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
 * @global
 * @class Proxy
 * @see {@link https://developer.mozilla.org/en-us/docs/web/javascript/reference/global_objects/Proxy}
 */

/**
 * @global
 * @class Promise
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise}
 */

/**
 * @global
 * @class Object
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object}
 */

/**
 * @global
 * @class Reflect
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Reflect}
 */

/**
 * @global
 * @class Array
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array}
 */

/**
 * @global
 * @class TypeError
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypeError}
 */
