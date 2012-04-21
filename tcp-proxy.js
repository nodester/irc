/*
 * Based on:
 * https://github.com/bgaff/tcp.js
 * https://github.com/bgaff/vnc.js 
 * http://engineering.linkedin.com/javascript/vncjs-how-build-javascript-vnc-client-24-hour-hackday
 */

var Proxy = function (client, appProcessor) {
    //create the socket to connect to remote server on behalf of the client
    var net = require("net");
    var socket = new net.Socket();
    socket.setEncoding("ascii");
    socket.clientid = client.id;
    var socketIsConnected = false;
    var clientIsConnected = true; //at this stage this can be only true
    
    socket.on("end", function () {
        console.log("socket END clientid: " + socket.clientid + " on client socket.io id: " + client.id);
        socketIsConnected = false;
        if (clientIsConnected)
            client.send(JSON.stringify({
                action: "closed"
            }));
    });
    
    socket.on("connect", function () {
        console.log("socket CONNECT clientid: " + socket.clientid + " on client socket.io id: " + client.id);
        socketIsConnected = true;
        console.log("socket connected");
        if (clientIsConnected)
            client.send(JSON.stringify({
                action: "connected"
            }));
    });
    
    socket.on("data", function (data) {
        console.log("socket DATA clientid: " + socket.clientid + " on client socket.io id: " + client.id);
        console.log("RECV:" + data + ", length: " + data.length );
        if (clientIsConnected)
            client.send(JSON.stringify({
                action: "data",
                data: data
            }));
    });
    
    //client related
    
    client.on("reconnect", function () {
        console.log("client on RECONNECT.io socket.io: " + client.id + " for socket clientid:" + socket.clientid);
    });

    client.on("disconnect", function () {
        console.log("client on DISCONNECT.io socket.io: " + client.id + " for socket clientid:" + socket.clientid);
        clientIsConnected = false;
        if (socketIsConnected) {
            /*
             * app related data that the proxy should not be concerned with:
             * remove nick from webUsers list
             * send irc.quit
             */
            if (typeof appProcessor === "function") {
                appProcessor("disconnect", null, null, socket);
            }
            setTimeout(function () {
                socketIsConnected = false;
                socket.destroy();
                console.log("client disconnected");
            }, 1000);
        }
    });
    
    client.on("message", function (message) {
        console.log("client on MESSAGE.io socket.io: " + client.id + " for socket clientid:" + socket.clientid);
        msg = JSON.parse(message);
        switch (msg.action) {
            case "connect":
                console.log("CONNECT: " + msg.host + ":" + msg.port);
                socket.connect(msg.port, msg.host);
                break;
            case "disconnect":
                console.log("DISCONNECT");
                if (socketIsConnected)
                    socket.end();
                break;
            case "data":
                console.log("SEND");
                if (socketIsConnected) {
                    console.log(msg.data);
                    socket.write(msg.data);
                }
                break;
            default:
                /*
                 * app related data that the proxy should not be concerned with:
                 * - requestStatistics()
                 * - addWebUser(nick)
                 * - updateWebUser(former, current)
                 * - listWebUsers()
                 */
                console.log(msg.action);
                if (typeof appProcessor === "function") {
                    appProcessor("message", client, msg, null);
                }
        }
    });
}

//export proxy
module.exports = Proxy;