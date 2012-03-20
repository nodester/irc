/***************************************\
          IRC#nodester client
\***************************************/

/*
 * @name       : irc.js
 * @mainteiner : Alejandro Morales <vamg008@gmail.com>
 * @licence    : GNU Affero
 * @updated    : 17-03-2012
 * @repo       : http://github.com/nodester/irc
 * @version    : 2.0.0
*/

var http    = require('http')
  , fs      = require('fs')
  , io      = require('socket.io')
  , express = require('express')
  , ircjs   = require('irc-js')
  , cfg     = { channel:'#nodester' }
  , app     = express.createServer()
  , io      = require('socket.io').listen(app)
  , _       = require('underscore');

process.on('uncaughtException', function (err) {
  console.log('Uncaught error: ' + err.stack);
});
var allowCORS = function(req,res,next){
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  res.header("Strict-Transport-Security", "max-age=31556926; includeSubDomains");
  res.header("X-Powered-By","nodeJS");
  next();
}
app.configure(function(){
  app.use(express.static(__dirname + '/public'));
  app.use(allowCORS);
});

app.get('/', function(req, res, next){
  res.render('./public/index.html');
});

app.listen(process.env.C9_PORT || process.env['app_port'] || 80);

console.log('IRC#nodester is running on %d',app.address().port)

/*
 * Sockets stuff
*/
io.sockets.on('connection', function (client) {
  var socket = client;
  var irc = null;
  var nickname = null;
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
        console.log(irc)
        irc.connect(function () {
          irc.join(cfg.channel);
        });
        irc.addListener('privmsg', function (message) {
          if (message.params[0] == cfg.channel) {
            client.send(JSON.stringify({
              messagetype: "message",
              from: message.person.nick,
              channel: _.escape(message.params[0]),
              message: _.escape(message.params[1])
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
            from: _.escape(message.person.nick),
            channel: _.escape(message.params[0])
          }));
        });
        irc.addListener('quit', function (message) {
          client.send(JSON.stringify({
            messagetype: "quit",
            from: _.escape(message.person.nick),
            channel: _.escape(message.params[0])
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
