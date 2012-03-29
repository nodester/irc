$(document).ready(function(){
    var sock      = null;
    var rv        = null;
    var nickname  = null;
    var textInput = $('#text_input');
    var nicks     = []; //could be an object if later we decide to add the nick attributes (+,... @)
    var motd      = "";
    var logBox    = $('#wrapper');
    var statusBar = $('#statusBar');
    var statusMsg = $('#statusmsg');
    var chatBody  = $('#chat_body');
    var nick_ul   = $('#nick_ul');
    var chatForm  = $('#chat-form');
    var joinForm  = $('#join-form');
    var audio     = $('.notification audio').get(0);
    var loginStatus = $('#login-status-text');
    var doNotReconnect = false; //prohibit reconnect to nodester server after a socket disconnect, no retries
    window.counter = 0;
    $('#nick').focus();
    
    var Container = function() {
        var bIrcNoticesEnabled = false; //allow display of "notice" messages during login, default false
        var bAutoScrollEnabled = true; //allow chat page scroll, default true
        var bTonesEnabled = true; //allow tones on pm (yellow) messages, default true
        var opts = {
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
        };

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
        
        this.setTonesEnables = function(enabled) {
            bTonesEnabled = enabled;
        }
        this.getTonesEnabled = function() {
            return bTonesEnabled;
        }
    };
    var c = new Container();

    var scrollBody = function() {
        $("#chat_scroller").animate({ scrollTop: $("#chat_scroller").prop("scrollHeight") }, 100);
    };

    joinForm.on('submit',function(e) {
        e.preventDefault();
        doNotReconnect = false;
        if ($('#nick').val() !== '') {
            $('#wrong').addClass('off');
            $('#login-msg').removeClass('off');
            chatBody.text("");
            if (sock !== null && sock.socket.connected === false) {
                sock.socket.reconnect();
            } else {
                sock = io.connect('http://'+window.location.host);
                sock.on('message', handleMessage);
                sock.on('disconnect', handleDisconnect);
                sock.on('connect', handleConnect);
            };
        } else {
            $('#wrong').removeClass('off');
        }
    });
    
    window.onfocus = function(){
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
            if (regexp.test(message)){
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
        row.html('<th class="author">' + from + '</th>' + '<td class="msg '+row_class+'">' + message + '<span class="time">'+ (new Date()).toTimeString().substr(0,9)+'</td>');
        chatBody.append(row);
        if (c.getAutoScrollEnabled() == true) {
            scrollBody();
        }
    };

    var appendEvent = function (from, event, isSelf) {
        var row = $('<tr/>');
        if (typeof isSelf !== 'undefined' && isSelf === true) {
            row.addClass('me btn btn-info');
        } else {
            row.addClass('btn');
        }
        
        var message = '';
        
        switch (event) {
        case "join":
            message = "<strong>joined the channel</strong>";
            break;
        case "quit":
        case "part":
            message = "<strong>left the channel</strong>";
            break;
        case "endmotd":
            message = motd;
            break;
        case "connected":
            message = "<strong>Welcome to http://irc.nodester.com/</strong>";
            message = message.replace(/(https?:\/\/[-_.a-zA-Z0-9&?\/=\[\]()$!#+:]+)/g, "<a href=\"$1\" target=\"_BLANK\">$1</a>");
            break;
        case "disconnected":
            message = "<strong>You've been disconnected from http://irc.nodester.com/<br />Cross your fingers and refresh your browser!</strong>";
            message = message.replace(/(https?:\/\/[-_.a-zA-Z0-9&?\/=\[\]()$!#+:]+)/g, "<a href=\"$1\" target=\"_BLANK\">$1</a>");
            break;
        default:
            message = "<u>unknown event type oO</u>";
            break;
        }
        
        row.html(
            '<th class="author">' + from + '</th>'
            + '<td class="msg">' + message + '<span class="time">'
            + (new Date()).toTimeString().substr(0,9)+'</td>');
        chatBody.append(row);
        if (c.getAutoScrollEnabled() == true) {
            scrollBody();
        }
    };
  
    var nicksToList = function () {
        var content = "";
        for (var i = 0; i < nicks.length; i++) {
            content += "<li>" + nicks[i] + "</li>";
        }
        nick_ul.html(content);
    };

    var handleMessage = function (data) {
        var obj = JSON.parse(data);
        //window.spinner.stop();
        //statusBar.addClass('off');
        if (obj && obj.messagetype) {
            var isSelf = (obj.from == nickname) ? true : false;
            switch (obj.messagetype) {
                case "433":  //nick already in use
                    window.spinner.stop();
                    sock.disconnect();
                    $('#login-msg').addClass('off');
                    $('#wrong').text("");
                    $('#wrong').removeClass('off');
                    $('#wrong').text(obj.message);   
                    return;
                //notice at login
                case "notice":
                //notice for content    
                case "notice-msg":
                    if (c.getIrcNoticesEnabled() == true) {
                        appendMessage(obj.from, obj.message, false);
                    } else {
                        //redirect to login screen
                        loginStatus.text(obj.message); 
                    }
                    break;
                case "message":
                    appendMessage(obj.from, obj.message, false);
                    break;
                case "topic":
                    appendMessage("Topic", obj.message, false);
                    break;
                case "names":
                    // I tried concat(), it did not work, do not know why, maybe anyone can help?!!!
                    for (var i = 0; i < obj.users.length; i++) {
                        //
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
                    //motd += obj.message + "<br />";
                    //for the time being as it is not used, redirect to login screen
                    loginStatus.text(obj.message);
                    break;
                case "endmotd":
                    //appendEvent(obj.from, obj.messagetype, false);

                    //here we use end of motd to signal web irc login completed
                    c.setIrcNoticesEnabled(true);
                    window.spinner.stop();
                    $('<meta/>', {content: nick, name: 'nick'}).appendTo($('head'));
                    $('#chat_wrapper').removeClass('off');
                    $('#text_input').focus();
                    appendEvent("IRC #nodester", "connected", false);
                    $("#chat_scroller").height($("#nick_list").height()-1);
                    logBox.slideToggle();
                    $("#nickLabel").text(nickname);
                    break;
                case "join":
                    appendEvent(obj.from, obj.messagetype, isSelf);
                    if (isSelf == false) {
                        nicks.push(obj.from);
                        nicks.sort(cisort);
                        nicksToList();
                    }
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
                    break;
                default:
                    alert(data);
                    break;
            };
        } else {
            console.log(data);
        }
    };
    
    var handleConnect = function() {
        //cancel reconnect
        if (doNotReconnect == true) {
            return;
        }
        var nick = window.nick = getNickname($('#nick').val());
        $('#login-msg').text("Joining as " + nick + "...");
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
    var handleDisconnect = function() {
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

    chatForm.on('submit',function(e){
  	e.preventDefault();
        if (textInput.val() !== '') {
            sendMessage();
        } else {
            alert('<p> You need to input a name</p>');
        }
        $('#text_input').focus();
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

    var giveMeColors = function(str) {
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
    var cisort = function(x, y){ 
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
    $(window).resize(function() {
        $("#chat_scroller").height($("#nick_list").height()-1);
    });
    
    var fn = function(obj) {
        c.setAutoScrollEnabled(false);
        if(obj.scrollTop() + obj.height() >= obj.prop("scrollHeight"))
        {
            c.setAutoScrollEnabled(true);
        }
    }

    $("#chat_scroller").on('scroll', function() {
        fn($(this));
    });
    
    $("#btnTones").on('click', function() {
        //will not remember the status yet :), cookies, mmm
        c.setTonesEnables(!c.getTonesEnabled());
        if (c.getTonesEnabled() == true) {
            $("#btnTones").text("Disable tones");
        } else {
            $("#btnTones").text("Enable tones");
        }
    })
    
});
