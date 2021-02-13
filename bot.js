const Discord = require('discord.js');
const client = new Discord.Client();
const https = require('https');
const cheerio = require('cheerio');
const jsdom = require('jsdom');

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
const enhanced   = ["Armament Dragon",
					"Bastion Dragon",
					"Darcowl Dragon",
					"Dash Dragon",
					"Dazzle Dragon",
					"Eldritch Dragon",
					"Elegant Dragon",
					"Monte Dragon",
					"Outrider Dragon",
					"Psyche Dragon",
					"Quantum Dragon",
					"Razzle Dragon",
					"Riptide Dragon",
					"Ruckus Dragon",
					"Sailback Dragon",
					"Sparkles Dragon",
					"Toco Dragon",
					"Vanguard Dragon",
					"Vibe Dragon"];
const dayNight   = ["Dawnbringer Dragon",
					"Dazzle Dragon",
					"Elegant Dragon",
					"Iden Dragon",
					"Kwall Dragon",
					"Lycan Dragon",
					"Monte Dragon",
					"Moriante Dragon",
					"Nightbloom Dragon",
					"Razzle Dragon",
					"Ruckus Dragon",
					"Sailback Dragon",
					"Snowball Dragon",
					"Sunscorch Dragon",
					"Toco Dragon",
					"Vibe Dragon",
					"Wendigo Dragon"];
const noQuest    = ["Ketu Dragon",
					"Grace Dragon"];
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
		timer: string,
		pictures: {
			options: [normal/day, night, organic, conjured, enhanced, nightEnhanced, charlatan, scourge, barbarous, macabre],
			normal: {
				adult: link,
				juvenile: link,
				baby: link,
			},
			night: {
				adult: link,
				juvenile: link,
				baby: link,
			},
			--etc.,
			egg: link
		}
	},
	// etc.
}
*/
var dvboxCache = {
    normal: {},
    fast: {}
};
/*
dvboxCache: {
    normal: {
        d1|d2: timerList,
        ...
    },
    fast: {
        d1|d2: timerList,
        ...
    }
}
*/

client.on('ready', () => {
	console.log('Oracle is waking up...');
	loadQuests();
});
 
