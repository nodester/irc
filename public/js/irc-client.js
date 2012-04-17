/*
 * The irc parser function below is taken from:
 * https://github.com/martynsmith/node-irc
 */

var IRCClient = function (host, port) {
    this.host = host;
    this.port = port;
    this.channel = ""; //gets filled in at join
    this.nick = ""; //gets filled in at login or can be changed by the irc server
    this.client = new Client(host, port);

    //callbacks for the IRCClient caller
    this.callbacks = {};
    
    //used for internal data processing
    this.buffer = '';
    
    return this;
}

IRCClient.prototype.connect = function () {
    var that = this;
    this.client.on("connected", function () {
        that.emit("connected");
    });

    this.client.on("disconnected", function () {
        that.emit("disconnected");
    });

    this.client.on("closed", function () {
        that.emit("closed");
    });

    this.client.on("error", function () {
        that.emit("error");
    });

    this.client.on("data", function (chunk) {
        that.buffer += chunk.data;
        var lines = that.buffer.split("\r\n");
        that.buffer = lines.pop();
        lines.forEach(function (line) {
            var message = parseMessage(line, true);
            try {
                //to make this implementation compatible with the former irc client at irc.nodester.com
                emulateMessage(that, message);
            } catch ( err ) {
                that.emit("error", err.message);
            }
        });
    });

    this.client.on("statistics", function (data) {
        that.emit("data", JSON.stringify({
            messagetype: "statistics",
            st: data.st,
            min: data.min,
            max: data.max,
            current: data.current,
            wud: data.wud
        }));
    });

    this.client.on("webusers", function (data) {
        that.emit("data", JSON.stringify({
            messagetype: "webusers",
            webusers: data.webUsers
        }));
    });

    this.client.connect();
}

IRCClient.prototype.registerNick = function (nick) {
    this.nick = nick;
    this.client.send("data", "NICK " + nick + "\r\n");
    this.client.send("data", "USER " + nick + " irc.nodester.com irc.freenode.net :" + nick + " via http://irc.nodester.com\r\n");
}

IRCClient.prototype.joinChannel = function (channel) {
    this.channel = channel;
    this.client.send("data", "JOIN " + channel + "\r\n");
}

IRCClient.prototype.quit = function (reason) {
    reason = reason || "session closed";
    this.channel = channel;
    this.client.send("data", "QUIT :" + reason + "\r\n");
}

IRCClient.prototype.disconnect = function () {
    this.client.disconnect();
}

IRCClient.prototype.sendPrivMsg = function (message) {
    this.client.send("data", "PRIVMSG " + this.channel + " :" + message + "\r\n");
}

IRCClient.prototype.requestStatistics = function () {
    this.client.send("requestStatistics");
}

IRCClient.prototype.requestWebUsers = function () {
    this.client.send("requestWebUsers");
}

IRCClient.prototype.clearAll = function () {
    this.client.clearAll();
    this.callbacks = {};
}

IRCClient.prototype.emit = function (event, param) {
    if (typeof this.callbacks[event] === "function")
        this.callbacks[event].call(this, param);
}

IRCClient.prototype.on = function (event, callback) {
    if (typeof callback === "function")
        this.callbacks[event] = callback;
    return this;
}

/*
 * The irc parser is taken from:
 * https://github.com/martynsmith/node-irc
 * 
 * parseMessage(line, stripColors)
 *
 * takes a raw "line" from the IRC server and turns it into an object with
 * useful keys
 */
