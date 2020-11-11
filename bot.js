const Discord = require('discord.js');
const client = new Discord.Client();
const https = require('https');
const cheerio = require('cheerio');

const cmdPrefix = 'd!';

const primaries = ["Plant Dragon", "Fire Dragon", "Earth Dragon", "Cold Dragon", "Lightning Dragon", "Water Dragon", "Air Dragon", "Metal Dragon", "Light Dragon", "Dark Dragon"];
const dragonList = ["Plant Dragon", "Fire Dragon", "Earth Dragon", "Cold Dragon", "Lightning Dragon", "Water Dragon", "Air Dragon", "Metal Dragon", "Light Dragon", "Dark Dragon", "Monolith Dragon", "Snowflake Dragon"];
const questTable = {};
var questsLoaded = false;

client.on('ready', () => {
	console.log('I am ready!');
	
	https.get('https://dragonvale.fandom.com/wiki/Quests', (res) => {
		console.log("Received " + res.statusCode + " status code for quest request");
		var body = [];
		res.on('data', (chunk) => {
			body.push(chunk);
		}).on('end', () => {
			body = Buffer.concat(body).toString();
			const $ = cheerio.load(body);
			var questsTableHTML = $('#tabber-9effcf7958cd8e73b6b03de0c8c97743');
			var entries = questsTableHTML.find('tbody').first();
			var numLoaded = 0;
			entries.children('tr').each((i, elem) => {
				if (i > 0) {
					var qName = $(elem).children('td').eq(0).text().trim().toLowerCase();
					var qDragon = $(elem).children('td').eq(2).text().trim();
					questTable[qName] = qDragon;
					dragonList.push(qDragon);
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
		var questname = prettyString(args, " ");
		if (!questname) {
			message.channel.send("You must give me a quest name to look for!");
			return;
		}
		let dragon = questTable[questname.toLowerCase()];
		if (dragon) message.channel.send("Use a(n) **" + dragon + "** to complete the quest \"" + questname + "\"");
		else message.channel.send("\"" + questname + "\" is not a recognized quest name (did you type it correctly?)");
	} else if (cmd === 'breed') {
		var dragon = prettyString(args, " ");
		if (!dragon) {
			message.channel.send("You must specify a dragon!");
			return;
		}
		if (dragon.indexOf("Dragon") == -1) {
			dragon += " Dragon";
		}
		if (!dragonList.includes(dragon)) {
			message.channel.send("Unrecognized dragon name \"" + dragon + "\" (did you spell it correctly?)");
			return;
		}
		if (isPrimary(dragon)) {
			message.channel.send(dragon + " is a primary dragon, just breed two of them together to get more...");
			return;
		}
		var dragon_ = dragon.replace(/ /g, "_");
		https.get('https://dragonvale.fandom.com/wiki/' + dragon_, (res) => {
			console.log("Received " + res.statusCode + " status code for breeding request");
			var body = [];
			res.on('data', (chunk) => {
				body.push(chunk);
			}).on('end', () => {
				body = Buffer.concat(body).toString();
				const $ = cheerio.load(body);
				response = $("#Breeding").parent().next().text().trim();
				if ($("td[style='border-top-style:hidden;border-left-style:hidden;']").last().text().trim() === "EXPIRED") {
					response += " *Note: This dragon is not available right now (per the wiki)!*";
				}
				message.channel.send(response);	
			});
		});
	} else if (cmd === 'elements') {
		var dragon = prettyString(args, " ");
		if (!dragon) {
			message.channel.send("You must specify a dragon!");
			return;
		}
		if (dragon.indexOf("Dragon") == -1) {
			dragon += " Dragon";
		}
		if (!dragonList.includes(dragon)) {
			message.channel.send("Unrecognized dragon name \"" + dragon + "\" (did you spell it correctly?)");
			return;
		}
		if (isPrimary(dragon)) {
			message.channel.send(dragon + " is a primary dragon, its only element is in its name...");
			return;
		}
		var dragon_ = dragon.replace(/ /g, "_");
		https.get('https://dragonvale.fandom.com/wiki/' + dragon_, (res) => {
			console.log("Received " + res.statusCode + " status code for elements request");
			var body = [];
			res.on('data', (chunk) => {
				body.push(chunk);
			}).on('end', () => {
				body = Buffer.concat(body).toString();
				const $ = cheerio.load(body);
				var elems = [];
				$(".dragonbox").first().find('tr').eq(17).children('td').first().children().each((i, elem) => {
					var imgName = $(elem).children().first().attr('data-image-name');
					if (!imgName.includes("Iconb")) {
						elems.push(imgName.split(" ")[1].replace(".png", ""));
					}
				});
				if (elems.length == 10) {
					message.channel.send(dragon + " adds all 10 elements when breeding (often called a *pseudo*).");
				} else {
					message.channel.send(dragon + " adds the " + prettyString(elems, ", ") + " elements when breeding.");
				}
			});
		});
	} else if (cmd === 'help') {
		const helpMsg = "Command list:(prefix all commands with `" + cmdPrefix + "`)\n"
				+ "`quest <quest name>` - get the correct dragon to send on a quest\n"
				+ "`breed <dragon name>` - find out how to breed a dragon\n"
				+ "`elements <dragon name>` - get the breeding elements (aka hidden elements) of a dragon\n"
				+ "`help` - view this message";
		message.channel.send(helpMsg);
	} else {
		message.channel.send("Unknown command. Type `" + cmdPrefix + "help` for a list of commands");
	}
});

// Comment/uncomment appropriately before committing to git
client.login(process.env.BOT_TOKEN);
//client.login('Nzc1MzgyODQyNjcwMDU1NDI1.X6lhiw.T0cDEvKNISj5VyBuWNpGWwn479s');

prettyString = function(words, separator) {
	if (words.length == 0) return false;
	var result = words[0].toLowerCase();
	result = result.charAt(0).toUpperCase() + result.substring(1);
	for (i = 1; i < words.length; i++) {
		var str = words[i].toLowerCase();
		str = str.charAt(0).toUpperCase() + str.substring(1);
		result += separator + str;
	}
	return result;
}

isPrimary = function(dName) {
	dName = dName.replace(" Rift", "");
	return primaries.includes(dName);
}