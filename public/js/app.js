$(document).ready(function(){
  var sock = null;
  var rv = null;
  var nickname = null;
  var chatBody = null;
  var textInput = $('#text_input');
  var nick_ul = null;
  var nick_lis = {};
  var logBox = $('#wrapper');
  var statusBar = $('#statusBar');
  var statusMsg = $('#statusmsg')
  var sendMsg = $('#sendMessage')
  var chatBody  = $('#chat_body');
  var nick_ul   = $('#nick_ul');
  var get = function(el){
    return document.getElementById(el);
  }
  var opts = {
    lines: 12,
    length: 7,
    width: 4,
    radius: 10,
    color: '#000',
    speed: 1,
    trail: 60,
    shadow: false,
    hwaccel: false,
    className: 'spinner',
    zIndex: 2e9,
    top: 'auto',
    left: 'auto'
  };

  get('join').addEventListener('click',function(e){
    window.target = document.getElementById('spiner');
    window.spinner = new Spinner(opts).spin(target);
    logBox.slideToggle();
    statusBar.removeClass('off')
    statusBar.addClass('loader box')
    var nick = getNickname(get('nick').value);
    var meta = document.createElement('meta');
    meta.content = nick; 
    meta.name = 'nick';
    var head = document.getElementsByTagName('head')[0];
    head.appendChild(meta);
    statusMsg.text(' Joining as '+nick+'...' )
    sock = io.connect('http://numbus/');
    sock.on('message', handleMessage);
    sock.send(JSON.stringify({ nickname: nick }));
    $('#chat_wrapper').removeClass('off');
  });

  window.getNickname = function (name) {
    var name = name || $('[name="nick"]').attr('content') || 'Guest' + parseInt(Math.random(0,10)*15);
    switch (name) {
      case "":
        alert("You did not input a nickname, please reload if you wish to connect.");
        sock.disconnect();
        return null;
        break;
      case null:
        alert("Login cancelled, please reload if you wish to connect.");
        sock.disconnect();
        return null;
        break;
      default:
        return name;
        break;
    }
  };
  window.appendMessage = function (from, message, s) {
    var row = document.createElement('tr');
    if (typeof s != 'undefined' && s == true) {
      row.className = 'me btn btn-info';
    } else {
      row.className = 'btn'
    }
    row.innerHTML = ''
        + '<th class="author">' + from + '</th>'
        + '<td class="msg">' + message.replace(/\[[0-9][0-9]m/g,'') +'<span class="time">'+ (new Date()).toTimeString().substr(0,9)+'</td>';
    chatBody.append(row);
    scrollBody();
  };
  window.appendEvent = function (from, event, s) {
    var row = document.createElement('tr');
    if (typeof s != 'undefined' && s == true) {
      row.className = 'me btn btn-info';
    } else {
      row.className = 'btn '
    }
    switch (event) {
      case "join":
        var message = "<strong>joined the channel</strong>";
        break;
      case "quit":
        var message = "<strong>left the channel</strong>";
        break;
      default:
        var message = "<u>unknown event type oO</u>";
        break;
    }
    row.innerHTML = ''
        + '<th class="author">' + from + '</th>'
        + '<td class="msg">' + message + '<span class="time">'+ (new Date()).toTimeString().substr(0,9)+'</td>';
    chatBody.append(row);
    scrollBody();
  };
  window.addNickToList = function (nick) {
    if (!nick_lis.hasOwnProperty(nick)) {
      var li = document.createElement('li');
      li.value = nick;
      li.textContent = nick;
      nick_lis[nick] = li;
      nick_ul.append(li);
      sortList(nick_ul);
    }
  };
  window.delNickFromList = function (nick) {
    if (nick_lis.hasOwnProperty(nick)) {
      nick_ul.removeChild(nick_lis[nick]);
      delete nick_lis[nick];
      sortList(nick_ul);
    }
  };
  window.handleMessage = function (data) {
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
      console.log(typeof obj, typeof data)
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
  window.sendMessage = function () {
    appendMessage(nickname, textInput.val(), true);
    sock.send(JSON.stringify({
      messagetype: "message",
      message: textInput.val()
    }));
    textInput.val('');
  };
  sendMsg.on('click',function(e){
    if (textInput.val() !== '') {
      sendMessage();
    }
  });
  window.scrollBody = function() {
    document.body.scrollTop = document.body.clientHeight;
  };
  var sortList = function (oUl) {
    for(var i in oUl.childNodes) {
      var x = oUl.childNodes[i];
      for(var j in oUl.childNodes) {
        var y = oUl.childNodes[j];
        if((x.innerText != 'undefined' || y.innerText != 'undefined') 
          && x.innerText > y.innerText) {
          if(oUl.firstChild != x)
            oUl.insertBefore(y, x);
        }
      }
    }
  }
  /* Define innerText for Mozilla based browsers */
  if((typeof HTMLElement != 'undefined') && (HTMLElement.prototype.__defineGetter__ != 'undefined')) {
    HTMLElement.prototype.__defineGetter__("innerText", function () {
      var r = this.ownerDocument.createRange();
      r.selectNodeContents(this);
      return r.toString();
    });
  }

});