client.on('message', message => {
	if (!message.content.toLowerCase().startsWith(cmdPrefix) || message.author.bot) return;

	const args = message.content.toLowerCase().replace(/\s{2,}/g, ' ').slice(cmdPrefix.length).trim().split(" ");
	const cmd = args.shift().toLowerCase();

	if (!['lodestoned', 'smoulderbrushed', 'smoulderbushed'].includes(cmd)) {
		// (DragonVale server only) prevent non-meme commands from being executed outside #bot-spam
		if (message.channel.type != 'dm' && message.guild.name == 'DragonVale' && message.channel.name != 'bot-spam') return;
	}

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
        dvboxCache = {};
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
			else if (dragon in cache) message.channel.send(cache[dragon]["breedCombo"]).catch(error => {
				message.channel.send("An error occurred and I cannot retrieve the information provided. You may be able to locate it manually on this wiki page: https://dragonvale.fandom.com/wiki/" + dragon_);
			});
			else {
				var dragon_ = dragon.replace(/ /g, "_");
				https.get('https://dragonvale.fandom.com/wiki/' + dragon_, (res) => {
					console.log("Received " + res.statusCode + " status code for " + dragon + "'s page");
					var body = [];
					res.on('data', (chunk) => body.push(chunk)).on('end', () => {
						const $ = cheerio.load(Buffer.concat(body).toString());
						readWikiPage(dragon, $);
						message.channel.send(cache[dragon]["breedCombo"]).catch(error => {
							message.channel.send("An error occurred and I cannot retrieve the information provided. You may be able to locate it manually on this wiki page: https://dragonvale.fandom.com/wiki/" + dragon_);
						});
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
			else if (dragon in cache) message.channel.send(cache[dragon]["elements"]).catch(error => {
				message.channel.send("An error occurred and I cannot retrieve the information provided. You may be able to locate it manually on this wiki page: https://dragonvale.fandom.com/wiki/" + dragon_);
			});
			else {
				var dragon_ = dragon.replace(/ /g, "_");
				https.get('https://dragonvale.fandom.com/wiki/' + dragon_, (res) => {
					console.log("Received " + res.statusCode + " status code for " + dragon + "'s page");
					var body = [];
					res.on('data', (chunk) => body.push(chunk)).on('end', () => {
						const $ = cheerio.load(Buffer.concat(body).toString());
						readWikiPage(dragon, $);
						message.channel.send(cache[dragon]["elements"]).catch(error => {
							message.channel.send("An error occurred and I cannot retrieve the information provided. You may be able to locate it manually on this wiki page: https://dragonvale.fandom.com/wiki/" + dragon_);
						});
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
			else if (dragon in cache) message.channel.send(cache[dragon]["evolve"]).catch(error => {
				message.channel.send("An error occurred and I cannot retrieve the information provided. You may be able to locate it manually on this wiki page: https://dragonvale.fandom.com/wiki/" + dragon_);
			});
			else {
				var dragon_ = dragon.replace(/ /g, "_");
				https.get('https://dragonvale.fandom.com/wiki/' + dragon_, (res) => {
					console.log("Received " + res.statusCode + " status code for " + dragon + "'s page");
					var body = [];
					res.on('data', (chunk) => body.push(chunk)).on('end', () => {
						const $ = cheerio.load(Buffer.concat(body).toString());
						readWikiPage(dragon, $);
						message.channel.send(cache[dragon]["evolve"]).catch(error => {
							message.channel.send("An error occurred and I cannot retrieve the information provided. You may be able to locate it manually on this wiki page: https://dragonvale.fandom.com/wiki/" + dragon_);
						});
					});
				});
			}
		}
	} else if (cmd === 'rates') {
		var rift = false;
		var boosts = 0;
		var age = args.pop();
		if (age == 'rift') rift = true;
		else if (!isNaN(parseInt(age))) {
			boosts = parseInt(age);
			if (boosts < 0 || !Number.isInteger(boosts)) {
				message.channel.send("The number of boosts must be an integer greater than 0.");
				return;
			}
		} else args.push(age);
		var dragon = prettyString(args, " ");
		if (!dragon) message.channel.send("You must specify a dragon!");
		else {
			if (dragon.indexOf("Dragon") == -1) dragon += " Dragon";
			if (!dragonList.includes(dragon)) message.channel.send("Unrecognized dragon name \"" + dragon + "\" (did you spell it correctly?)");
			else if (dragon in cache) {
				if (!rift) message.channel.send(cache[dragon]["rates"]["non-rift"][Math.min(boosts, cache[dragon]["rates"]["maxBoosts"])]).catch(error => {
					message.channel.send("An error occurred and I cannot retrieve the information provided. You may be able to locate it manually on this wiki page: https://dragonvale.fandom.com/wiki/" + dragon_);
				});
				else message.channel.send(cache[dragon]["rates"]["rift"]).catch(error => {
					message.channel.send("An error occurred and I cannot retrieve the information provided. You may be able to locate it manually on this wiki page: https://dragonvale.fandom.com/wiki/" + dragon_);
				});
			} else {
				var dragon_ = dragon.replace(/ /g, "_");
				https.get('https://dragonvale.fandom.com/wiki/' + dragon_, (res) => {
					console.log("Received " + res.statusCode + " status code for " + dragon + "'s page");
					var body = [];
					res.on('data', (chunk) => body.push(chunk)).on('end', () => {
						const $ = cheerio.load(Buffer.concat(body).toString());
						readWikiPage(dragon, $);
						if (!rift) message.channel.send(cache[dragon]["rates"]["non-rift"][Math.min(boosts, cache[dragon]["rates"]["maxBoosts"])]);
						else message.channel.send(cache[dragon]["rates"]["rift"]).catch(error => {
							message.channel.send("An error occurred and I cannot retrieve the information provided. You may be able to locate it manually on this wiki page: https://dragonvale.fandom.com/wiki/" + dragon_);
						});
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
			else if (dragon in cache) message.channel.send(cache[dragon]["timer"]).catch(error => {
				message.channel.send("An error occurred and I cannot retrieve the information provided. You may be able to locate it manually on this wiki page: https://dragonvale.fandom.com/wiki/" + dragon_);
			});
			else {
				var dragon_ = dragon.replace(/ /g, "_");
				https.get('https://dragonvale.fandom.com/wiki/' + dragon_, (res) => {
					console.log("Received " + res.statusCode + " status code for " + dragon + "'s page");
					var body = [];
					res.on('data', (chunk) => body.push(chunk)).on('end', () => {
						const $ = cheerio.load(Buffer.concat(body).toString());
						readWikiPage(dragon, $);
						message.channel.send(cache[dragon]["timer"]).catch(error => {
							message.channel.send("An error occurred and I cannot retrieve the information provided. You may be able to locate it manually on this wiki page: https://dragonvale.fandom.com/wiki/" + dragon_);
						});
					});
				});
			}
		}
	} else if (cmd === 'lodestoned') {
		message.channel.send("", {files: ["https://i.imgur.com/2NBePN9.jpg"]});
	} else if (cmd === 'smoulderbrushed' || cmd === 'smoulderbushed') {
		message.channel.send("I just got a freaking Smoulderbush for the 30 day event gift. Is this a sick joke...? I didn't spend 30 days playing this event for a freaking SMOULDERBUSH DRAGON. I'm so mad this isn't even funny.");
	} else if (cmd === 'sandbox' || cmd === 'dvbox') {
		if (args.length == 0) message.channel.send("The DragonVale Sandbox (or dvbox, for short) can be found at https://dvbox.bin.sh/\n\nNote: dvbox is fanmade. As such, it may not be entirely up-to-date. In addition, the breeding odds are not accurate and should not be trusted.");
		else {
			var beb = false, fast = false, age = args.pop();
			if (age === 'fast') {
				fast = true;
				age = args.pop();
				if (age === 'beb') beb = true;
				else args.push(age);
			} else if (age === 'beb') {
				beb = true;
				age = args.pop();
				if (age === 'fast') fast = true;
				else args.push(age);
			}
			else args.push(age);
			var parents = args.join(" ").split(",");
			if (parents.length != 2) message.channel.send("You must specify 2 dragons for the parents.");
			else {
				var d1 = prettyString(parents[0].trim().split(" "), " ");
				if (d1.indexOf("Dragon") == -1) d1 += " Dragon";
				var d2 = prettyString(parents[1].trim().split(" "), " ");
				if (d2.indexOf("Dragon") == -1) d2 += " Dragon";
				if (!dragonList.includes(d1)) message.channel.send("Unrecognized dragon name \"" + d1 + "\" (did you spell it correctly?)");
				else if (!dragonList.includes(d2)) message.channel.send("Unrecognized dragon name \"" + d2 + "\" (did you spell it correctly?)");
				else {
					var imgLink = "https://dvbox.bin.sh/#";
					imgLink += "d1=" + d1.replace(/ /g, "").replace("Dragon", "").toLowerCase();
					imgLink += ";d2=" + d2.replace(/ /g, "").replace("Dragon", "").toLowerCase();
					if (beb) imgLink += ";beb=1";
					if (fast) imgLink += ";fast=1";
					message.channel.send("See the breeding results of " + d1 + " x " + d2 + " at: " + imgLink);
				}
			}
		}
	} else if (cmd === 'image' || cmd === 'picture' || cmd === 'img' || cmd === 'pic') {
		const qualifiers = ["normal", "day", "night", "organic", "conjured", "enhanced", "nightenhanced", "charlatan", "scourge", "barbarous", "macabre"];
		const ages = ["elder", "adult", "juvenile", "baby", "egg"];
		var qualifier = args.pop();
		if (!qualifiers.includes(qualifier) || args.length == 0) {
			args.push(qualifier);
			qualifier = "normal";
		}
		var age = args.pop();
		if (!ages.includes(age)) {
			args.push(age);
			age = "adult";
		}
		var dragon = prettyString(args, " ");
		if (!dragon) message.channel.send("You must specify a dragon!");
		else {
			if (dragon.indexOf("Dragon") == -1) dragon += " Dragon";
			if (!dragonList.includes(dragon)) message.channel.send("Unrecognized dragon name \"" + dragon + "\" (did you spell it correctly?)");
			else if (dragon in cache) {
				var imgLink;
				if (age == 'egg') imgLink = cache[dragon]["pictures"]["egg"];
				else if (qualifier == 'night') {
					if (!dayNight.includes(dragon)) message.channel.send(dragon + " does not have a night form!");
					else {
						switch (age) {
							case 'elder':
								imgLink = cache[dragon]["pictures"]["night"]["elder"];
								break;
							case 'adult':
								imgLink = cache[dragon]["pictures"]["night"]["adult"];
								break;
							case 'juvenile':
								imgLink = cache[dragon]["pictures"]["night"]["juvenile"];
								break;
							case 'baby':
								imgLink = cache[dragon]["pictures"]["night"]["baby"];
								break;
							default:
								imgLink = cache[dragon]["pictures"]["night"]["adult"];
						}
					}
				} else {
					if (qualifier == 'day' || qualifier == 'normal') {
						switch (age) {
							case 'elder':
								imgLink = cache[dragon]["pictures"]["normal"]["elder"];
								break;
							case 'adult':
								imgLink = cache[dragon]["pictures"]["normal"]["adult"];
								break;
							case 'juvenile':
								imgLink = cache[dragon]["pictures"]["normal"]["juvenile"];
								break;
							case 'baby':
								imgLink = cache[dragon]["pictures"]["normal"]["baby"];
								break;
							default:
								imgLink = cache[dragon]["pictures"]["normal"]["adult"];
						}
					} else {
						if (!cache[dragon]["pictures"][qualifier]) message.channel.send(dragon + " does not have a(n) " + qualifier + " form!\nValid qualifiers: `normal`, `day`, `night`, `organic`/`conjured` (spellforms), `enhanced`/`nightEnhanced` (rave set), `charlatan`/`scourge`/`barbarous`/`macabre` (eldritch)");
						else imgLink = cache[dragon]["pictures"][qualifier];
					}
				}
				message.channel.send(imgLink ? imgLink : "Sorry, I couldn't find the image you were looking for! Here's the wiki page to retrieve it yourself: " + 'https://dragonvale.fandom.com/wiki/' + dragon.replace(/ /g, "_")).catch(error => {
					message.channel.send("An error occurred and I cannot retrieve the information provided. You may be able to locate it manually on this wiki page: https://dragonvale.fandom.com/wiki/" + dragon_);
				});
			} else {
				var dragon_ = dragon.replace(/ /g, "_");
				https.get('https://dragonvale.fandom.com/wiki/' + dragon_, (res) => {
					console.log("Received " + res.statusCode + " status code for " + dragon + "'s page");
					var body = [];
					res.on('data', (chunk) => body.push(chunk)).on('end', () => {
						const $ = cheerio.load(Buffer.concat(body).toString());
						readWikiPage(dragon, $);
						var imgLink;
						if (age == 'egg') imgLink = cache[dragon]["pictures"]["egg"];
						else if (qualifier == 'night') {
							if (!dayNight.includes(dragon)) message.channel.send(dragon + " does not have a night form!");
							else {
								switch (age) {
									case 'elder':
										imgLink = cache[dragon]["pictures"]["night"]["elder"];
										break;
									case 'adult':
										imgLink = cache[dragon]["pictures"]["night"]["adult"];
										break;
									case 'juvenile':
										imgLink = cache[dragon]["pictures"]["night"]["juvenile"];
										break;
									case 'baby':
										imgLink = cache[dragon]["pictures"]["night"]["baby"];
										break;
									default:
										imgLink = cache[dragon]["pictures"]["night"]["adult"];
								}
							}
						} else {
							if (qualifier == 'day' || qualifier == 'normal') {
								switch (age) {
									case 'elder':
										imgLink = cache[dragon]["pictures"]["normal"]["elder"];
										break;
									case 'adult':
										imgLink = cache[dragon]["pictures"]["normal"]["adult"];
										break;
									case 'juvenile':
										imgLink = cache[dragon]["pictures"]["normal"]["juvenile"];
										break;
									case 'baby':
										imgLink = cache[dragon]["pictures"]["normal"]["baby"];
										break;
									default:
										imgLink = cache[dragon]["pictures"]["normal"]["adult"];
								}
							} else {
								if (!cache[dragon]["pictures"][qualifier]) message.channel.send(dragon + " does not have a(n) " + qualifier + " form!\nValid qualifiers: `normal`, `day`, `night`, `organic`/`conjured` (spellforms), `enhanced`/`nightEnhanced` (rave set), `charlatan`/`scourge`/`barbarous`/`macabre` (eldritch)");
								else imgLink = cache[dragon]["pictures"][qualifier];
							}
						}
						message.channel.send(imgLink ? imgLink : "Sorry, I couldn't find the image you were looking for! Here's the wiki page to retrieve it yourself: " + 'https://dragonvale.fandom.com/wiki/' + dragon.replace(/ /g, "_")).catch(error => {
							message.channel.send("An error occurred and I cannot retrieve the information provided. You may be able to locate it manually on this wiki page: https://dragonvale.fandom.com/wiki/" + dragon_);
						});
					});
				});
			}
		}
	} else if (cmd === 'wiki') {
		var dragon = prettyString(args, " ");
		if (!dragon) message.channel.send("You must specify a dragon!");
		else {
			if (dragon.indexOf("Dragon") == -1) dragon += " Dragon";
			if (!dragonList.includes(dragon)) message.channel.send("Unrecognized dragon name \"" + dragon + "\" (did you spell it correctly?)");
			else message.channel.send('https://dragonvale.fandom.com/wiki/' + dragon.replace(/ /g, "_"));
		}
	} else if (cmd === 'result') {
        // d!result <d1>,<d2> <d:hh:mm:ss> [fast]
        var fast = false, last = args.pop();
        if (last === 'fast') fast = true;
        else args.push(last);
        
        var times = args.pop().split(":");
        var days = 0, hrs = 0, mins = 0, secs = 0;
        if (times.length == 3) {
            hrs = parseInt(times[0]);
            mins = parseInt(times[1]);
            secs = parseInt(times[2]);
        } else if (times.length == 4) {
            days = parseInt(times[0]);
            hrs = parseInt(times[1]);
            mins = parseInt(times[2]);
            secs = parseInt(times[3]);
        } else {
            message.channel.send("You have provided the timer in an invalid format. Please write the timer as either `d:hh:mm:ss` or `hh:mm:ss`.");
            return;
        }
        if (days == NaN || hrs == NaN || mins == NaN || secs == NaN) {
            message.channel.send("Your timer could not be parsed. Please write the timer as either `d:hh:mm:ss` or `hh:mm:ss`.");
            return;
        }
        var timer = "";
        if (days > 0  && hrs > 0) {
            timer = days + ":" + (hrs > 10 ? hrs : "0" + hrs) + ":";
        } else if (days > 0) {
            timer = days + ":00:";
        } else if (hrs > 0) {
            timer = hrs + ":";
        }
        timer += (mins > 0 ? (mins > 10 ? mins : "0" + mins) : "00") + ":"
                + (secs > 0 ? (secs > 10 ? secs : "0" + secs) : "00");

        var parents = args.join(" ").split(",");
        if (parents.length != 2) message.channel.send("You must specify 2 dragons for the parents.");
        else {
            var d1 = prettyString(parents[0].trim().split(" "), " ");
            if (d1.indexOf("Dragon") == -1) d1 += " Dragon";
            var d2 = prettyString(parents[1].trim().split(" "), " ");
            if (d2.indexOf("Dragon") == -1) d2 += " Dragon";
            if (!dragonList.includes(d1)) message.channel.send("Unrecognized dragon name \"" + d1 + "\" (did you spell it correctly?)");
            else if (!dragonList.includes(d2)) message.channel.send("Unrecognized dragon name \"" + d2 + "\" (did you spell it correctly?)");
            else {
                if ((d1 + "|" + d2) in dvboxCache[fast ? "fast" : "normal"]) {
                    var timerList = dvboxCache[fast ? "fast" : "normal"][d1 + "|" + d2];
                    var candidates = [];
                    for (const key in timerList) if (timerList[key] == timer) candidates.push(key);
                    if (candidates.length > 0) message.channel.send("A timer of " + timer + " when breeding " + d1 + " x " + d2 + " matches: **" + candidates.join("**, **").replace(/_/g, " ") + "**\nNOTE: Some of the listed dragons may not be available at this time. Check the dragonarium to confirm availability.");
                    else message.channel.send("No matches found for timer " + timer + " when breeding " + d1 + " x " + d2);
                } else {
                    var link = "https://dvbox.bin.sh/#";
                    link += "d1=" + d1.replace(/ /g, "").replace("Dragon", "").toLowerCase();
                    link += ";d2=" + d2.replace(/ /g, "").replace("Dragon", "").toLowerCase();
                    if (fast) link += ";fast=1";
                    link += ";beb=1";
                    message.channel.send("Working, this will take a moment...");
                    console.log("Querying dvbox...")
                    jsdom.JSDOM.fromURL(link, {resources: "usable", runScripts: "dangerously"}).then(dom => {
                        console.log("dvbox queried successfully");
                        dom.window.document.addEventListener('DOMContentLoaded', () => {
                            console.log("Event listener set")
                            setImmediate(() => {
                                console.log("Ready to read results");
                                const $ = cheerio.load(dom.serialize());
                                var timerList = {};
                                var candidates = [];
                                $('#results').children().each((i, elem) => {
                                    timerList[$(elem).attr('id')] = $(elem).contents().filter(function() {return this.nodeType === 3; }).first().text();
                                });
                                for (const key in timerList) {
                                    if (timerList[key].indexOf("%") != -1) delete timerList[key];
                                    else if (timerList[key] == timer) candidates.push(key);
                                }
                                dvboxCache[fast ? "fast" : "normal"][d1 + "|" + d2] = timerList;
                                if (candidates.length > 0) message.channel.send("A timer of " + timer + " when breeding " + d1 + " x " + d2 + " matches: **" + candidates.join("**, **").replace(/_/g, " ") + "**\nNOTE: Some of the listed dragons may not be available at this time. Check the dragonarium to confirm availability.");
                                else message.channel.send("No matches found for timer " + timer + " when breeding " + d1 + " x " + d2);
                            });
                        });
                    });
                }
            }
        }
    } else if (cmd === '' || cmd === 'help') {
		if (message.channel.type != 'dm' && message.guild.name == 'DragonVale' && message.channel.name != 'bot-spam') return;

		const helpMsg = "Command list: (prefix all commands with `" + cmdPrefix + "`)\n"
                + "- `breed <dragon name>` - find out how to breed a dragon\n"
				+ "- `elements <dragon name>` - get the breeding elements (aka hidden elements) of a dragon\n"
				+ "- `evolve <dragon name>` - find the evolution requirements for a dragon\n"
				+ "- `image <dragon> <adult/juvenile/baby/egg> [qualifier]` - get a PNG image of the dragon; defaults to adult if no stage specified; valid qualifiers: `normal`, `day`, `night`, `organic`/`conjured` (spellforms), `enhanced`/`nightEnhanced` (rave set), `charlatan`/`scourge`/`barbarous`/`macabre` (eldritch) (aliases: `picture`, `img`, `pic`)\n"
				+ "- `quest <quest name>` - get the correct dragon to send on a quest\n"
				+ "- `rates <dragon name> [number of boosts OR 'rift']` - get the earning rates of a dragon\n"
                + "- `result <dragon1>,<dragon2> <d:hh:mm:ss|hh:mm:ss> [fast]` - given 2 parent dragons and the resulting timer, find the potential dragons that can result from the breed. **Note: this command takes a _long_ time to process results when one of the parents is a pseudo. If breeding with a pseudo, please use `d!dvbox` and check manually instead!**\n"
				+ "- `sandbox <dragon1>,<dragon2> [beb] [fast]` - open the sandbox for the specified breeding combo (alias: `dvbox`)\n"
				+ "- `timer <dragon name>` - get the breeding times of the dragon\n"
				+ "- `wiki <dragon name>` - get the link to a dragon's wiki page\n"
				+ "- `help` - view this message";
		message.channel.send(helpMsg);
	} else {
		message.channel.send("Unknown command. Type `" + cmdPrefix + "help` for a list of commands");
	}
});

// Note to self: if running locally, remember to replace the variable with the secret token itself; otherwise, make sure it says process.env.BOT_TOKEN !!!
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
		timer: string,
		pictures: {
			options: [normal/day, night, organic, conjured, enhanced, nightEnhanced, charlatan, scourge, barbarous, macabre],
			normal: {
				adult: link,
				juvenile: link,
				baby: link,
			},
			night: {
				adult: link,
				juvenile: link,
				baby: link,
			},
			--etc.,
			egg: link
		}
	},
	// etc.
}
*/
readWikiPage = (dragon, $) => {
	// INITIALIZE OBJECT FIELDS
	cache[dragon] = {};
	cache[dragon]["rates"] = {};
	cache[dragon]["rates"]["non-rift"] = [];
	cache[dragon]["pictures"] = {};
	// READ PAGE CONTENTS
	// Breeding combo
	var breedResponse = $("#Breeding").parent().next().text().trim();
	if ($(".dragonbox").first().find('tr').eq(14).children('td').first().text().trim() === "EXPIRED") {
		breedResponse += " *Note: This dragon is not available right now (per the wiki, which may not be fully up to date - check the Dragonarium to confirm)!*";
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
				let num = Math.ceil(parseInt($(elem).text().trim()) * Math.pow(1.3, boosts));
				rates[i] = (num < 1500) ? num : "~1500";
			});
			title.parent().next().next().children().first().children().eq(3).children().each((i, elem) => {
				let num = Math.ceil(parseInt($(elem).text().trim()) * Math.pow(1.3, boosts));
				rates[i+10] = (num < 1500) ? num : "~1500";
			});
			var table = "```| Lvl : DC/min | Lvl : DC/min |"
					+ "\n|-----:--------|-----:--------|";
			for (i = 0; i < 10; i++) {
				var lvlA = i + 1;
				var lvlB = i + 11;
				result = "\n| " + lvlA + getSpacing(4, lvlA) + ":" + getSpacing(7, rates[i]) + rates[i] + " | " + lvlB + getSpacing(4, lvlB) + ":" + getSpacing(7, rates[i+10]) + rates[i+10] + " |";
				table += result;
			}
			cache[dragon]["rates"]["non-rift"][boosts] = "DragonCash earning rates for " + dragon + " (" + boosts + "/" + maxBoosts + " boosts):\n" + table + "```"
					+ (boosts > 0 ? "\nNOTE: Your dragon's profile will likely show a lower number than what's in this table. That number is wrong (this has been experimentally proven). The numbers here are the *actual* earning rates." : "");
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
			if (rates[i]["lvls"].endsWith("10") && rates[i]["lvls"].includes("??")) rates[i]["lvls"] = rates[i]["lvls"].substring(2);
		});
		var table = "```| Lvls : Gem Rate |"
				+ "\n|------:----------|";
		for (i = 0; i < rates.length; i++) {
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
	// Pictures
	const dragonNoSpace = dragon.replace(/ /g, '');
	cache[dragon]["pictures"]["normal"] = {};
	cache[dragon]["pictures"]["normal"]["adult"] = $("[alt='" + dragonNoSpace + "Adult.png']").first().attr('src');
	cache[dragon]["pictures"]["normal"]["juvenile"] = $("[alt='" + dragonNoSpace + "Juvenile.png']").first().attr('src');
	cache[dragon]["pictures"]["normal"]["baby"] = $("[alt='" + dragonNoSpace + "Baby.png']").first().attr('src');
	cache[dragon]["pictures"]["egg"] = $("[alt='" + dragonNoSpace + "Egg.png']").first().attr('data-src');
	if (isPrimary(dragon)) cache[dragon]["pictures"]["normal"]["elder"] = $("[alt='" + dragonNoSpace + "Elder.png']").first().attr('src');
	if (enhanced.includes(dragon)) {
		if (dragon == "Eldritch Dragon") {
			cache[dragon]["pictures"]["barbarous"] = $("[alt='EldritchDragonAdultBarbarous.png']").first().attr('data-src');
			cache[dragon]["pictures"]["charlatan"] = $("[alt='EldritchDragonAdultCharlatan.png']").first().attr('data-src');
			cache[dragon]["pictures"]["macabre"] = $("[alt='EldritchDragonAdultMacabre.png']").first().attr('data-src');
			cache[dragon]["pictures"]["scourge"] = $("[alt='EldritchDragonAdultScourge.png']").first().attr('data-src');
		} else if (dayNight.includes(dragon)) {
			cache[dragon]["pictures"]["enhanced"] = $("[alt='" + dragonNoSpace + "AdultEnhanced.png']").first().attr('data-src');
			cache[dragon]["pictures"]["nightenhanced"] = $("[alt='" + dragonNoSpace + "AdultNightEnhanced.png']").first().attr('data-src');
		} else {
			cache[dragon]["pictures"]["organic"] = $("[alt='" + dragonNoSpace + "AdultOrganic.png']").first().attr('data-src');
			cache[dragon]["pictures"]["conjured"] = $("[alt='" + dragonNoSpace + "AdultConjured.png']").first().attr('data-src');
		}
	}
	if (dayNight.includes(dragon)) {
		cache[dragon]["pictures"]["night"] = {};
		if (dragon == "Lycan Dragon") {
			cache[dragon]["pictures"]["night"]["adult"] = $("[alt='LycanDragonAdultFullMoon.png']").first().attr('data-src');
			cache[dragon]["pictures"]["night"]["juvenile"] = $("[alt='LycanDragonJuvenileFullMoon.png']").first().attr('data-src');
			cache[dragon]["pictures"]["night"]["baby"] = $("[alt='LycanDragonBabyFullMoon.png']").first().attr('data-src');
		} else {
			cache[dragon]["pictures"]["night"]["adult"] = $("[alt='" + dragonNoSpace + "AdultNight.png']").first().attr('data-src');
			cache[dragon]["pictures"]["night"]["juvenile"] = $("[alt='" + dragonNoSpace + "JuvenileNight.png']").first().attr('data-src');
			cache[dragon]["pictures"]["night"]["baby"] = $("[alt='" + dragonNoSpace + "BabyNight.png']").first().attr('data-src');
		}
	}
}