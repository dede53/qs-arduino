var dgram       	= require('dgram');
var adapter 		= require('../../adapter-lib.js');
var arduino 		= new adapter({
	"name":"Arduino",
	"loglevel":3,
	"description": "sendet Befahle an den einen Arduino",
	"settingsFile": "arduino.json",
	"cron": ""
});

process.on('message', function(data){
	var status = data.status;
	var data = data.data;
	if(data.protocol.includes(":")){
		data.protocol = data.protocol.split(":");
	}else{
		data.protocol = [data.protocol];
	}
	switch(data.protocol[1]){
		case "ir":
			if(status == 1){
				var msg = "sendIr:NEC:" + data.CodeOn + ":32::";
			}else{
				var msg = "sendIr:NEC:" + data.CodeOff + ":32::";
			}
			break;
		case "344":
			var msg = "send433:" + status + ":" + data.CodeOn + ":" + data.CodeOff + "::";
			break;
	}
	sendUDP(msg);
});

function sendUDP(msg) {
	// var device = arduino.settings.arduinos[device.id];
	// var client = dgram.createSocket('udp4'); // Neuen Socket zum Client aufbauen
	// client.send(msg, 0, msg.length, device.port, device.ip, function(err, bytes) 
	// {
	// 	arduino.log.debug('udp://' + device.ip +':'+ device.port + "/" + msg); // Ausgabe der Nachricht
	// 	client.close(); // Bei erfolgreichen Senden, die Verbindung zum CLient schließen
	// });
	arduino.settings.arduinos.forEach(function(device){
		// dgram Klasse für UDP-Verbindungen
		var client = dgram.createSocket('udp4'); // Neuen Socket zum Client aufbauen
		client.send(msg, 0, msg.length, device.port, device.ip, function(err, bytes) 
		{
			arduino.log.debug('udp://' + device.ip +':'+ device.port + "/" + msg); // Ausgabe der Nachricht
			client.close(); // Bei erfolgreichen Senden, die Verbindung zum CLient schließen
		});
	});
}