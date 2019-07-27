var dgram					=	require('dgram');
var adapter					=	require('../../adapter-lib.js');
var bodyParser				=	require('body-parser');
var express					=	require('express.oi');
var request				    =	require('request');
var app						=	express().http().io();
var arduino					=	new adapter("arduino");
var status					=	{};
var timeout					=	"";

arduino.on("arduino", function(data){
	if(data.newStatus == "toggle"){
		if(data.status == 1 || data.status == '1'){
			data.newStatus = 0;
		}else{
			data.newStatus = 1;
		}
	}
	if(data){
		switch(data.protocol){
			case "setSetting":
				arduino.setSetting(data);
				break;
			case "saveTemp":
				var msg = "saveTemp::";
				sendUDP(msg);
				break;
			case "ir":
				if(data.newStatus == 1){
					var msg = "sendIr:NEC:" + data.CodeOn + ":32::";
				}else{
					var msg = "sendIr:NEC:" + data.CodeOff + ":32::";
				}
				sendUDP(msg);
				break;
			case "344":
				var msg = "send433:" + data.newStatus + ":" + data.CodeOn + ":" + data.CodeOff + "::";
				sendUDP(msg);
				break;
			case "pinAnalog":
				var msg = "pinAnalog:" + data.CodeOn + ":" + data.newStatus + "::";
				sendUDP(msg);
				break;
			case "pinDigital":
				var msg = "pinDigital:" + data.CodeOn + ":" + data.newStatus + "::";
				sendUDP(msg);
				break;
			case "pilightRaw":
				if(data.newStatus == 1){
					var data = data.CodeOn.split(';');
				}else{
					var data = data.CodeOff.split(';');
				}
				data[0] = data[0].slice(2, data[0].length);
				data[1] = data[1].slice(2, data[1].length - 1);
				var msg = "pilightRaw:" + data[0] + ":" + data[1] + "::";
				sendUDP(msg);
				break;
			default:
				arduino.log.error("Problem mit dem Protocol:" + data.protocol);
				break;
		}
	}
});

arduino.on("action", (data) =>{
	for(var id in arduino.settings.arduinos){
		status[arduino.settings.arduinos[id].id].switchDevice(data);
	}
	// arduino.log.error("Anderer schaltvorgang!");
});

arduino.on("alert", (data) => {
	for(var id in arduino.settings.arduinos){
		arduino.log.info(data);
		status[arduino.settings.arduinos[id].id].setAlert(data);
	}
});

arduino.on("variable", (data) => {
	for(var id in arduino.settings.arduinos){
		arduino.log.info(data);
		status[arduino.settings.arduinos[id].id].setVariable(data);
	}
});

for(var id in arduino.settings.arduinos){
	status[arduino.settings.arduinos[id].id] = new createArduino(arduino.settings.arduinos[id]);
	status[arduino.settings.arduinos[id].id].start();
}

function sendUDP(msg) {
	for(var id in arduino.settings.arduinos){
		status[arduino.settings.arduinos[id].id].sendUDP(msg);
	};
}

app.use(bodyParser.json());									// for parsing application/json
app.use(bodyParser.urlencoded({ extended: true }));			// for parsing application/x-www-form-urlencoded

app.get('/setPin/:id/:type/:pin/:value', function(req, res){
	switch(req.params.type){
		case 'digital':
			if(req.params.value == 0){
				var value = false;
			}else{
				var value = true;
			}
			arduino.setVariable("arduino." + req.params.id + ".digital." + req.params.pin, value);
			break;
		default:
			arduino.setVariable("arduino." + req.params.id + ".analog." + req.params.pin, req.params.value);
			break;
	}
	res.json(200);
});

app.get("/alert/:alert", (req, res) => {
	arduino.log.debug(req.params);
	process.send(req.params);
	res.send(200).end();
});

app.get("/getSettings/:arduinoID", (req, res) => {
	arduino.log.debug("Send settings:" + req.params.arduinoID);
	if(arduino.settings.arduinos[req.params.arduinoID]){
		res.send(arduino.settings.arduinos[req.params.arduinoID]);
	}else{
		res.sendStatus(404);
	}
});

