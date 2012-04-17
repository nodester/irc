/***************************************\
          IRC#nodester client/proxy
\***************************************/
 
/*
 * @name       : irc.js
 * @mainteiner : Alejandro Morales <vamg008@gmail.com>
 * @licence    : GNU Affero
 * @updated    : 15-04-2012
 * @repo       : http://github.com/nodester/irc
 * @version    : 2.0.1
 * 
 * @note       : Currently there is no implementation for IRC commands.
 *             : This choice is by design.
 *             :
 *             : Nodester irc app acts like a proxy for a real irc server.
 *             :
 *             : This implementation can be further simplified by replacing
 *             : express with a static http file server
*/

var express = require("express"),
    sio = require("socket.io"),
    Proxy = require("./tcp-proxy");

var app = module.exports = express.createServer();

var allowCORS = function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With");
    res.header("Strict-Transport-Security", "max-age=31556926; includeSubDomains");
    res.header("X-Powered-By", "nodeJS");
    next();
};

app.configure(function (){
    app.use(express.static(__dirname + "/public"));
    app.use(allowCORS);
});

//when the app starts
var startTime = (new Date()).getTime(),
    statTime = startTime;

//get usage RAM in bytes
var currMem = process.memoryUsage().rss,
    minMem = currMem,
    maxMem = currMem;

//every 15 seconds poll for the memory
var tmr = setInterval(function () {
    statTime = new Date().toTimeString().substr(0, 9);
    currMem = process.memoryUsage().rss;
    if (currMem < minMem) {
        minMem = currMem;
    };
    if (currMem > maxMem) {
        maxMem = currMem;
    };
    console.log(statTime, "curr:", currMem, "min:", minMem, "max: ", maxMem);
}, 15*1000);

process.on("uncaughtException", function (err) {
    console.log("Uncaught error: " + err.stack);
});

app.get("/", function (req, res, next) {
    res.render("./public/index.html");
});

app.listen(process.env.C9_PORT || process.env['app_port'] || 16960);
console.log("IRC#nodester is running on port %d in %s mode", app.address().port, app.settings.env);

/*
 * array of nicks that connect through the web interface
 * and a flag signalling that a webUser refresh is needed on webclient
 */
var webUsers = [],
    webUsersIsDirty = false;

/*
 * app specific processor, e.g., statistics, web users
 */
var appProcessor = function (action, client, msg, socket) {
    switch (action) {
        case "message":
            switch (msg.action) {
            case "requestStatistics":
                /*
                 * The statistics are gathered every 15 seconds. There will be a lag
                 * of less than 15 seconds since the last statistics "crop" and the actual value
                 */
                client.send(JSON.stringify({
                    action: "statistics",
                    st: startTime,
                    min: minMem,
                    max: maxMem,
                    current: currMem,
                    wud: webUsersIsDirty
                }));
                break;
            case "requestWebUsers":
                client.send(JSON.stringify({
                    action: "webusers",
                    webUsers: webUsers
                }));
                webUsersIsDirty = false;
                break
            case "addWebUsers":
                /*
                 * at this stage of development we cannot tell which user that was previously
                 * connected through a web interface left 
                 * all we can do is make sure we do not have duplicates
                 * this in time will slow down the webclient operation
                 */
                var found = false;
                for (var i = 0; i < webUsers.length; i++) {
                    if (webUsers[i] == msg.data) {
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    webUsers.push(msg.data);
                    webUsersIsDirty = true;
                }
                break;
            case "deleteWebUsers":
                for (var i = 0; i < webUsers.length; i++) {
                    if (webUsers[i] == msg.data) {
                        webUsers.slice(i,1);
                        webUsersIsDirty = true;
                        break;
                    }
                }
                break;
            default:
            }
            break;
        case "disconnect":
            socket.write("QUIT :Webclient closed browser.\r\n");
            break;
        default:
    }
}

var io = sio.listen(app);
//io.set('log level', 0);
io.sockets.on("connection", function (socket) {
    var proxy = new Proxy(socket, appProcessor);
});