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
  
  client.on('message', function(data) {
    console.log(data);
  });

  client.on('disconnect', function() {

  });
});
