var http = require('http');
var fs = require('fs');
var io = require('socket.io');
var express = require('express');
var ircjs = require('irc-js');
 
var app = express.createServer();

app.configure(function(){
//  app.use(express.compiler({ src: __dirname + '/public', enable: ['stylus'] }));
  app.use(express.staticProvider(__dirname + '/public'));
});

app.get('/', function(req, res, next){
  res.render('./public/index.html');
});
// app.listen(process.env['app_port'], process.env['app_host']);
app.listen(8370, 8370);

var socket = io.listen(app, {
  flashPolicyServer: false,
  transports: ['websocket', 'htmlfile', 'xhr-multipart', 'xhr-polling', 'jsonp-polling']
});

socket.on('connection', function(client) {
  var irc = null;
  var nickname = null;
  client.send(JSON.stringify({connected: true}));
  client.on('message', function(data) {
    var obj = JSON.parse(data);
    if (obj.hasOwnProperty('nickname')) {
      if (irc === null) {
        nickname = obj.nickname;
        irc = new ircjs({
          server: 'irc.freenode.net',
          port: 6667,
          nick: nickname,
          user: {
            username: nickname,
            hostname: 'irc.nodester.com',
            servername: 'irc.freenode.net',
            realname: nickname + ' via http://irc.nodester.com/'
          }
        });
        irc.connect(function () {
          irc.join('#nodester');
        });
        irc.addListener('privmsg', function (message) {
          if (message.params[0] == '#nodester') {
            client.send(JSON.stringify({
              messagetype: "message",
              from: message.person.nick,
              channel: message.params[0],
              message: message.params[1]
            }));
          } else {
            irc.privmsg(message.person.nick, "I can only talk in #nodester.");
          }
        });
        irc.addListener('join', function (message) {
          if (message.person.nick == nickname) {
            setTimeout(function () {
              irc.names("#nodester", function (chan, names) {
                for(var i in names) {
                  client.send(JSON.stringify({
                    messagetype: "join",
                    from: names[i],
                    channel: chan
                  }));
                }
              })
            }, 1500);
          };
          client.send(JSON.stringify({
            messagetype: "join",
            from: message.person.nick,
            channel: message.params[0]
          }));
        });
        irc.addListener('quit', function (message) {
          client.send(JSON.stringify({
            messagetype: "quit",
            from: message.person.nick,
            channel: message.params[0]
          }));
        });

        irc.addListener('error', function () {console.log(arguments)});
      } else {
        // Maybe handle updaing of nicks one day :)
      }
    } else if (obj.hasOwnProperty('messagetype')) {
      switch (obj.messagetype) {
        case "message":
          irc.privmsg("#nodester", obj.message);
          break;
        default:
          console.log(data);
          break;
      }
    }
  });

  client.on('disconnect', function() {
    irc.quit();
  });
});
