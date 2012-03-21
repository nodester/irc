$(document).ready(function(){
    var sock      = null;
    var rv        = null;
    var nickname  = null;
    var textInput = $('#text_input');
    var nick_lis  = {};
    var logBox    = $('#wrapper');
    var statusBar = $('#statusBar');
    var statusMsg = $('#statusmsg');
    var chatBody  = $('#chat_body');
    var nick_ul   = $('#nick_ul');
    var chatForm  = $('#chat-form');
    window.counter = 0;
    
    $('#nick').focus();
    
    var opts = {
        lines     : 12,
        length    : 7,
        width     : 4,
        radius    : 10,
        color     : '#000',
        speed     : 1,
        trail     : 60,
        shadow    : false,
        hwaccel   : false,
        className : 'spinner',
        zIndex    : 2e9,
        top       : 'auto',
        left      : 'auto'
    };
    
    var scrollBody = function() {
        document.body.scrollTop = document.body.clientHeight;
    };

    $('#join-form').on('submit',function(e){
        e.preventDefault();
        if ($('#nick').val() !== ''){
            window.target = document.getElementById('spiner');
            window.spinner = new Spinner(opts).spin(window.target);
            
            logBox.slideToggle();
            statusBar.removeClass('off').addClass('loader box');
            
            var nick = window.nick = getNickname($('#nick').val());
            $('<meta/>', {content: nick, name: 'nick'}).appendTo($('head'));
            statusMsg.text(' Joining as '+nick+'...' );
            
            sock = io.connect('http://'+window.location.host);
            sock.on('message', handleMessage);
            sock.send(JSON.stringify({ nickname: nick }));
            
            $('#chat_wrapper').removeClass('off');
            $('#text_input').focus();
        } else {
            $('#wrong').removeClass('off');
        }
        return false;
    });
    
    window.onfocus = function(){
        Tinycon.setBubble(0);
        window.counter = 0;
    };
    
    var getNickname = function (name) {
        var name = name || window.nick || 'Guest' + Math.round(Math.random(0,10)*25);
        switch (name) {
        case "":
            alert("You did not input a nickname, please reload if you wish to connect.");
            sock.disconnect();
            return null;
        case null:
            alert("Login cancelled, please reload if you wish to connect.");
            sock.disconnect();
            return null;
        default:
            return name;
        }
    };
    
    var appendMessage = function (from, message, s) {
        var row = $('<tr/>');
        if (typeof s !== 'undefined' && s === true) {
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
        scrollBody();
    };

    var appendEvent = function (from, event, s) {
        var row = $('<tr/>');
        if (typeof s !== 'undefined' && s === true) {
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
            message = "<strong>left the channel</strong>";
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
        scrollBody();
    };
  
  var addNickToList = function (nick) {
    if (!nick_lis.hasOwnProperty(nick)) {
      var li = $('<li value="'+nick+'">'+nick+'<li/>');
      nick_lis[nick] = li;
      nick_ul.append(li);
      sortList(nick_ul);
    }
  };
  
  var delNickFromList = function (nick) {
    if (nick_lis.hasOwnProperty(nick)) {
      nick_ul.removeChild(nick_lis[nick]);
      delete nick_lis[nick];
      sortList(nick_ul);
    }
  };
  var handleMessage = function (data) {
    var obj = JSON.parse(data);
    window.spinner.stop();
    statusBar.addClass('off');
    if (nickname === null) {
      var tmp = getNickname();
      if (tmp !== null) {
        nickname = tmp;
        rv = sock.send(JSON.stringify({ nickname: nickname }));
      }
    } else {
      if (obj && obj.messagetype) {
        var s = (obj.from == nickname) ? true : false;
        switch (obj.messagetype) {
          case "message":
            appendMessage(obj.from, obj.message, false);
            break;
          case "join":
            appendEvent(obj.from, obj.messagetype, s);
            addNickToList(obj.from);
            break;
          case "quit":
            appendEvent(obj.from, obj.messagetype, s);
            delNickFromList(obj.from);
            break;
          default:
            alert(data);
            break;
        }
      } else {
        console.log(data);
      }
    }
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

  var sortList = function (oUl) {
    for(var i in oUl.childNodes) {
      var x = oUl.childNodes[i];
      for(var j in oUl.childNodes) {
        var y = oUl.childNodes[j];
        if((x.innerText != 'undefined' || y.innerText != 'undefined') && x.innerText > y.innerText) {
          if(oUl.firstChild != x)
            oUl.insertBefore(y, x);
        }
      }
    }
  };
  /* Define innerText for Mozilla based browsers */
  if((typeof HTMLElement != 'undefined') && (HTMLElement.prototype.__defineGetter__ != 'undefined')) {
    HTMLElement.prototype.__defineGetter__("innerText", function () {
      var r = this.ownerDocument.createRange();
      r.selectNodeContents(this);
      return r.toString();
    });
  }
  
  /*
  var ocolors = {
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
  };*/
  var colors = {
     'p':['<p>','</p>'],
     '[1m'  :['<strong>','</strong>'],
     '[22m'  :['<strong>','</strong>'],
     '[3m'  :['<i>','</i>'],
     '[23m'  :['<i>','</i>'],
     '[4m'  :['<u>','</u>'],
     '[24m'  :['<u>','</u>'],
     '[7m'  :['<span>','</span>'],
     '[27m'  :['<span>','</span>'],
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
    var old   = str = str || '[44m'+str+'[43m';
        str   = str.split(str.search(/\[[0-9][0-9]m/));
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
  }
});
