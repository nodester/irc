/*
 * Based on:
 * https://github.com/bgaff/tcp.js
 * https://github.com/bgaff/vnc.js 
 * http://engineering.linkedin.com/javascript/vncjs-how-build-javascript-vnc-client-24-hour-hackday
 */

var Client = function (host, port) {
    this.host = host;
    this.port = port;
    this.sioIsConnected = false;
    this.endpointIsConnected = false;
    this.callbacks = {};
    return this;
}

Client.prototype.connect = function () {
    var that = this;
    
    if (typeof this.socket === "undefined" || this.socket === null) {
        this.socket = io.connect("http://" + window.location.host, {
            "reconnect": true,
            "connect timeout": 65000, //10000
            "reconnection delay": 1000, //500
            "reconnection limit": Infinity,
            "reopen delay": 3000,
            "max reconnection attempts": 30 //10
        });
    } else {
        //reconnects
        if (this.socket.socket.connected) {
            that.socket.removeAllListeners("connect");
            that.socket.removeAllListeners("reconnect");
            that.socket.removeAllListeners("disconnect");
            that.socket.removeAllListeners("message");
            that.socket.send(JSON.stringify({
                action: "connect",
                host: that.host,
                port: that.port
            }));
        } else {
            this.socket.socket.reconnect();
        }
    }

    this.socket.on("connect", function () {
        that.sioIsConnected = true;
        that.socket.send(JSON.stringify({
            action: "connect",
            host: that.host,
            port: that.port
        }));
    });
    
    this.socket.on("reconnect", function () {
        that.emit("reconnecting");
    });

    this.socket.on("disconnect", function () { 
        that.sioIsConnected = false;
        that.endpointIsConnected = false;
        that.emit("disconnected"); //the socket connection was lost
    });
    
    this.socket.on("message", function (data) { 
        data = JSON.parse(data);
        switch (data.action) {
            case "connected":
                that.endpointIsConnected = true;
                that.emit("connected");     
                break;
            case "closed":
                that.endpointIsConnected = false;
                that.emit("closed"); //the proxy lost connection to irc server
            case "data":
                that.emit("data", {data: data.data});
                break;
            default:
                //app related data that the proxy should not be concerned with, e.g., statistics, webusers
                that.emit(data.action, data);
        }
    });
    
    return this;
}

Client.prototype.disconnect = function () {
    if (this.sioIsConnected)
        this.socket.send(JSON.stringify({
            action: "disconnect"
        }));
}

/*
 * "action" could have been set as the 2nd parameter and made non mandatory
 * but would have made the code less obvious to the eye
 */
Client.prototype.send = function (action, data) {
    if (this.sioIsConnected && this.endpointIsConnected) {
        this.socket.send(JSON.stringify({
            action: action,
            data: data
        }));
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

Client.prototype.clearAll = function () {
    this.callbacks = {};
}