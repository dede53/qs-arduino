var dgram					=	require('dgram');
var adapter					=	require('../../adapter-lib.js');
var bodyParser				=	require('body-parser');
var express					=	require('express.io');
var app						=	express().http().io();
var arduino					=	new adapter("arduino");
var timeout					=	"";
// console.log(JSON.parse(arduino.settings));
process.on("message", function(data){
	if(data.settings){
		arduino.settings = data.settings;
	}
	arduino.log.info(data);
	if(data.data){
		arduino.log.debug(data.data.protocol);
		switch(data.data.protocol){
			case "setSetting":
				arduino.setSetting(data.data);
				break;
			case "ir":
				if(data.status == 1){
					var msg = "sendIr:NEC:" + data.data.CodeOn + ":32::";
				}else{
					var msg = "sendIr:NEC:" + data.data.CodeOff + ":32::";
				}
				sendUDP(msg);
				break;
			case "344":
				var msg = "send433:" + data.status + ":" + data.data.CodeOn + ":" + data.data.CodeOff + "::";
				sendUDP(msg);
				break;
			case "pinAnalog":
				var msg = "pinAnalog:" + data.data.CodeOn + ":" + data.status + "::";
				sendUDP(msg);
				break;
			case "pinDigital":
				var msg = "pinDigital:" + data.data.CodeOn + ":" + data.status + "::";
				sendUDP(msg);
				break;
			default:
				arduino.log.error("Problem mit dem Protocol:" + data.protocol);
				break;
		}
	}
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
				arduino.setVariable("arduino." + req.params.id + ".digital." + req.params.pin, false);
			}else{
				arduino.setVariable("arduino." + req.params.id + ".digital." + req.params.pin, true);
			}
			break;
		default:
			arduino.setVariable("arduino." + req.params.id + ".analog." + req.params.pin, req.params.value);
			break;
	}
	timeout = new Date().getTime();
	res.json(200);
});


app.post('/setPin', function(req, res){
	// console.log("Neue Daten vom Arduino!");
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
	timeout = new Date().getTime();
	res.json(req.body);
});

setInterval(function(){
	if(timeout < (new Date().getTime() - 5 * 1000)){
		process.send({statusMessage:"nicht verbunden!"});
	}else{
		process.send({statusMessage:"Verbunden"});
	}
}, 10 * 1000);

try{
	app.listen(arduino.settings.port);
}catch(e){
	arduino.log.error(e);
}
