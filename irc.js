var http = require('http');
var fs = require('fs');
var io = require('socket.io');
var express = require('express');
var ircjs = require('irc-js');
 var cfg = {
   channel:'#prueba01'
 }
var app = express.createServer(); 
var io = require('socket.io').listen(app)

process.on('uncaughtException', function (err) {
	console.log('Uncaught error: ' + err.stack);
});

app.configure(function(){
//  app.use(express.compiler({ src: __dirname + '/public', enable: ['stylus'] }));
  app.use(express.static(__dirname + '/public'));
});

app.get('/', function(req, res, next){
  res.render('./public/index.html');
});
// app.listen(process.env['app_port'], process.env['app_host']);
app.listen(process.env['app_port'] ||80);


io.sockets.on('connection', function (client) {
  var socket = client;
  socket.emit('news', { hello: 'world' });
  socket.on('my other event', function (data) {
    console.log(data);
  });
  var irc = null;
  var nickname = null;
  client.on('message', function(data) {
    console.log(data)
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
        console.log(irc)
        irc.connect(function () {
          irc.join(cfg.channel);
        });
        irc.addListener('privmsg', function (message) {
          if (message.params[0] == cfg.channel) {
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
              irc.names(cfg.channel, function (chan, names) {
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
          irc.privmsg(cfg.channel, obj.message);
          break;
        default:
          console.log(data);
          break;
      }
    }
  });

  client.on('disconnect', function() {
    if (irc){
      irc.quit(); 
    }
  });
});
