$(document).ready(function() {
    var sock = null,
        rv = null,
        nickname = null,
        nicks = [], //could be an object if later we decide to add the nick attributes (+,... @)
        webNicks = [], //web irc users
        doNotReconnect = false, //prohibit reconnect to nodester server after a socket disconnect, no retries
        motdPrevLineEmpty = false, //flag for determining if the prev motd line was only spaces and asterisks
        //html elements
        textInput = $('#text_input'),
        logBox = $('#wrapper'),
        chatBody = $('#chat_body'),
        chatForm = $('#chat-form'),
        chatScroller = $('#chat_scroller'),
        joinForm = $('#join-form'),
        joinBtn = $('#join'),
        audio = $('.notification audio').get(0),
        loginStatus = $('#login-status-text'),
        loginMsg = $('#login-msg'),
        loginWrong = $('#wrong'),
        nickText = $('#nick'),
        nickList = $('#nick_list'),
        nickUl = $('#nick_ul'),
        nickLabel = $('#nickLabel'),

        //used in tab completion
        prevKeyWasTab = false,
        pattern = "", //text fragment respective pattern to look for
        candidate = "", //candidate
        source = [], //array of values to be matched
        sourcePos = 0, //the search starting position

        //used in multi tab completion
        patternPos = -1,
        prePattern = "";

    window.counter = 0;
    nickText.focus();

    var Container = function() {
        var bIrcNoticesEnabled = false, //allow display of "notice" messages during login, default false
            bAutoScrollEnabled = true, //allow chat page scroll, default true
            bTonesEnabled = true, //allow tones on pm (yellow) messages, default true
            bStatsEnabled = false, //display statistics
            opts = {
                lines     : 12,
                length    : 7,
                width     : 4,
                radius    : 2.8,
                color     : '#000',
                speed     : 1,
                trail     : 40,
                shadow    : false,
                hwaccel   : false,
                className : 'spinner',
                zIndex    : 2e9,
                top       : 'auto',
                left      : 'auto'
            },
            stats = null, //statistics
            serverStartTime = null; //server start time

        this.getOpts = function() {
            return opts;
        };
        
        this.setIrcNoticesEnabled = function(enabled) {
            bIrcNoticesEnabled = enabled;
        };
        this.getIrcNoticesEnabled = function() {
            return bIrcNoticesEnabled;
        };
        
        this.setAutoScrollEnabled = function(enabled) {
            bAutoScrollEnabled = enabled;
        };
        this.getAutoScrollEnabled = function() {
            return bAutoScrollEnabled;
        };
        
        this.setTonesEnabled = function(enabled) {
            bTonesEnabled = enabled;
        };
        this.getTonesEnabled = function() {
            return bTonesEnabled;
        };

        this.updateStats = function(sts) {
            stats = sts;
            serverStartTime = new Date(stats.st);
        };
        this.getServerTime = function() {
            return (serverStartTime !== null) ? serverStartTime.toRelativeTime() : 0;
        };
        this.getRss = function() {
            return (stats !== null) ? (stats.current/1024/1024).toFixed(1) : "";
        };
        this.getMinRss = function () {
            return (stats !== null) ? (stats.min/1024/1024).toFixed(1) : "";
        };
        this.getMaxRss = function () {
            return (stats !== null) ? (stats.max/1024/1024).toFixed(1) : "";
        };
        this.setStatsEnabled = function(enabled) {
            bStatsEnabled = enabled;
        };
        this.getStatsEnabled = function() {
            return bStatsEnabled;
        };
    };
    var c = new Container();

    var scrollBody = function() {
        chatScroller.animate({ scrollTop: chatScroller.prop("scrollHeight") }, 100);
    };

    joinForm.on('submit', function(e) {
        e.preventDefault();
        doNotReconnect = false;
        if (nickText.val() !== '') {
            loginWrong.addClass('off');
            loginMsg.removeClass('off');
            chatBody.text("");
            if (sock !== null && sock.socket.connected === false) {
                sock.socket.reconnect();
            } else {
                sock = io.connect('http://' + window.location.host);
                sock.on('message', handleMessage);
                sock.on('disconnect', handleDisconnect);
                sock.on('connect', handleConnect);
            };
        } else {
            loginWrong.removeClass('off');
        }
    });
    
    window.onfocus = function () {
        Tinycon.setBubble(0);
        window.counter = 0;
    };
    
    var getNickname = function (name) {
        var name = name || window.nick || 'Guest' + Math.round(Math.random(0,10)*25);
        nickname = name;
        return name;
    };
    
    var appendMessage = function (from, message, isSelf) {
        var row = $('<tr/>');
        if (typeof isSelf !== 'undefined' && isSelf === true) {
            row.addClass('me btn btn-info');
        } else {
            row.addClass('btn');
        }
        
        var row_class = '';
        if (window.nick){
            var reg = window.nick.replace(/\s+/, "|");
            var regexp = new RegExp(reg,'gi');
            if (regexp.test(message)) {
                Tinycon.setBubble(++window.counter);
                row_class='gold';
                if (c.getTonesEnabled() == true) {
                    audio.play();
                }
            } else {
                row_class='default';
            }
        }
        
        message = _.escapeHTML(message);
        message = giveMeColors(message);
        message = message.replace(/(https?:\/\/[-_.a-zA-Z0-9&?\/=\[\]()$!#+:]+)/g, "<a href=\"$1\" target=\"_BLANK\">$1</a>");
        message = message.replace(/\[[0-9][0-9]m/g,'');
        var stats_class = (c.getStatsEnabled() == true) ? 'line-stats' : 'line-stats off';
        var html =  '<td class="author">' + from + '</td>'
                 +  '<td class="msg ' + row_class + '">' + message
                 +  '<span class="time">' + (new Date()).toTimeString().substr(0,9) + '</span>';
        if (c.getRss() == "") {
            html += '</td>';
        } else {
            html += '<span class="'+stats_class+'">' + c.getRss() + '</span></td>';
        }
        row.html(html);
        chatBody.append(row);
        if (c.getAutoScrollEnabled() == true) {
            scrollBody();
        }
    };

    var appendEvent = function (from, event, isSelf, extra) {
        var row = $('<tr/>');
        if (typeof isSelf !== 'undefined' && isSelf === true) {
            row.addClass('me btn btn-info');
        } else {
            row.addClass('btn');
        }
        
        var message = '';
        
        switch (event) {
        case "join":
            message = '<span class="msg-join">joined the channel</span>';
            break;
        case "quit":
        case "part":
            message = '<span class="msg-quitpart">left the channel</span>';
            break;
        case "nick":
            message = '<span class="msg-nick">is now known as ' + extra + '</span>';
            break;
        case "endmotd":
            message = motd;
            break;
        case "connected":
            message = '<span class="msg-connected">Welcome to http://irc.nodester.com/</span>';
            message = message.replace(/(https?:\/\/[-_.a-zA-Z0-9&?\/=\[\]()$!#+:]+)/g, "<a href=\"$1\" target=\"_BLANK\">$1</a>");
            break;
        case "disconnected":
            message = '<span class="msg-disconnected">You\'ve been disconnected from http://irc.nodester.com/<br />Cross your fingers and refresh your browser!</span>';
            message = message.replace(/(https?:\/\/[-_.a-zA-Z0-9&?\/=\[\]()$!#+:]+)/g, "<a href=\"$1\" target=\"_BLANK\">$1</a>");
            break;
        default:
            message = '<span class="msg-unknown">unknown event type</span>';
            break;
        }

        var stats_class = (c.getStatsEnabled() == true) ? 'line-stats' : 'line-stats off';
        var html =  '<td class="author">' + from + '</td>'
                  + '<td class="msg">' + message
                  + '<span class="time">' + (new Date()).toTimeString().substr(0,9)+'</span>'; 
        if (c.getRss() == "") {
            html += '</td>';
        } else {
            html += '<span class="'+stats_class+'">' + c.getRss() + '</span></td>';
        };
        row.html(html);
        chatBody.append(row);
        if (c.getAutoScrollEnabled() == true) {
            scrollBody();
        }
    };

    var appendExtras = function (from, message) {
        message = message.substring(2);
        var extraText = $('#extra');
        if (extraText.text() == "") {
            //we arrived here for the first time
            var row = $('<tr/>');
            row.addClass('btn');
            row.html(
                '<td><p class="author">' + from + '</p></td>'
                + '<td class="msg" id="extra">' + message +'</td>');
            chatBody.append(row);
        } else {
            var text = extraText.html();
            if (message == " ") {
                text += "<br /><br />";
            } else {
                message = message.replace(/(https?:\/\/[-_.a-zA-Z0-9&?\/=\[\]()$!#+:]+)/g, "<a href=\"$1\" target=\"_BLANK\">$1</a>");
                if (motdPrevLineEmpty == true) {
                    text += "<br />" + message;
                } else {
                    text += " " + message;
                }
                motdPrevLineEmpty = (message.replace(/[* ]+/g, '') == "" ? true : false)
            }
            extraText.html(text);
        };
        if (c.getAutoScrollEnabled() == true) {
            scrollBody();
        }
    };

    var nicksToList = function () {
        var content = "";
        if (webNicks.length > 0) {
            for (var i = 0; i < nicks.length; i++) {
                idx = webNicks.indexOf(nicks[i]);
                (idx != -1) ? (content += '<li><p><span class="webnick">' + nicks[i] + '</span></p></li>') :
                              (content += '<li>' + nicks[i] + '</li>');
            }
        } else {
            for (var i = 0; i < nicks.length; i++) {
                content += '<li>' + nicks[i] + '</li>';
            }
        }
        nickUl.html(content);
    };

    var handleMessage = function (data) {
        var obj = JSON.parse(data);
        if (obj && obj.messagetype) {
            var isSelf = (obj.from == nickname) ? true : false;
            switch (obj.messagetype) {
                case "433":  //nick already in use
                    window.spinner.stop();
                    sock.disconnect();
                    loginMsg.addClass('off');
                    loginWrong.text("");
                    loginWrong.removeClass('off');
                    loginWrong.text(obj.message);
                    joinBtn.removeAttr("disabled");
                    return;
                //notice at login
                case "notice":
                case "notice-err":
                //notice for content    
                case "notice-msg":
                    if (c.getIrcNoticesEnabled() == true) {
                        appendMessage(obj.from, obj.message, false);
                    } else {
                        //redirect to login screen
                        var html = loginStatus.html();
                        html += "<br />" + obj.message; 
                        loginStatus.html(html); 
                    }
                    break;
                case "error":  //nick already in use
                    window.spinner.stop();
                    sock.disconnect();
                    loginMsg.addClass('off');
                    loginWrong.text("");
                    loginWrong.removeClass('off');
                    loginWrong.text("Oh well, try again!");
                    joinBtn.removeAttr("disabled");
                    return;
                case "message":
                    appendMessage(obj.from, obj.message, false);
                    requestStatistics();
                    break;
                case "topic":
                    appendMessage("Topic", obj.message, false);
                    break;
                case "names":
                    for (var i = 0; i < obj.users.length; i++) {
                        nicks.push(obj.users[i]);
                    }
                    break;
                case "endnames":
                    nicks.sort(cisort);
                    nicksToList();
                    break;
                    /*
                     * motd is currently disabled
                     * just uncomment if you want it
                     * you must enable the server corresponding part as well in irc.js
                     */
                case "motd":
                    appendExtras(obj.from, obj.message);
                    break;
                case "endmotd":
                    //do nothing
                    break;
                case "001":
                    //here we use end of motd to signal web irc login completed
                    c.setIrcNoticesEnabled(true);
                    window.spinner.stop();
                    $('<meta/>', {content: nick, name: 'nick'}).appendTo($('head'));
                    $('#chat_wrapper').removeClass('off');
                    textInput.focus();
                    appendEvent("IRC #nodester", "connected", false);
                    chatScroller.height(nickList.height() - 1);
                    logBox.slideToggle();
                    nickLabel.text(nickname);
                    joinBtn.removeAttr("disabled");
                    break;
                case "join":
                    appendEvent(obj.from, obj.messagetype, isSelf);
                    if (isSelf == false) {
                        nicks.push(obj.from);
                        nicks.sort(cisort);
                        nicksToList();
                    }
                    requestStatistics();
                    break;
                case "quit":
                case "part":
                    appendEvent(obj.from, obj.messagetype, isSelf);
                    for (var i = 0; i < nicks.length; i++) {
                        if (nicks[i] == obj.from) {
                            nicks.splice(i,1);
                            break;
                        }
                    }
                    nicksToList();
                    requestStatistics();
                    break;
                case "nick":
                    appendEvent(obj.from, obj.messagetype, isSelf, obj.message);
                    for (var i = 0; i < nicks.length; i++) {
                        if (nicks[i] == obj.from) {
                            nicks[i] = obj.message;
                            break;
                        }
                    }
                    nicks.sort(cisort);
                    nicksToList();
                    //requestStatistics(); this call will be needed if the web client will also send commends
                    break;
                case "statistics":
                    c.updateStats(obj);
                    if (obj.wud == true) {
                        //the webusers list has been changed, we initiate retrieval
                        requestWebUsers();
                    }
                    var header_class = (c.getStatsEnabled() == true) ? 'header-stats' : 'header-stats off';
                    nickLabel.html('<span class="'+header_class+'">Server up for: ' + c.getServerTime()
                        + ', mem: ' + c.getMinRss() + '/' + c.getMaxRss() + 'MB</span> ' + nickname);
                    break;
                case "webusers":
                    webNicks = obj.wu;
                    nicksToList();
                    break;
                default:
                    alert(data);
                    break;
            };
        } else {
            console.log(data);
        }
    };

    var handleConnect = function () {
        //cancel reconnect
        if (doNotReconnect == true) {
            return;
        }
        loginMsg.text("");
        loginStatus.html("");
        var nick = window.nick = getNickname(nickText.val());
        loginMsg.text("Joining as " + nick + "...");
        joinBtn.prop("disabled", "disabled");
        c.setIrcNoticesEnabled(false);
        sock.send(JSON.stringify({ nickname: nick }));
        //start spinner
        window.target = document.getElementById('join-form');
        window.spinner = new Spinner(c.getOpts()).spin(window.target);
    };
    
    /*
     * set a time delay for disconnect
     * 
     * in case we exit the form we do not want the user to see it
     * the socket has a reconnect timeout that does not help us with irc here
     * so we make sure the socket won't reconnect: doNotReconnect = true
     */
    var handleDisconnect = function () {
        doNotReconnect = true;
        setTimeout( function () {
            appendEvent("*", "disconnected", false);
            nicks = [];
            nicksToList();
        }, 1000);
    };

    var sendMessage = function () {
        appendMessage(nickname, textInput.val(), true);
        sock.send(JSON.stringify({
            messagetype: "message",
            message: textInput.val()
        }));
        textInput.val('');
    };

    /*
     * requesting statistics is user action triggered
     * in case it is proven to be to resource intensive
     * another solution can be sought, e.g., on a timer
     */
    var requestStatistics = function () {
        sock.send(JSON.stringify({ statistics: ""}))
    };

    var requestWebUsers = function () {
        sock.send(JSON.stringify({ webusers: ""}))
    };

    chatForm.on('submit', function (e) {
  	e.preventDefault();
        if (textInput.val() !== '') {
            sendMessage();
        } else {
            alert('<p> You need to input a name</p>');
        }
        textInput.focus();
        return false;
    });

/*  var ocolors = {
      'bold'      : ['\033[1m',  '\033[22m'],
      'italic'    : ['\033[3m',  '\033[23m'],
      'underline' : ['\033[4m',  '\033[24m'],
      'inverse'   : ['\033[7m',  '\033[27m'],
      'white'     : ['\033[37m', '\033[39m'],
      'grey'      : ['\033[90m', '\033[39m'],
      'black'     : ['\033[30m', '\033[39m'],
      'blue'      : ['\033[34m', '\033[39m'],
      'cyan'      : ['\033[36m', '\033[39m'],
      'green'     : ['\033[32m', '\033[39m'],
      'magenta'   : ['\033[35m', '\033[39m'],
      'red'       : ['\033[31m', '\033[39m'],
      'yellow'    : ['\033[33m', '\033[39m']
    };
*/
    var colors = {
       'p'    :['<p>','</p>'],
       '[1m'  :['<strong>','</strong>'],
       '[22m' :['<strong>','</strong>'],
       '[3m'  :['<i>','</i>'],
       '[23m' :['<i>','</i>'],
       '[4m'  :['<u>','</u>'],
       '[24m' :['<u>','</u>'],
       '[7m'  :['<span>','</span>'],
       '[27m' :['<span>','</span>'],
       '[37m' :['<span style="color:white">','</span>'],
       '[90m' :['<span style="color:grey">','</span>'],
       '[30m' :['<span style="color:#444">','</span>'],
       '[34m' :['<span style="color:blue">','</span>'],
       '[36m' :['<span style="color:cyan">','</span>'],
       '[32m' :['<span style="color:green">','</span>'],
       '[35m' :['<span style="color:magenta">','</span>'],
       '[31m' :['<span style="color:red">','</span>'],
       '[33m' :['<span style="color:yellow">','</span>']
    };

    var giveMeColors = function (str) {
        var old = str = str || '[44m'+str+'[43m';
        str = str.split(str.search(/\[[0-9][0-9]m/));
        var text  = str.join('').split(/\[[0-9][0-9]m/g);
        var color = str.join('').match(/\[[0-9][0-9]m|\[[0-9]m/g)||'';
        var loop  = -1;
        var dohs  = 0;
        while (color[loop + 1]){
            var prev = ++loop;
            var next = ++loop;
            if (color[prev]){
                if (colors[color[prev]]){
                    var math = (old.search('\\'+color[next])-old.search('\\'+color[prev]))
                    if (!(math > 0 && math < 5)){
                        old = old.replace(new RegExp('\\'+color[prev]), colors[color[prev]][0])
                        old = old.replace(new RegExp('\\'+color[next]),colors[color[prev]][1]);
                    } else {
                        old = old.replace(new RegExp('\\'+color[prev]), colors[color[prev]][0])
                        old = old.replace(new RegExp('\\'+color[next]), colors[color[next]][0])
                        old = old.replace(new RegExp('\\'+color[++loop]), colors[color[next]][1])
                        old = old.replace(new RegExp('\\'+color[++loop]),colors[color[prev]][1]);
                    }
                }
            }
        }
        return old.replace(/\[[0-9]m|\[|[0-9][0-9]m|/g,'');
    };

    /*
     * case insensitive compare
     * will not remove attributes like +, @ before comparison
     */
    var cisort = function (x, y) {
        var a = x.toUpperCase(); 
        var b = y.toUpperCase(); 
        if (a > b) {
            return 1; 
        } else if (a < b) {
            return -1;
        } else {
            return 0; 
        }
    };

    //to resize "chat_scroller" to the size of screen
    $(window).resize(function () {
        chatScroller.height(nickList.height()-1);
    });

    var fn = function(obj) {
        c.setAutoScrollEnabled(false);
        if(obj.scrollTop() + obj.height() >= obj.prop("scrollHeight"))
        {
            c.setAutoScrollEnabled(true);
        }
    };

    chatScroller.on('scroll', function () {
        fn($(this));
    });

    $('#btnTones').on('click', function () {
        //will not remember the tones status yet :), cookies, mmm
        c.setTonesEnabled(!c.getTonesEnabled());
        if (c.getTonesEnabled() == true) {
            $('#btnTones').text("Disable tones");
        } else {
            $('#btnTones').text("Enable tones");
        }
    });

    $('#btnStats').on('click', function () {
        //will not remember the stats status yet :), cookies, mmm
        c.setStatsEnabled(!c.getStatsEnabled());
        if (c.getStatsEnabled() == true) {
            $('#btnStats').text("Hide stats");
            $('.line-stats').removeClass('off');
            $('.header-stats').removeClass('off');
        } else {
            $('#btnStats').text("Show stats");
            $('.line-stats').addClass('off');
            $('.header-stats').addClass('off');
        }
    });

    textInput.keydown( function (event) {
        if (source.length == 0) {
            source = nicks; //initialization in case we press Tab with no prior input
        }
        if (event.keyCode == 9) {
            event.preventDefault();
            if (prevKeyWasTab == false) {
                prevKeyWasTab = true;
                pattern = textInput.val();
                patternPos = pattern.lastIndexOf(" ");
                if (patternPos != -1 ) {
                    prePattern = pattern.substr(0, patternPos+1);
                    pattern = pattern.substr(patternPos+1);
                };
                pattern = new RegExp("^"+pattern, "i");
                sourcePos = 0;
                candidate = incrementalSearch(pattern, source, sourcePos);
                if (candidate.length > 0) {
                    //candidate found
                    textInput.val(prePattern+candidate);
                    return;
                }
            } else {
                candidate = incrementalSearch(pattern, source, sourcePos);
                if (candidate.length > 0) {
                    //candidate found
                    textInput.val(prePattern+candidate);
                    return;
                }
            }
        } else {
            prevKeyWasTab = false;
            prePattern = "";
            source = nicks; //we do not want the source to change during tabcompletion
        }
    });

    var incrementalSearch = function (pattern, source, sp) {
        var result = "";
        var r = 0;
        for (var i = sp; i < source.length; i++) {
            r = source[i].search(pattern);
            sourcePos = (i+1 > source.length-1) ? 0 : i+1;
            if (r == 0) {
                return source[i];
            }
        }
        for (var i = 0; i < sp; i++) {
            r = source[i].search(pattern);
            sourcePos = i+1;
            if (r == 0) {
                return source[i];
            }
        }
        return result;
    };
});