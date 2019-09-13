var deepCopy = function (obj) {
    var copy = Object.assign(Object.create(Object.getPrototypeOf(obj)), obj);
    return copy;
}

module.exports = { deepCopy}