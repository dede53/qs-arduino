var dgram					=	require('dgram');
var adapter					=	require('../../adapter-lib.js');
var bodyParser				=	require('body-parser');
var express					=	require('express.oi');
var app						=	express().http().io();
var arduino					=	new adapter("arduino");
var status					=	{};
var timeout					=	"";

process.on("message", function(request){
	var data				= request.data;
	var status				= request.status;
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
				if(status == 1){
					var msg = "sendIr:NEC:" + data.CodeOn + ":32::";
				}else{
					var msg = "sendIr:NEC:" + data.CodeOff + ":32::";
				}
				sendUDP(msg);
				break;
			case "344":
				var msg = "send433:" + status + ":" + data.CodeOn + ":" + data.CodeOff + "::";
				sendUDP(msg);
				break;
			case "pinAnalog":
				var msg = "pinAnalog:" + data.CodeOn + ":" + status + "::";
				sendUDP(msg);
				break;
			case "pinDigital":
				var msg = "pinDigital:" + data.CodeOn + ":" + status + "::";
				sendUDP(msg);
				break;
			case "pilightRaw":
				if(status == 1){
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

arduino.settings.arduinos.forEach(function(arduino){
	status[arduino.id] = new createArduino(arduino);
	status[arduino.id].start();
});

function sendUDP(msg) {
	arduino.settings.arduinos.forEach(function(device){
		var client = dgram.createSocket('udp4');
		client.send(msg, 0, msg.length, device.port, device.ip, function(err, bytes) 
		{
			arduino.log.debug('udp://' + device.ip +':'+ device.port + "/" + msg);
			client.close();
		});
	});
}

app.use(bodyParser.json());									// for parsing application/json
app.use(bodyParser.urlencoded({ extended: true }));			// for parsing application/x-www-form-urlencoded

app.get('/:id/:type/:pin/:value', function(req, res){
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
		process.send({"statusMessage": "Läut auf Port:" + arduino.settings.port});
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
		process.send({longStatusMessage:status});
	}
	this.getStatus = function(){
		return this.status;
	}
	this.setActive = function(timestamp){
		this.arduino.lastActive = timestamp;
	}
	this.checkActive = function(){
		if(this.arduino.lastActive < (new Date().getTime() - 70 * 1000)){
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
		}, 10 * 1000);
	}
	this.stop = function(){
		clearInterval(this.interval);
	}
}