app.get('/switch/:type/:id/:status', function (req, res){
	process.send({action:req.params});
	res.json(200);
});

app.post('/active', function(req, res){
	status[parseInt(req.body.arduinoID)].setActive(new Date().getTime());
	res.sendStatus(200);
});

app.post('/setTemp', function(req, res){
	arduino.setVariable('arduino.' + req.body.arduinoID + '.onewire.' + req.body.id, req.body.status);
});

app.post('/setVariable', function(req, res){
	arduino.setVariable('arduino.' + req.body.arduinoID + '.' + req.body.id, req.body.status);
});

app.post('/setPin', function(req, res){
	switch(req.body.type){
		case 'digital':
			if(req.body.value == 0){
				arduino.setVariable("arduino." + req.body.id + ".digital." + req.body.pin, false);
			}else{
				arduino.setVariable("arduino." + req.body.id + ".digital." + req.body.pin, true);
			}
			break;
		default:
			arduino.setVariable("arduino." + req.body.id + ".analog." + req.body.pin, req.body.value);
			break;
	}
	res.json(req.body);
});

try{
	app.listen(arduino.settings.port, function(){
		process.send({"statusMessage": "Läuft auf Port:" + arduino.settings.port});
	});
}catch(e){
	arduino.log.error(e);
}


function createArduino(settings){
	this.arduino = settings;
	this.setIP = function(ip){
		this.arduino.ip = ip;
	}
	this.setPort = function(port){
		this.arduino.port = port;
	}
	this.setStatus = function(value){
		this.arduino.active = value;
		// console.log(status);
		// process.send({"longStatusMessage":response}); // circular structure to Object error
	}
	this.getStatus = function(){
		return this.status;
	}
	this.setActive = function(timestamp){
		this.arduino.lastActive = timestamp;
	}
	this.checkActive = function(){
		if(this.arduino.lastActive > new Date().getTime() - 70 * 1000){
			if(this.getStatus() != true){
				this.setStatus(true);
			}
		}else{
			if(this.getStatus() != false){
				this.setStatus(false);
			}
		}
	}
	this.start = function(){
		that = this;
		this.interval = setInterval(function(){
			that.checkActive();
		}, 20 * 1000);
	}
	this.stop = function(){
		clearInterval(this.interval);
	}
	this.switchDevice = function(data){
		request.post({
			url: 'http://' + this.arduino.ip + ':'+ this.arduino.port +'/action',
			form: data
		}, (error, response, body) => {
			if(error){
				arduino.log.error("Der status konnte nicht an den Arduino übermittelt werden!");
				arduino.log.error(error);
			}else{
				arduino.log.debug("Status an Arduino("+ this.arduino.ip +") gesendet");
			}
		});
	}
	this.setVariable = function(data){
		request.post({
			url: 'http://' + this.arduino.ip + ':'+ this.arduino.port +'/variable',
			form: data
		}, (error, response, body) => {
			if(error){
				arduino.log.error("Der status konnte nicht an den Arduino übermittelt werden!");
				arduino.log.error(error);
			}else{
				arduino.log.debug("Status an Arduino("+ this.arduino.ip +") gesendet");
			}
		});
	}
	this.setAlert = function(data){
		request.post({
			url: 'http://' + this.arduino.ip + ':'+ this.arduino.port +'/alert',
			form: data
		}, (error, response, body) => {
			if(error){
				arduino.log.error("Der status konnte nicht an den Arduino übermittelt werden!");
				arduino.log.error(error);
			}else{
				arduino.log.debug("Status an Arduino("+ this.arduino.ip +") gesendet");
			}
		});
		// send to arduino
	}
	this.sendUDP = (msg) => {
		var client = dgram.createSocket('udp4');
		client.send(msg, 0, msg.length, this.arduino.port, this.arduino.ip, (err, bytes) => {
			arduino.log.debug('sendUDP://' + this.arduino.ip +':'+ this.arduino.port + "/" + msg);
			client.close();
		});
	};
}