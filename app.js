var express = require('express');
var path = require('path');
var bodyParser = require('body-parser');

var socketApp = express();
var http = require('http').Server(socketApp);
var io = require('socket.io')(http);

var mysql = require('mysql');
var math = require('math');
const mcpadc = require('mcp-spi-adc');
const gpio = require('onoff').Gpio;
const water = new gpio(17, 'out');
const HIGH = 1;
const LOW = 0;
var soilHumid, sql, relayOutput, relayInput;
var mode='AUTO';

socketApp.use(bodyParser.json());
socketApp.use(bodyParser.urlencoded({extended: true}));

const hostname = '192.168.86.210';
const port = 5000;

var connection = mysql.createConnection({
  host		: 'localhost',
  user		: 'aaa',
  password	: '1234',
  database	: 'anchiDB'
});

connection.connect();

const tempSensor = mcpadc.open(0, {speedHz: 20000}, (err) => {
  if (err) throw err;
  
  setInterval(() => {
    
    tempSensor.read((err, reading) => {
      if (err) throw err;
      soilHumid = math.round(1023 - reading.value*1024);
      if(mode=="AUTO"){
        console.log("mode: AUTO");
        if(soilHumid < 200){
          console.log("Soil is too dry. water ON!!");
          water.writeSync(HIGH);
          relayOutput = 'HIGH';
        }else{
          console.log("Soil is wet enough. water OFF!!");
          water.writeSync(LOW);
          relayOutput = 'LOW';
        }
      }else{
        console.log("mode: MANUAL");
        console.log("manual relayInput: "+relayInput);
        if(relayInput=="HIGH"){
          water.writeSync(HIGH); 
          relayOutput = relayInput;
        }else{
          water.writeSync(LOW);
          relayOutput = relayInput;}
      }
      console.log(soilHumid);
      sql = 'INSERT INTO SENSORS(soilHumid, relay) VALUES('+mysql.escape(soilHumid)+', '+mysql.escape(relayOutput)+')';
      connection.query(sql, function(err){
        if(err) throw err;
      });
    });
  }, 1500);
});

socketApp.get('/', function(req,res){
    res.sendFile(path.join(__dirname,'node_modules','views','index2.html'));
});

socketApp.post('/loginpro.do', function(req,res){
    var id = req.body.id;
    var pw = req.body.pw;
    sql = 'SELECT id, name FROM MEMBERS WHERE ID='+mysql.escape(id)+' AND PW='+mysql.escape(pw);
    console.log(id);
    connection.query(sql,function(err, results, fields){
        if(err) throw err;

    });
    res.sendFile(path.join(__dirname,'node_modules','views','main.html'));
});

io.on('connection', function(socket){
  console.log('a user connected');
  socket.on('disconnect', function(){
    console.log('user disconnected');
  });
  socket.on('dataRequest', function(data){
    mode = data.mode;
    relayInput = data.relay;
    console.log('[data from index2.html]mode: ' + mode);
    console.log('[data from index2.html]relay: ' + relayInput);
    socket.emit('sensorData',{soilHumid:soilHumid, relay:relayOutput});
  });

});

http.listen(5000, function(){
  console.log('listening on 5000');
});

