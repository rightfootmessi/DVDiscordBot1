const Discord = require('discord.js');
const client = new Discord.Client();
const https = require('https');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

const cmdPrefix = 'd!';

const questTable = {};
var questsLoaded = false;

client.on('ready', () => {
	console.log('I am ready!');
	
	https.get('https://dragonvale.fandom.com/wiki/Quests', (res) => {
		console.log("Received " + res.statusCode + " status code");
		var body = [];
		res.on('data', (chunk) => {
			body.push(chunk);
		}).on('end', () => {
			body = Buffer.concat(body).toString();
			var htmlDoc = new JSDOM(body).window.document;
			var questsTableHTML = htmlDoc.getElementById('tabber-9effcf7958cd8e73b6b03de0c8c97743').getElementsByClassName('tabbertab')[0].getElementsByTagName('table')[0];
			var entries = questsTableHTML.getElementsByTagName('tbody')[0].getElementsByTagName('tr');
			var numLoaded = 0;
			for (const entry of entries) {
				var boxes = entry.getElementsByTagName('td');
				//console.log(boxes);
				
				var qName = boxes[0].innerText;
				var qDragon = boxes[2].innerText;
				console.log("Name: " + qName + "; Dragon: " + qDragon);
				numLoaded++;
				
			}
			console.log(numLoaded + " quests loaded!");
			questsLoaded = true;
		}).on('error', (e) => {
			console.error("An error occurred, quests could not be loaded.\nStack trace:\n" + e);
		});
	});
});
 
client.on('message', message => {
	if (!message.content.startsWith(cmdPrefix) || message.author.bot) return;

	const args = message.content.slice(cmdPrefix.length).trim().split(" ");
	const cmd = args.shift().toLowerCase();
	if (cmd === 'quest') {
		var questname = args[0];
		for (i = 1; i < args.length; i++) {
			questname += " " + args[i];
		}
		message.channel.send("You are looking for the dragon whose quest is " + questname);
		if (!questsLoaded) message.channel.send("Quests have not been loaded yet!");
	} else {
		message.channel.send("Received unhandled command " + cmd + " with arguments " + args);
	}
});
 
client.login(process.env.BOT_TOKEN);//BOT_TOKEN is the Client Secret
