const Discord = require('discord.js');
const client = new Discord.Client();
const https = require('https');
const cheerio = require('cheerio');

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
			const $ = cheerio.load(body);
			var questsTableHTML = $('#tabber-9effcf7958cd8e73b6b03de0c8c97743');//.getElementsByClassName('tabbertab')[0].getElementsByTagName('table')[0];
			var entries = questsTableHTML.find('tbody').first();//.children('tr').each((i) => console.log("Entry " + i + ": " + $(this).html()));
			var numLoaded = 0;
			entries.children('tr').each((i, elem) => {
				if (i > 0) {
					var qName = $(elem).children('td').eq(0).text().trim().toLowerCase();
					var qDragon = $(elem).children('td').eq(2).text().trim();
					questTable[qName] = qDragon;
					numLoaded++;
				}
			});
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
	if (cmd === '') return;
	else if (cmd === 'quest') {
		if (!questsLoaded) {
			message.channel.send("Quests have not been loaded yet!");
			return;
		}
		var questname = args[0];
		for (i = 1; i < args.length; i++) {
			questname += " " + args[i];
		}
		let dragon = questTable[questname.toLowerCase()];
		if (dragon) message.channel.send("Use a(n) **" + dragon + "** to complete the quest \"" + questname + "\"");
		else message.channel.send("\"" + questname + "\" is not a recognized quest name (did you type it correctly?)");
	} else if (cmd === 'help') {
		const helpMsg = "Command list:(prefix all commands with `" + cmdPrefix + "`)\n"
				+ "`quest <quest name>` - get the correct dragon to send on a quest\n"
				+ "`help` - view this message";
		message.channel.send(helpMsg);
	} else {
		message.channel.send("Unknown command. Type `" + cmdPrefix + "help` for a list of commands");
	}
});

// Comment/uncomment appropriately before committing to git
client.login(process.env.BOT_TOKEN);
//client.login('Nzc1MzgyODQyNjcwMDU1NDI1.X6lhiw.T0cDEvKNISj5VyBuWNpGWwn479s');