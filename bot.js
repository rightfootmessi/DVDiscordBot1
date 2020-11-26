const Discord = require('discord.js');
const client = new Discord.Client();
const https = require('https');
const cheerio = require('cheerio');

const cmdPrefix = 'd!';

const primaries  = ["Plant Dragon", 
					"Fire Dragon", 
					"Earth Dragon", 
					"Cold Dragon", 
					"Lightning Dragon", 
					"Water Dragon", 
					"Air Dragon", 
					"Metal Dragon", 
					"Light Dragon", 
					"Dark Dragon"];
const evolutions = ["Ghostly Plant Dragon", 
					"Ghostly Fire Dragon", 
					"Ghostly Earth Dragon", 
					"Ghostly Cold Dragon", 
					"Corrupticorn Dragon",
					"Wrath Dragon",
					"Porcelain Dragon",
					"Avarice Dragon",
					"Burglehoo Dragon",
					"Gulletail Dragon",
					"Jadice Dragon",
					"Lokilure Dragon",
					"Libretto Dragon",
					"Nibwhip Dragon",
					"Saccharine Dragon",
					"Sugarplum Dragon",
					"Trepak Dragon",
					"Minchi Dragon",
					"Hedera Dragon",
					"Glyph Dragon",
					"Pixie Dragon",
					"Aubergine Dragon",
					"Bloatato Dragon",
					"Curlyleaf Dragon",
					"Karroot Dragon",
					"Vidalia Dragon"];
const noQuest    = ["Wendigo Dragon",
					"Hanno Dragon",
					"Clairvoyant Dragon",
					"Razzle Dragon",
					"Riptide Dragon",
					"Dash Dragon"];
var dragonList   = ["Plant Dragon", 
					"Fire Dragon", 
					"Earth Dragon", 
					"Cold Dragon", 
					"Lightning Dragon", 
					"Water Dragon", 
					"Air Dragon", 
					"Metal Dragon", 
					"Light Dragon", 
					"Dark Dragon", 
					"Ghostly Plant Dragon", 
					"Ghostly Fire Dragon", 
					"Ghostly Earth Dragon", 
					"Ghostly Cold Dragon", 
					"Monolith Dragon", 
					"Snowflake Dragon"];
var questTable = {};
var questsLoaded = false;

var cache = {};
/*
cache: {
	dragonName: {
		breedCombo: string,
		elements: string,
		evolve: string,
		rates: {
			maxBoosts: number,
			non-rift: string array (size = maxBoosts + 1),
			rift: string,
			isEpic: boolean,
			isGemstone: boolean
		},
		timer: string
	},
	// etc.
}
*/

client.on('ready', () => {
	console.log('Oracle is waking up...');
	loadQuests();
});
 
