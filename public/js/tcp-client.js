/*
 * Based on:
 * https://github.com/bgaff/tcp.js
 * https://github.com/bgaff/vnc.js 
 * http://engineering.linkedin.com/javascript/vncjs-how-build-javascript-vnc-client-24-hour-hackday
 */

var Client = function (host, port) {
    this.host = host;
    this.port = port;
    this.webUAIsConnected = false;
    this.endpointIsConnected = false;
    this.callbacks = {};
    return this;
}

Client.prototype.connect = function () {
    var that = this;
    
    if (typeof this.socket === "undefined" || this.socket === null) {
        this.socket = io.connect("http://" + window.location.host, {"reconnect": false})
    } else {
        if (!this.socket.socket.connected)
            socket.socket.reconnect();
    }

    this.socket.on("connect", function () {
        that.webUAIsConnected = true;
        that.socket.send(JSON.stringify({action: "connect", host: that.host, port: that.port}));
    });
    
    this.socket.on("disconnect", function () { 
        that.webUAIsConnected = false;
        that.endpointIsConnected = false;
        that.emit("error", "the socket connection to UA was lost");
    });
    
    this.socket.on("message", function (data) { 
        data = JSON.parse(data);
        switch (data.action) {
            case "connected":
                that.endpointIsConnected = true;
                that.emit("connected");     
                break;
            case "data":
                that.emit("data", {data: data.data});
                break;
            case "closed":
                that.endpointIsConnected = false;
                that.emit("closed");
            default:
        }
    });
    
    return this;
}

Client.prototype.disconnect = function () {
    if (this.webUAIsConnected)
        this.socket.send(JSON.stringify({action: "disconnect"}));
}

Client.prototype.send = function (data1) {
    if (this.webUAIsConnected && this.endpointIsConnected) {
        this.socket.send(JSON.stringify({action: "data", data: data1}));
    }
}

Client.prototype.emit = function (event, param) {
    if (typeof this.callbacks[event] === "function")
        this.callbacks[event].call(this, param);
}

Client.prototype.on = function (event, callback) {
    if (typeof callback === "function")
        this.callbacks[event] = callback;
    return this;
}