/*
 * The irc parser function below is taken from:
 * https://github.com/martynsmith/node-irc
 */

var IRCClient = function (host, port) {
    this.host = host;
    this.port = port;
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

    this.client.on("closed", function () {
        that.emit("disconnected");
    });

    this.client.on("data", function (chunk) {
        that.buffer += chunk.data;
        var lines = that.buffer.split("\r\n");
        that.buffer = lines.pop();
        lines.forEach(function (line) {
            var message = parseMessage(line, true);
            try {
                emulateMessage(that, message);
                //that.emit("data", message);
            } catch ( err ) {
                that.emit("error", err.message);
            }
        });
    });
    
    this.client.connect();
}

IRCClient.prototype.registerNick = function (nick) {
    this.client.send("NICK " + nick + "\r\n");
    this.client.send("USER " + nick + " irc.nodester.com irc.freenode.net :" + nick + " via http://irc.nodester.com\r\n");
}

IRCClient.prototype.joinChannel = function (channel) {
    this.client.send("JOIN " + channel + "\r\n");
}

IRCClient.prototype.disconnect = function () {
    this.client.disconnect();
}

IRCClient.prototype.send = function (message) {
    //format message if needed
    this.client.send(message);
}

IRCClient.prototype.requestStatistics = function () {
    this.client.send("requestStatistics");
}

IRCClient.prototype.requestWebUsers = function () {
    this.client.send("requestWebUsers");
}

IRCClient.prototype.clearAll = function () {
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
 * the message param has the following fields:
 * .server
 * .nick
 * .user
 * .host
 * .command
 * .rawCommand
 * .commandType
 * .args as array
 * 
 * the output data complies with the former irc.nodester.com JSON format:
 * .messagetype
 * .from
 * .channel
 * .message
 * .users
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
                message: (message.args[1]),
                users: ""
            }));
        } else {
            //notice at login
            that.emit("data", JSON.stringify({
                messagetype: "notice",
                from: (message.args[0]),
                channel: "",
                message: (message.args[1]),
                users: ""
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
            message: (message.args[1]),
            users: ""
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
            message: (message.args[1]),
            users: ""
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

    default:
        break;    
    } 
};

//        /*
//         * Handler for private messages
//         * There is no private messaging using the web client.
//         * in case o private message is received, a message is sent back to the caller
//         * explaining that there is no privacy!
//         */
//        irc.addListener('privmsg', function (message) {
//          if (message.params[0] == cfg.channel) {
//            client.send(JSON.stringify({
//              messagetype: "message",
//              from: message.person.nick,
//              channel: (message.params[0]),
//              message: (message.params[1])
//            }));
//          } else {
//            irc.privmsg(message.person.nick,
//              "Automatic: I am using a web client. I can only talk on channel #nodester.");
//          }
//        });
//        
//        /*
//         * Handler for join
//         */
//        irc.addListener('join', function (message) {
//          client.send(JSON.stringify({
//            messagetype: "join",
//            from: (message.person.nick),
//            channel: (message.params[0])
//          }));
//        });
//        
//        /*
//         * Handler for the topic, 332
//         */
//        irc.addListener('332', function (raw) {
//          client.send(JSON.stringify({
//            messagetype: "topic",
//            //nick
//            from: (raw.params[0]),
//            //channel
//            channel: (raw.params[1]),
//            //topic
//            message: (raw.params[2])
//          }));
//        });
//        
//        /*
//         * Handler for names.
//         * There can be multiple such calls as the names are retrieved, 353
//         */
//        irc.addListener('353', function (raw) {
//          client.send(JSON.stringify({
//            messagetype: "names",
//            //nick
//            from: (raw.params[0]),
//            //channel
//            channel: (raw.params[2]),
//            message: "",
//            //users as a space delimited string
//            users: (raw.params[3].split(" "))
//          }));
//        });
//        
//        /*
//         * Handler for end of names list, 366
//         */
//        irc.addListener('366', function (raw) {
//          client.send(JSON.stringify({
//            messagetype: "endnames",
//            //nick
//            from: (raw.params[0]),
//            //channel
//            channel: (raw.params[1]),
//          }));
//        });
//
//        /*
//         * Handler for quitting
//         * This event will not be triggered after an irc.quit() call
//         */
//        irc.addListener('quit', function (message) {
//          client.send(JSON.stringify({
//            messagetype: "quit",
//            from: (message.person.nick),
//            channel: (message.params[0])
//          }));
//        });
//
//        /*
//         * Handler for parting the channel, while remaining connected to the irc server
//         */
//        irc.addListener('part', function (message) {
//          client.send(JSON.stringify({
//            messagetype: "part",
//            from: (message.person.nick),
//            channel: (message.params[0])
//          }));
//        });
//
//        /*
//         * Handler for server reporting nick change
//         */
//        irc.addListener('nick', function (message) {
//          var prevNick = message.person.nick,
//              newNick = message.params[0];
//          /*
//           * if ever this client will send commands, the code below will be needed
//           *
//          for (var i = 0; i < webUsers.length; i++) {
//            if (webUsers[i] == prevNick) {
//              webUsers[i] = newNick;
//              bWebUsersDirty = true;
//              break;
//            };
//          };
//          */
//          client.send(JSON.stringify({
//            messagetype: "nick",
//            from: prevNick,
//            channel: "",
//            message: newNick
//          }));
//        });
//
//        /*
//         * Handler for irc error 433: nick already in use.
//         * We use this particular handler for the login screen
//         */
//        irc.addListener('433', function (message) {
//          client.send(JSON.stringify({
//            messagetype: "433",
//            //rejected nick
//            from: (message.params[1]),
//            //the irc server as channel
//            channel: message.server,
//            //the rejection message, usually "Nickname is already in use."
//            message: (message.params[2])
//          }));
//        });
//
//        /*
//         * Handler for all irc server errors
//         * This has nothing to do with the eventual irc-js implementation errors
//         * Handles all error messages but 433 handled above
//         */
//        for (var err = 400; err < 600; err++) {
//          if (err != 433) {
//            irc.addListener(err, function (raw) {
//              client.send(JSON.stringify({
//                messagetype: "notice-err",
//                from: "",
//                channel: "",
//                message: raw.raw
//              }));
//            }); //addListener
//          }; //if
//        }; //for
//
//        /*
//         * Handler for our own client
//         * e.g., timeout
//         */
//        irc.addListener('error', function () {
//          client.send(JSON.stringify({ 
//            messagetype: "error"
//          }));
//        });
