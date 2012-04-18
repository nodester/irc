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
    socket.setEncoding("utf8");
    var socketIsConnected = false;
    var clientIsConnected = true; //at this stage this can be only true
    
    socket.on("end", function () {
        socketIsConnected = false;
        if (clientIsConnected)
            client.send(JSON.stringify({
                action: "closed"
            }));
    });
    
    socket.on("connect", function () {
        socketIsConnected = true;
        console.log("socket connected");
        if (clientIsConnected)
            client.send(JSON.stringify({
                action: "connected"
            }));
    });
    
    socket.on("data", function (data) {
        console.log("RECV:" + data + ", length: " + data.length );
        if (clientIsConnected)
            client.send(JSON.stringify({
                action: "data",
                data: data
            }));
    });
    
    //client related
    
    client.on("disconnect", function () {
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