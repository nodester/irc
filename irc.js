var http = require('http');
var fs = require('fs');
var io = require('socket.io');
var express = require('express');
var ircjs = require('irc-js');

var app = express.createServer();

app.configure(function(){
  app.use(express.staticProvider(__dirname + '/public'));
});

app.get('/', function(req, res, next){
  res.render('./public/index.html');
});
app.listen(process.ENV['app_port'], process.ENV['app_host']);

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
          server: 'holmes.freenode.net',
          port: 6667,
          nick: obj.nickname,
          user: {
            username: nickname,
            hostname: 'irc.bejes.us',
            servername: 'holmes.freenode.net',
            realname: nickname + ' via http://irc.bejes.us/'
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