client.on('message', message => {
	if (!message.content.toLowerCase().startsWith(cmdPrefix) || message.author.bot) return;

	const args = message.content.toLowerCase().slice(cmdPrefix.length).trim().split(" ");
	const cmd = args.shift().toLowerCase();

	if (message.channel.type == 'dm' && cmd === 'clearcache') {
		dragonList   = ["Plant Dragon", 
						"Fire Dragon", 
						"Earth Dragon", 
						"Cold Dragon", 
						"Lightning Dragon", 
						"Water Dragon", 
						"Air Dragon", 
						"Metal Dragon", 
						"Light Dragon", 
						"Dark Dragon", 
						"Ghostly Plant Dragon", 
						"Ghostly Fire Dragon", 
						"Ghostly Earth Dragon", 
						"Ghostly Cold Dragon", 
						"Monolith Dragon", 
						"Snowflake Dragon"];
		questTable = {};
		loadQuests();
		cache = {};
		message.author.send("Cache cleared. Information given should now reflect the most recent wiki changes.");
		return;
	}

	if (args.includes("monolith")) {
		message.channel.send("I am currently unable to provide information for Monolith Dragons, but I can link you to their wiki page: https://dragonvale.fandom.com/wiki/Monolith_Dragon");
		return;
	} else if (args.includes("snowflake")) {
		message.channel.send("I am currently unable to provide information for Snowflake Dragons, but I can link you to their wiki page: https://dragonvale.fandom.com/wiki/Snowflake_Dragon");
		return;
	}

	if (cmd === 'quest') {
		if (!questsLoaded) message.channel.send("Quests have not been loaded yet!");
		else {
			var questname = prettyString(args, " ");
			if (!questname) message.channel.send("You must give me a quest name to look for!");
			else {
				let dragon = questTable[questname.toLowerCase()];
				if (dragon) message.channel.send("Use a(n) **" + dragon + "** to complete the quest \"" + questname + "\"");
				else message.channel.send("\"" + questname + "\" is not a recognized quest name (did you type it correctly?)");
			}
		}
	} else if (cmd === 'breed') {
		var dragon = prettyString(args, " ");
		if (!dragon) message.channel.send("You must specify a dragon!");
		else {
			if (dragon.indexOf("Dragon") == -1) dragon += " Dragon";
			if (!dragonList.includes(dragon)) message.channel.send("Unrecognized dragon name \"" + dragon + "\" (did you spell it correctly?)");
			else if (isPrimary(dragon)) message.channel.send(dragon + " is a primary dragon, just breed two of them together to get more...");
			else if (isEvolution(dragon)) message.channel.send(dragon + " is an evolved dragon, you must breed two of them together to get more. To find out how to evolve this dragon, type `d!evolve " + dragon + "`");
			else if (dragon in cache) message.channel.send(cache[dragon]["breedCombo"]);
			else {
				var dragon_ = dragon.replace(/ /g, "_");
				https.get('https://dragonvale.fandom.com/wiki/' + dragon_, (res) => {
					console.log("Received " + res.statusCode + " status code for " + dragon + "'s page");
					var body = [];
					res.on('data', (chunk) => body.push(chunk)).on('end', () => {
						const $ = cheerio.load(Buffer.concat(body).toString());
						readWikiPage(dragon, $);
						message.channel.send(cache[dragon]["breedCombo"]);
					});
				});
			}
		}
	} else if (cmd === 'elements') {
		var dragon = prettyString(args, " ");
		if (!dragon) message.channel.send("You must specify a dragon!");
		else {
			if (dragon.indexOf("Dragon") == -1) dragon += " Dragon";
			if (!dragonList.includes(dragon)) message.channel.send("Unrecognized dragon name \"" + dragon + "\" (did you spell it correctly?)");
			else if (isPrimary(dragon)) message.channel.send(dragon + " is a primary dragon, its only element is in its name...");
			else if (dragon in cache) message.channel.send(cache[dragon]["elements"]);
			else {
				var dragon_ = dragon.replace(/ /g, "_");
				https.get('https://dragonvale.fandom.com/wiki/' + dragon_, (res) => {
					console.log("Received " + res.statusCode + " status code for " + dragon + "'s page");
					var body = [];
					res.on('data', (chunk) => body.push(chunk)).on('end', () => {
						const $ = cheerio.load(Buffer.concat(body).toString());
						readWikiPage(dragon, $);
						message.channel.send(cache[dragon]["elements"]);
					});
				});
			}
		}
	} else if (cmd === 'evolve') {
		var dragon = prettyString(args, " ");
		if (!dragon) message.channel.send("You must specify a dragon!");
		else {
			if (dragon.indexOf("Dragon") == -1) dragon += " Dragon";
			if (!dragonList.includes(dragon)) message.channel.send("Unrecognized dragon name \"" + dragon + "\" (did you spell it correctly?)");
			else if (!isEvolution(dragon)) message.channel.send(dragon + " is not obtained through evolution.");
			else if (dragon in cache) message.channel.send(cache[dragon]["evolve"]);
			else {
				var dragon_ = dragon.replace(/ /g, "_");
				https.get('https://dragonvale.fandom.com/wiki/' + dragon_, (res) => {
					console.log("Received " + res.statusCode + " status code for " + dragon + "'s page");
					var body = [];
					res.on('data', (chunk) => body.push(chunk)).on('end', () => {
						const $ = cheerio.load(Buffer.concat(body).toString());
						readWikiPage(dragon, $);
						message.channel.send(cache[dragon]["evolve"]);
					});
				});
			}
		}
	} else if (cmd === 'rates') {
		var rift = false;
		var boosts = 0;
		var lastArg = args.pop();
		if (lastArg == 'rift') rift = true;
		else if (!isNaN(parseInt(lastArg))) {
			boosts = parseInt(lastArg);
			if (boosts < 0 || !Number.isInteger(boosts)) {
				message.channel.send("The number of boosts must be an integer greater than 0.");
				return;
			}
		} else args.push(lastArg);
		var dragon = prettyString(args, " ");
		if (!dragon) message.channel.send("You must specify a dragon!");
		else {
			if (dragon.indexOf("Dragon") == -1) dragon += " Dragon";
			if (!dragonList.includes(dragon)) message.channel.send("Unrecognized dragon name \"" + dragon + "\" (did you spell it correctly?)");
			else if (dragon in cache) {
				if (!rift) message.channel.send(cache[dragon]["rates"]["non-rift"][Math.min(boosts, cache[dragon]["rates"]["maxBoosts"])]);
				else message.channel.send(cache[dragon]["rates"]["rift"]);
			} else {
				var dragon_ = dragon.replace(/ /g, "_");
				https.get('https://dragonvale.fandom.com/wiki/' + dragon_, (res) => {
					console.log("Received " + res.statusCode + " status code for " + dragon + "'s page");
					var body = [];
					res.on('data', (chunk) => body.push(chunk)).on('end', () => {
						const $ = cheerio.load(Buffer.concat(body).toString());
						readWikiPage(dragon, $);
						if (!rift) message.channel.send(cache[dragon]["rates"]["non-rift"][Math.min(boosts, cache[dragon]["rates"]["maxBoosts"])]);
						else message.channel.send(cache[dragon]["rates"]["rift"]);
					});
				});
			}
		}
	} else if (cmd === 'timer') {
		var dragon = prettyString(args, " ");
		if (!dragon) message.channel.send("You must specify a dragon!");
		else {
			if (dragon.indexOf("Dragon") == -1) dragon += " Dragon";
			if (!dragonList.includes(dragon)) message.channel.send("Unrecognized dragon name \"" + dragon + "\" (did you spell it correctly?)");
			else if (dragon in cache) message.channel.send(cache[dragon]["timer"]);
			else {
				var dragon_ = dragon.replace(/ /g, "_");
				https.get('https://dragonvale.fandom.com/wiki/' + dragon_, (res) => {
					console.log("Received " + res.statusCode + " status code for " + dragon + "'s page");
					var body = [];
					res.on('data', (chunk) => body.push(chunk)).on('end', () => {
						const $ = cheerio.load(Buffer.concat(body).toString());
						readWikiPage(dragon, $);
						message.channel.send(cache[dragon]["timer"]);
					});
				});
			}
		}
	} else if (cmd === 'lodestoned') {
		message.channel.send("", {files: ["https://i.imgur.com/2NBePN9.jpg"]});
	} else if (cmd === '' || cmd === 'help') {
		const helpMsg = "Command list: (prefix all commands with `" + cmdPrefix + "`)\n"
				+ "- `quest <quest name>` - get the correct dragon to send on a quest\n"
				+ "- `breed <dragon name>` - find out how to breed a dragon\n"
				+ "- `elements <dragon name>` - get the breeding elements (aka hidden elements) of a dragon\n"
				+ "- `evolve <dragon name>` - find the evolution requirements for a dragon\n"
				+ "- `rates <dragon name> [number of boosts OR 'rift']` - get the earning rates of a dragon\n"
				+ "- `timer <dragon name>` - get the breeding times of the dragon"
				+ "- `help` - view this message";
		message.channel.send(helpMsg);
	} else {
		message.channel.send("Unknown command. Type `" + cmdPrefix + "help` for a list of commands");
	}
});

