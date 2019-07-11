var deepCopy = function (obj) {
    var copy = Object.assign(Object.create(Object.getPrototypeOf(obj)), obj);
    return copy;
}

var getIPAddress = function () {
    var os = require('os');
    var ifaces = os.networkInterfaces();

    var ipAddress = "";

    Object.keys(ifaces).forEach((ifname) => {
        var alias = 0;

        ifaces[ifname].forEach((iface) => {
            if ('IPv4' !== iface.family || iface.internal !== false) {
                // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
                return;
            }

            if (alias >= 1) {
                // this single interface has multiple ipv4 addresses
                console.log(ifname + ':' + alias, iface.address);
            } else {
                // this interface has only one ipv4 adress
                console.log(ifname, iface.address);
                ipAddress = iface.address;
            }
            ++alias;
        });
    });
    return ipAddress;
}

module.exports = { deepCopy, getIPAddress }