var parseMessage = function (line, stripColors) {
    var message = {};
    var match;

    if (stripColors) {
        line = line.replace(/[\x02\x1f\x16\x0f]|\x03\d{0,2}(?:,\d{0,2})?/g, "");
    }

    // Parse prefix
    if ( match = line.match(/^:([^ ]+) +/) ) {
        message.prefix = match[1];
        line = line.replace(/^:[^ ]+ +/, '');
        if ( match = message.prefix.match(/^([_a-zA-Z0-9\[\]\\`^{}|-]*)(!([^@]+)@(.*))?$/) ) {
            message.nick = match[1];
            message.user = match[3];
            message.host = match[4];
        }
        else {
            message.server = message.prefix;
        }
    }

    // Parse command
    match = line.match(/^([^ ]+) +/);
    message.command = match[1];
    message.rawCommand = match[1];
    message.commandType = 'normal';
    line = line.replace(/^[^ ]+ +/, '');
    message.args = [];
    var middle, trailing;

    // Parse parameters
    if (line.indexOf(':') != -1) {
        var index = line.indexOf(':');
        middle = line.substr(0, index).replace(/ +$/, "");
        trailing = line.substr(index+1);
    }
    else {
        middle = line;
    }

    if (middle.length)
        message.args = middle.split(/ +/);

    if (typeof(trailing) != 'undefined' && trailing.length)
        message.args.push(trailing);

    return message;
};

/*
 * this is transitional to former irc.nodester.com implementation
 * and some irc specific messaging
 * 
 * the message parameter has the following fields:
 * .server .nick .user .host .command .rawCommand .commandType .args as array
 * 
 * the output data complies with the former irc.nodester.com JSON format:
 * .messagetype .from .channel .message .users
 */
var emulateMessage = function (that, message) {
    switch (message.command) {

    /*
     * Handler for notices
     */
    case "NOTICE":
        if (message.nick !== undefined) {
            //notice for content
            that.emit("data", JSON.stringify({
                messagetype: "notice-msg",
                from: (message.nick),
                channel: "",
                message: (message.args[1])
            }));
        } else {
            //notice at login
            that.emit("data", JSON.stringify({
                messagetype: "notice",
                from: (message.args[0]),
                channel: "",
                message: (message.args[1])
            }));
        }
        break;

    /*
     * Handler for the welcome message
     * This indicates that the irc server accepted our request, and while there
     * are further possible notifications, for us this is a sign that we can
     * close the login screen and open the main window.
     */
    case "001":
        //webUsers.push(irc.options.nick);
        //bWebUsersDirty = true; //for self
        that.emit("data", JSON.stringify({
            messagetype: "001",
            from: (message.args[0]),
            channel: "",
            message: (message.args[1])
        }));
        break;

    /*
     * Handler for a motd line, 372, max 80 chars
     * There are multiple calls as such until the entire motd is received
     * Note: not all servers emit a motd!
     */
    case "372":
        that.emit("data", JSON.stringify({
            messagetype: "motd",
            from: (message.server),
            channel: "",
            message: (message.args[1])
        }));
        break

    /*
     * Handler for the end of motd, 376
     */
    case "376":
        that.emit("data", JSON.stringify({
            messagetype: "endmotd",
            //server
            from: (message.server)
        }));
        break;

    /*
     * Handler for join
     */
    case "JOIN":
        if (that.nick == message.nick) {
            that.client.send("addWebUsers", that.nick);
        }
        that.emit("data", JSON.stringify({
            messagetype: "join",
            from: (message.nick),
            channel: (message.args[0]),
            message: (message.user + "@" + message.host)
        }));
        break;

    /*
     * Handler for names.
     * There can be multiple such calls as the names are retrieved, 353
     */
    case "353":
        that.emit("data", JSON.stringify({
            messagetype: "names",
            //nick
            from: (message.args[0]),
            //channel
            channel: (message.args[2]),
            message: "",
            //users as a space delimited string
            users: (message.args[3].split(" "))
        }));
        break;

    /*
     * Handler for end of names list, 366
     */
    case "366":
        that.emit("data", JSON.stringify({
            messagetype: "endnames",
            //nick
            from: (message.args[0]),
            //channel
            channel: (message.args[1]),
        }));
        break;

    /*
     * Handler for the topic, 332
     */
    case "332":
        that.emit("data", JSON.stringify({
            messagetype: "topic",
            //nick
            from: (message.args[0]),
            //channel
            channel: (message.args[1]),
            //topic
            message: (message.args[2])
        }));
        break;

    /*
     * Handler for quitting
     */
    case "QUIT":
        that.emit("data", JSON.stringify({
            messagetype: "quit",
            from: (message.nick),
            channel: "",
            message: (message.args[0])
        }));
        break;

    /*
     * Handler for parting the channel, while remaining connected to the irc server
     */
    case "PART":
        that.emit("data", JSON.stringify({
            messagetype: "part",
            from: (message.nick),
            channel: (message.args[0])
        }));
        break;

    /*
     * Handler for private messages
     * There is no private messaging using the web client.
     * in case o private message is received, a message is sent back to the caller
     * explaining that there is no privacy!
     */
    case "PRIVMSG":
        if (message.args[0] == that.channel) {
            that.emit("data", JSON.stringify({
                messagetype: "message",
                from: message.nick,
                channel: (message.args[0]),
                message: (message.args[1])
            }));
        } else {
            that.client.send("data", "PRIVMSG " + message.nick
                    + " :I am using a web client. I can only talk on channel #nodester.\r\n");
        }
        break;

    /*
     * Handler for server reporting nick change
     */
    case "NICK":
        var prevNick = message.nick,
            newNick = message.args[0];
        /*
         * if ever this client will send commands, the code below might be needed
         *
        for (var i = 0; i < webUsers.length; i++) {
            if (webUsers[i] == prevNick) {
                webUsers[i] = newNick;
                bWebUsersDirty = true;
                break;
            };
        };
         */
        if (that.nick == prevNick) {
            that.nick = newNick;
            //perform an "update" of web users
            that.client.send("deleteWebUsers", prevNick);
            that.client.send("addWebUsers", newNick);
        }
        that.emit("data", JSON.stringify({
            messagetype: "nick",
            from: prevNick,
            channel: "",
            message: newNick
        }));
        break

    /*
     * Handler for irc error 433: nick already in use.
     * We use this particular handler for the login screen
     */
    case "433":
        that.emit("data", JSON.stringify({
            messagetype: "433",
            //rejected nick
            from: (message.args[1]),
            //the irc server as channel
            channel: message.server,
            //the rejection message, e.g., "Nickname is already in use."
            message: (message.args[2])
        }));
        break;

    /*
     * Handler for a server PING
     */
    case "PING":
        that.client.send("data", "PONG :" + message.args[0] + "\r\n");
        break

    /*
     * Handler for a server ERROR
     */
    case "ERROR":
        that.emit("data", JSON.stringify({
            messagetype: "error",
            from: "",
            channel: "",
            //the error message
            message: (message.args[0])
        }));
        break

    default:
        /*
         * Handler for all irc server error messages, but 433 handled above
         */
        var errorCode = parseInt(message.command);
        if ((errorCode !== NaN) && (errorCode >= 400) && (errorCode <= 600)) {
            that.emit("data", JSON.stringify({
                messagetype: "notice-err",
                from: message.args[0],
                channel: message.args[1],
                message: message.args[2]
            }));
        }
    } 
};
///*
//* Handler for our own client
//* e.g., timeout
//*/
//irc.addListener('error', function () {
//client.send("data", JSON.stringify({
// messagetype: "error"
//}));
//});