// Note to self: if running locally, remember to replace the variable with the secret token itself
client.login(process.env.BOT_TOKEN);

prettyString = function(words, separator) {
	if (words.length == 0) return false;
	var result = words[0].toLowerCase();
	result = result.charAt(0).toUpperCase() + result.substring(1);
	for (i = 1; i < words.length; i++) {
		var str = words[i].toLowerCase();
		str = str.charAt(0).toUpperCase() + str.substring(1);
		result += separator + str;
	}
	result = result.replace(/’/g, "'");
	//result = result.replace("...", "…");
	return result;
}

isPrimary = function(dName) {
	dName = dName.replace(" Rift", "");
	return primaries.includes(dName);
}

isEvolution = function(dName) {
	return evolutions.includes(dName);
}

getSpacing = function(baseLength, int) {
	return Array(baseLength - int.toString().length).fill(" ").join("");
}

isEpic = function(element) {
	return !["Plant", "Fire", "Earth", "Cold", "Lightning", "Water", "Air", "Metal", "Light", "Dark", "Rift"].includes(element);
}

loadQuests = () => {
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
			dragonList = dragonList.concat(noQuest);
		}).on('error', (e) => {
			console.error("An error occurred, quests could not be loaded.\nFull error:\n" + e);
		});
	});
}

/*
cache: {
	dragonName: {
		breedCombo: string,
		elements: string,
		evolve: string,
		rates: {
			maxBoosts: number,
			non-rift: string array (size = maxBoosts + 1),
			rift: string,
			isEpic: boolean,
			isGemstone: boolean
		},
		timer: string
	},
	// etc.
}
*/
readWikiPage = (dragon, $) => {
	// INITIALIZE OBJECT FIELDS
	cache[dragon] = {};
	cache[dragon]["rates"] = {};
	cache[dragon]["rates"]["non-rift"] = [];
	// READ PAGE CONTENTS
	// Breeding combo
	var breedResponse = $("#Breeding").parent().next().text().trim();
	if ($(".dragonbox").first().find('tr').eq(14).children('td').first().text().trim() === "EXPIRED") {
		breedResponse += " *Note: This dragon is not available right now (per the wiki)!*";
	}
	cache[dragon]["breedCombo"] = breedResponse;
	// Elements
	var elems = [];
	$(".dragonbox").first().find('tr').eq(17).children('td').first().children().each((i, elem) => {
		var imgName = $(elem).children().first().attr('data-image-name');
		if (!imgName.includes("Iconb")) {
			elems.push(imgName.split(" ")[1].replace(".png", ""));
		}
	});
	var elemsResponse = (elems.length == 10) ? dragon + " adds all 10 elements when breeding (often called a *pseudo*)." : (elems.length > 0) ? dragon + " adds the " + prettyString(elems, ", ") + " elements when breeding." : "Error: The wiki is missing the breeding elements of the " + dragon;
	cache[dragon]["elements"] = elemsResponse;
	// Evolve
	var curr = $("#Obtaining").parent();
	var evoResult = "";
	var index = 0; // Safeguard to prevent infinite loop (will only happen if the page html is abnormal)
	while (true) {
		curr = curr.next();
		if (curr.children().first().attr('id') === 'Breeding' || curr.children().first().attr('id') === 'Earning_Rates' || index > 10) break;
		else {
			var str = curr.text().trim();
			if (!str.startsWith("It can also be purchased") && !str.startsWith("During") && !str.startsWith("The cost of")) evoResult += str.trim() + " ";
			index++;
		}
	}
	evoResult += "It normally costs 100 gems to evolve a dragon, but during events where the " + dragon + " is available to purchase it may instead cost 1000 event currency."
	cache[dragon]["evolve"] = evoResult;
	// Rates
	var maxBoosts = $(".dragonbox").first().find('tr').eq(9).children().eq(1).find('img').length - 1;

	var firstElemIconName = $(".dragonbox").first().find('tr').eq(8).children('td').first().children().first().children().first().attr('data-image-name');
	var isGemstone = firstElemIconName.includes("Gemstone") || firstElemIconName.includes("Crystalline");
	if (!isGemstone) {
		var isEpicDragon = false;
		$(".dragonbox").first().find('tr').eq(8).children('td').first().children().each((i, elem) => {
			var imgName = $(elem).children().first().attr('data-image-name');
			if (!imgName.includes("Iconb")) {
				var element = imgName.split(" ")[1].replace(".png", "");
				if (isEpic(element)) isEpicDragon = true;
			}
		});
		cache[dragon]["rates"]["isEpic"] = isEpic;

		for (boosts = 0; boosts <= maxBoosts; boosts++) {
			var rates = [];
			var title = $("#Earning_Rates").length ? $("#Earning_Rates") : $("#Earning_Rate");
			title.parent().next().next().children().first().children().eq(1).children().each((i, elem) => {
				rates[i] = Math.ceil(parseInt($(elem).text().trim()) * (1 + 0.3 * boosts));
			});
			title.parent().next().next().children().first().children().eq(3).children().each((i, elem) => {
				rates[i+10] = Math.ceil(parseInt($(elem).text().trim()) * (1 + 0.3 * boosts));
			});
			var table = "```| Lvl : DC/min | Lvl : DC/min |"
					+ "\n|-----:--------|-----:--------|";
			for (i = 0; i < 10; i++) {
				var lvlA = i + 1;
				var lvlB = i + 11;
				result = "\n| " + lvlA + getSpacing(4, lvlA) + ":" + getSpacing(7, rates[i]) + rates[i] + " | " + lvlB + getSpacing(4, lvlB) + ":" + getSpacing(7, rates[i+10]) + rates[i+10] + " |";
				table += result;
			}
			cache[dragon]["rates"]["non-rift"][boosts] = "DragonCash earning rates for " + dragon + " (" + boosts + "/" + maxBoosts + " boosts):\n" + table + "```";
		}
		var rates = [];
		for (i = 0; i < 20; i++) {
			rates[i] = Math.ceil((i+1) * (isEpicDragon ? 1.5 : 1));
		}
		var table = "```| Lvl : Eth/hr | Lvl : Eth/hr |"
				+ "\n|-----:--------|-----:--------|";
		for (i = 0; i < 10; i++) {
			var lvlA = i + 1;
			var lvlB = i + 11;
			result = "\n| " + lvlA + getSpacing(4, lvlA) + ":" + getSpacing(7, rates[i]) + rates[i] + " | " + lvlB + getSpacing(4, lvlB) + ":" + getSpacing(7, rates[i+10]) + rates[i+10] + " |";
			table += result;
		}
		cache[dragon]["rates"]["rift"] = "Etherium earning rates for " + dragon + ":\n" + table + "```";
	} else {
		cache[dragon]["rates"]["isEpic"] = true;
		var rates = [];
		var title = $("#Earning_Rates").length ? $("#Earning_Rates") : $("#Earning_Rate");
		var rows = title.parent().next().next().children();
		rows.children().first().children().each((i, elem) => {
			rates[i] = {"lvls": $(elem).text().trim().replace("Lvl", "").replace("s", "").replace(". ", ""), "rate": rows.children().last().children().eq(i).text().trim()};
		});
		var table = "```| Lvls : Gem Rate |"
				+ "\n|------:----------|";
		for (i = 0; i < 4; i++) {
			result = "\n| " + rates[i]["lvls"] + getSpacing(5, rates[i]["lvls"]) + ":" + getSpacing(9, rates[i]["rate"]) + rates[i]["rate"] + " |";
			table += result;
		}
		cache[dragon]["rates"]["non-rift"][0] = "Gem earning rates for " + dragon + ":\n" + table + "```";
		rates = [];
		for (i = 0; i < 10; i++) {
			rates[i] = Math.ceil((i+1) * 1.5);
		}
		var table = "```| Lvl : Eth/hr | Lvl : Eth/hr |"
				+ "\n|-----:--------|-----:--------|";
		for (i = 0; i < 5; i++) {
			var lvlA = i + 1;
			var lvlB = i + 6;
			result = "\n| " + lvlA + getSpacing(4, lvlA) + ":" + getSpacing(7, rates[i]) + rates[i] + " | " + lvlB + getSpacing(4, lvlB) + ":" + getSpacing(7, rates[i+5]) + rates[i+5] + " |";
			table += result;
		}
		cache[dragon]["rates"]["rift"] = "Etherium earning rates for " + dragon + ":\n" + table + "```";
	}

	cache[dragon]["rates"]["maxBoosts"] = maxBoosts;
	cache[dragon]["isGemstone"] = isGemstone;
	// Timer
	var regTimer = $(".dragonbox").first().find('tr').eq(5).children().last().text().trim();
	var upTimer = $(".dragonbox").first().find('tr').eq(6).children().last().text().trim();
	cache[dragon]["timer"] = "The breeding times of " + dragon + " are **" + regTimer + "** (regular cave) or **" + upTimer + "** (upgraded cave).";
}