const Discord = require('discord.js');
const client = new Discord.Client();
const https = require('https');
const cheerio = require('cheerio');
const { Worker } = require('worker_threads');
const fs = require('fs');
const sprintf = require('sprintf-js').sprintf;

const cmdPrefix = 'd!';

const helpMsg = `Command list (prefix all commands with \`${cmdPrefix}\`):\n`
                + "- `breed <dragon>` - find out how to breed a dragon\n"
				+ "- `elements <dragon>` - get the breeding elements (aka hidden elements) of a dragon\n"
				+ "- `evolve <dragon>` - find the evolution requirements for a dragon\n"
                + "- `feed [initial level] <final level> [rift]` - find the number of treats needed to feed a dragon from the initial level (defaults to 1 if not specified) to the final level\n"
                + "- `guide [guide]` - retrieves a guide, or lists all available guides if none specified (alias: `guides`)\n"
				+ "- `image <dragon> <adult|juvenile|baby|egg> [qualifier]` - get a PNG image of the dragon; defaults to adult if no stage specified; valid qualifiers can be listed using `d!image flags`  (aliases: `picture`, `img`, `pic`)\n"
				+ "- `quest <quest>` - get the correct dragon to send on a quest\n"
				+ "- `rates <dragon> [# of boosts OR 'rift']` - get the earning rates of a dragon\n"
                + "- `result <dragon1>,<dragon2> <d:hh:mm:ss|hh:mm:ss> [fast|runic]` - given 2 parent dragons and the resulting timer, find the potential dragons that can result from the breed. (aliases: `results`, `fakeouts`)\n"
				+ "- `sandbox <dragon1>,<dragon2> [beb] [fast]` - open the sandbox for the specified breeding combo (alias: `dvbox`)\n"
				+ "- `timer <dragon name>` - get the breeding times of the dragon\n"
                + "- `uses <dragon name>` - get all dragons that include the specified dragon in its breeding combination\n"
				+ "- `wiki <dragon name OR item>` - get the link to a dragon's wiki page, or displays the wiki's search results if the argument is another item\n"
				+ "- `help` - view this message";

const riftFeeding = [2500, 6000, 9000, 12000, 20000, 30000, 45000, 70000, 100000, 150000, 250000, 350000, 500000, 800000, 1200000, 1800000, 3000000, 4000000, 6250000, 12500000];

var primaries, evolutions, enhanced, dayNight, hiding, elders, dragonList, newDrags, fullData;
var questTable = {};
var guides = {};
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
        uses: string,
		pictures: {
			options: [normal/day, night, organic, conjured, enhanced, nightEnhanced, charlatan, scourge, barbarous, macabre, hiding, summer, winter, autumn, spring],
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

let worker = new Worker('./dvboxreader.js');

client.on('ready', () => {
	console.log('Oracle is waking up...');
    let data = JSON.parse(fs.readFileSync('dragonList.json'));
    fullData = data;
    primaries = data.primaries;
    evolutions = data.evolutions;
    enhanced = data.enhanced;
    dayNight = data.dayNight;
    hiding = data.hiding;
    elders = data.elders;
    dragonList = data.dragonList;
    newDrags = data.newDrags;
	loadQuests();
    readMonolithWikiPage();
    readSnowflakeWikiPage();
    guides = JSON.parse(fs.readFileSync('guides.json'));
});


function sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
}

var petCooldown = 0;
 
client.on('message', async (message) => {
    try {
        if (!message.content.toLowerCase().startsWith(cmdPrefix) || message.author.bot) return;

        var args = message.content.replace(/\s{2,}/g, ' ').replace(/@/g, '').slice(cmdPrefix.length).trim().split(" ");
        const cmd = args.shift().toLowerCase();

        // BEGIN APRIL FOOLS CODE (UNCOMMENT IT ON APRIL 1ST, then reduce odds to 0.01 afterward)
        
        if (Math.random() < 0.01 && !['lodestoned', 'smoulderbrushed', 'smoulderbushed', 'pet', 'mod', 'help', 'random'].includes(cmd)) {
            let funnyGifs = [
                'https://media.discordapp.net/attachments/626181797696503818/808742119874625598/minilodestonedpost.gif',
                'https://cdn.discordapp.com/attachments/559733837643382794/791547901884891176/magik.gif',
                'https://media.discordapp.net/attachments/626182840517918760/790679132472082505/16085829679271248247819423568955.gif',
                'https://media.discordapp.net/attachments/626181797696503818/756238462058758154/PartyDragon4.gif',
                'https://media.discordapp.net/attachments/626181797696503818/856995787661639730/image0.gif',
                'https://cdn.discordapp.com/attachments/818011940160405534/958918376837767188/jammyjam.gif',
                'https://cdn.discordapp.com/attachments/818011940160405534/958926545966231602/image0.gif',
                'https://cdn.discordapp.com/attachments/818011940160405534/958941916173594634/ezgif-5-fa360ca119.gif'
            ];
            message.channel.send(funnyGifs[Math.floor(Math.random() * funnyGifs.length)]);
            await sleep(3000);
            let emote = ['<:dv_owobowos:803676880850780160>', '<:dv_ikastarko:870846746190831677>', '<:dv_loveheart:722966875952382002>'][Math.floor(Math.random() * 3)];
            message.channel.send(`Just kidding! Sorry about that friend ${emote}`);
            await sleep(500);
        }

        // END APRIL FOOLS CODE

        if (cmd === 'msg' && message.member.id == "295625585299030016") {
            if (args[0] == 'print') {
                console.log(JSON.stringify(cache, null, 4));
                return;
            }
            let serverId = args.shift();
            serverId = (serverId.toLowerCase() == 'dv') ? '233370210617262080' : serverId;
            let server = client.guilds.cache.get(serverId);
            if (server) {
                let cName = args.shift(); console.log(cName);
                let channel = server.channels.cache.find(c => c.name.toLowerCase() === cName);
                if (channel) {
                    channel.send(args.join(" "));
                } else message.channel.send(`Channel ${cName} not found in server ${server.name}`);
            } else message.channel.send("Server not found");
            return;
        } else for (i in args) args[i] = args[i].toLowerCase();

        if (!['lodestoned', 'smoulderbrushed', 'smoulderbushed', 'pet', 'mod', 'aurora', 'random'].includes(cmd)) {
            // (DragonVale server only) prevent non-meme commands from being executed outside #bot-commands
            if (message.channel.type != 'dm' && message.guild.name == 'DragonVale' && (message.channel.id != 626182769256693770 && message.channel.id != 818011940160405534) && message.channel.id != 276384829593878529) return; // bot-commands, oracle-test, mod-chat
        }

        if (args.includes("monolith") && !(cmd === 'result' || cmd === 'results' || cmd === 'fakeouts') && !(cmd === 'sandbox' || cmd === 'dvbox')) {
            if (isNaN(args[args.indexOf("monolith") + 1])) {
                message.channel.send("Your query contains a monolith dragon, but you did not specify which. Please re-enter the query using `Monolith #`, where `#` is replaced by the number of the monolith dragon.");
                return;
            }
        } else if (args.includes("snowflake") && !(cmd === 'result' || cmd === 'results' || cmd === 'fakeouts') && !(cmd === 'sandbox' || cmd === 'dvbox')) {
            if (isNaN(args[args.indexOf("snowflake") + 1])) {
                message.channel.send("Your query contains a snowflake dragon, but you did not specify which. Please re-enter the query using `Snowflake #`, where `#` is replaced by the number of the snowflake dragon.");
                return;
            }
        }

        if (cmd === 'pet') {
            pet = function() {            
                let rand = Math.random();
                message.channel.send(rand < 0.79 ? "thank <:dv_ikastarko:870846746190831677>" : rand < 0.94 ? "no u <:dv_epochnou:794321854042734602>" : rand < 0.99 ? "fite me <:dv_ikatastrophe:870846763173552158>" : "you thought it was oracle but it was me, ~~dio~~ lodestone! <:dv_lodestoned:894608674390167612>");
                if (rand >= 0.99) {
                    message.guild.channels.cache.get('626180297993748499').send(`${message.member.displayName} tried to pet Oracle, but got lodestoned.`);
                }
            }

            if (Date.now() > petCooldown) {
                pet();
                petCooldown = Date.now() + 10000;
            } else if (hasModAccess(message)) {
                pet();
            } else {
                message.delete();
            }
            return;
        }

        if (cmd === 'quest') {
            if (!questsLoaded) message.channel.send("Quests have not been loaded yet!");
            else {
                var questname = prettyString(args, " ");
                if (!questname) message.channel.send("You must give me a quest name to look for!");
                else {
                    let dragon = questTable[questname.toLowerCase()];
                    if (dragon) message.channel.send(`Use a(n) **${dragon}** to complete the quest "${questname}"`);
                    else message.channel.send(`"${questname}" is not a recognized quest name (did you type it correctly?)`);
                }
            }
        } else if (cmd === 'breed') {
            var dragon = prettyString(args, " ");
            if (!dragon) message.channel.send("You must specify a dragon!");
            else {
                if (dragon.indexOf("Dragon") == -1) dragon += " Dragon";
                if (!dragonList.includes(dragon)) message.channel.send(`Unrecognized dragon name "${dragon}" (did you spell it correctly?)`);
                else if (isNew(dragon)) message.channel.send(`${dragon} is a new release, and thus it has an incomplete wiki page; I unfortunately cannot give you information about it at this time. Try again later, or check out <#738831348915241051> in the meantime.`);
                else if (isPrimary(dragon)) message.channel.send(`${dragon} is a primary dragon, just breed two of them together to get more...`);
                else if (isEvolution(dragon)) message.channel.send(`${dragon} is an evolved dragon, you must breed two of them together to get more. To find out how to evolve this dragon, type \`d!evolve ${dragon}\``);
                else {
                    questMsg = () => message.channel.send(cache[dragon]["breedCombo"]).catch(error => {
                        message.channel.send("An error occurred and I cannot retrieve the information provided. You may be able to locate it manually on this wiki page: https://dragonvale.fandom.com/wiki/" + dragon_);
                    });

                    if (dragon in cache) questMsg();
                    else fetchFromWiki(dragon, message, questMsg);
                }
            }
        } else if (cmd === 'elements') {
            var dragon = prettyString(args, " ");
            if (!dragon) message.channel.send("You must specify a dragon!");
            else {
                if (dragon.indexOf("Dragon") == -1) dragon += " Dragon";
                if (!dragonList.includes(dragon)) message.channel.send(`Unrecognized dragon name "${dragon}" (did you spell it correctly?)`);
                // else if (isNew(dragon)) message.channel.send(`${dragon} is a new release, and thus it has an incomplete wiki page; I unfortunately cannot give you information about it at this time. Try again later, or check out <#738831348915241051> in the meantime.`);
                else if (isPrimary(dragon)) message.channel.send(dragon + " is a primary dragon, its only element is in its name...");
                else {
                    elementsMsg = () => message.channel.send(cache[dragon]["elements"]).catch(error => {
                        message.channel.send("An error occurred and I cannot retrieve the information provided. You may be able to locate it manually on this wiki page: https://dragonvale.fandom.com/wiki/" + dragon_);
                    });
                    
                    if (dragon in cache) elementsMsg();
                    else fetchFromWiki(dragon, message, elementsMsg);
                }
            }
        } else if (cmd === 'evolve') {
            var dragon = prettyString(args, " ");
            if (!dragon) message.channel.send("You must specify a dragon!");
            else {
                if (dragon.indexOf("Dragon") == -1) dragon += " Dragon";
                if (!dragonList.includes(dragon)) message.channel.send(`Unrecognized dragon name "${dragon}" (did you spell it correctly?)`);
                else if (isNew(dragon)) message.channel.send(`${dragon} is a new release, and thus it has an incomplete wiki page; I unfortunately cannot give you information about it at this time. Try again later, or check out <#738831348915241051> in the meantime.`);
                else if (!isEvolution(dragon)) message.channel.send(dragon + " is not obtained through evolution.");
                else {
                    evolveMsg = () => message.channel.send(cache[dragon]["evolve"]).catch(error => {
                        message.channel.send("An error occurred and I cannot retrieve the information provided. You may be able to locate it manually on this wiki page: https://dragonvale.fandom.com/wiki/" + dragon_);
                    });
                    
                    if (dragon in cache) evolveMsg();
                    else fetchFromWiki(dragon, message, evolveMsg);
                }
            }
        } else if (cmd === 'feed') {
            if (args.length > 3) {
                message.channel.send("Invalid command format. Please provide the starting level and ending level (and add 'rift' if you are feeding a rift dragon).");
                return;
            }
            let lastArg = args.pop();
            let rift = false;
            if (lastArg == 'rift') rift = true;
            else args.push(lastArg);
            let level2 = parseInt(args.pop());
            if (!Number.isInteger(level2) || level2 < 2 || level2 > 21) {
                message.channel.send("Please specify an integer between 2 and 21 for the dragon's final level.");
                return;
            }
            let level1 = parseInt(args.pop());
            if (!level1) level1 = 1;
            else if (!Number.isInteger(level1) || level1 < 1 || level1 > 20) {
                message.channel.send("Please specify an integer between 1 and 20 for the dragon's initial level.");
                return;
            }
            if (level1 >= level2) {
                message.channel.send("The initial level needs to be below the final level.");
                return;
            }
            let treatsNeeded = 0;
            for (i = level1; i < level2; i++) {
                treatsNeeded += 4 * (rift ? riftFeeding[i-1] : 5 * Math.pow(2, i-1));
            }
            message.channel.send(`A total of **${treatsNeeded.toLocaleString()} treats** are required to feed a${rift ? " rift" : ""} dragon from level ${level1} to ${level2}.`);
        } else if (cmd === 'guide' || cmd === 'guides') {
            if (args.length == 0) {
                message.channel.send(`Available guides: \`${Object.keys(guides).join("`, `")}\``);
            } else {
                let guide = args.shift();
                if (guide in guides) {
                    message.channel.send(guides[guide]);
                } else {
                    message.channel.send(`Guide \`${guide}\` not found. See a list of available guides with \`d!guide\`.`);
                }
            }
        } else if (cmd === 'image' || cmd === 'picture' || cmd === 'img' || cmd === 'pic') {
            if (args.length === 0) {
                message.channel.send(`Usage: \`${cmdPrefix}image <dragon> <adult|juvenile|baby|egg> [qualifier]\``);
                return;
            }
            const qualifiers = ["normal", "day", "night", "organic", "conjured", "enhanced", "nightenhanced", "charlatan", "scourge", "barbarous", "macabre", "hiding", "summer", "autumn", "winter", "spring", "snowman", "wrapped", "bush"];
            const ages = ["elder", "adult", "juvenile", "baby", "egg"];
            
            if (args[0] == 'flags') {
                message.channel.send("All currently available image flags (note that no flags are applicable to every dragon): `normal`, `day`, `night`, `organic`/`conjured` (spellforms), `enhanced`/`nightEnhanced` (rave set), `charlatan`/`scourge`/`barbarous`/`macabre` (eldritch), `hiding`, `summer`/`autumn`/`winter`/`spring` (seasonal), `snowman` (snowball), `wrapped` (giddle), `bush` (dargon)");
                return;
            }

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
                if (!dragonList.includes(dragon)) message.channel.send(`Unrecognized dragon name "${dragon}" (did you spell it correctly?)`);
                else if (isNew(dragon)) message.channel.send(`${dragon} is a new release, and thus it has an incomplete wiki page; I unfortunately cannot give you information about it at this time. Try again later, or check out <#738831348915241051> in the meantime.`);
                else {
                    imgMsg = () => {
                        var imgLink;
                        if (age == 'egg') imgLink = cache[dragon]["pictures"]["egg"];
                        else if (dragon == "Seasonal Dragon") {
                            if (qualifier == "normal") {
                                message.channel.send(`Please specify a season for the ${dragon}!`);
                                return;
                            } else if (!["summer", "autumn", "winter", "spring"].includes(qualifier)) message.channel.send(`${qualifier} is not a valid season!`);
                            else {
                                imgLink = cache[dragon]["pictures"][qualifier][age != 'elder' ? age : 'adult'];
                            }
                        } else if (qualifier == 'night') {
                            if (!dayNight.includes(dragon)) message.channel.send(dragon + " does not have a night form!");
                            else {
                                imgLink = cache[dragon]["pictures"][qualifier][age != 'elder' ? age : 'adult'];
                            }
                        } else {
                            if (qualifier == 'day' || qualifier == 'normal') {
                                imgLink = cache[dragon]["pictures"]['normal'][age];
                            } else {
                                if (!cache[dragon]["pictures"][qualifier]) message.channel.send(dragon + " does not have a(n) " + qualifier + " form!\nValid qualifiers: `normal`, `day`, `night`, `organic`/`conjured` (spellforms), `enhanced`/`nightEnhanced` (rave set), `charlatan`/`scourge`/`barbarous`/`macabre` (eldritch), `hiding`, `summer`/`autumn`/`winter`/`spring` (seasonal), `snowman` (snowball), `wrapped` (giddle), `bush` (dargon)");
                                else imgLink = cache[dragon]["pictures"][qualifier];
                            }
                        }
                        message.channel.send(imgLink ? imgLink : "Sorry, I couldn't find the image you were looking for! Here's the wiki page to retrieve it yourself: <" + 'https://dragonvale.fandom.com/wiki/' + dragon.replace(/ /g, "_") + ">").catch(error => {
                            message.channel.send("An error occurred and I cannot retrieve the information provided. You may be able to locate it manually on this wiki page: https://dragonvale.fandom.com/wiki/" + dragon_);
                        });
                    }
                    
                    if (dragon in cache) imgMsg();
                    else fetchFromWiki(dragon, message, imgMsg);
                }
            }
        } else if (cmd === 'rates') {
            var rift = false;
            var boosts = 0;
            var last = args.pop();
            // edge case: check if user is seeking DC rates of a rift primary
            if (last == 'rift') {
                var nextLast = args.pop();
                if (dragonList.includes(prettyString([nextLast, last], " ") + " Dragon")) {
                    args.push(nextLast);
                    args.push(last);
                } else {
                    args.push(nextLast);
                    rift = true;
                }
            }
            else if (!isNaN(parseInt(last))) {
                boosts = parseInt(last);
                // make sure is not a monolith/snowflake identifier first
                let nextLast = args[args.length - 1];
                if (nextLast == 'monolith' || nextLast == 'snowflake') {
                    boosts = 0;
                    args.push(last);
                }
                if (boosts < 0 || !Number.isInteger(boosts)) {
                    message.channel.send("The number of boosts must be an integer greater than 0.");
                    return;
                }
            } else if (last != undefined) args.push(last);
            var dragon = prettyString(args, " ");
            if (!dragon) message.channel.send("You must specify a dragon!");
            else {
                if (dragon.indexOf("Dragon") == -1) dragon += " Dragon";
                if (!dragonList.includes(dragon)) message.channel.send(`Unrecognized dragon name "${dragon}" (did you spell it correctly?)`);
                else if (isNew(dragon)) message.channel.send(`${dragon} is a new release, and thus it has an incomplete wiki page; I unfortunately cannot give you information about it at this time. Try again later, or check out <#738831348915241051> in the meantime.`);
                else {
                    ratesMsg = () => {
                        if (!rift) message.channel.send(cache[dragon]["rates"]["non-rift"][Math.min(boosts, cache[dragon]["rates"]["maxBoosts"])]).catch(error => {
                            message.channel.send("An error occurred and I cannot retrieve the information provided. You may be able to locate it manually on this wiki page: https://dragonvale.fandom.com/wiki/" + dragon_);
                        });
                        else message.channel.send(cache[dragon]["rates"]["rift"]).catch(error => {
                            message.channel.send("An error occurred and I cannot retrieve the information provided. You may be able to locate it manually on this wiki page: https://dragonvale.fandom.com/wiki/" + dragon_);
                        });
                    }

                    if (dragon in cache) ratesMsg();
                    else fetchFromWiki(dragon, message, ratesMsg);
                }
            }
        } else if (cmd === 'result' || cmd === 'results' || cmd === 'fakeouts') {
            /*if (!hasModAccess(message)) {
                message.channel.send("This command is currently broken! Please be patient while a fix is worked on. <:dv_owobowos:803676880850780160>");
                return;
            }*/
            // d!result <d1>,<d2> <d:hh:mm:ss> [fast|runic]
            if (args.length === 0) {
                message.channel.send(`Usage: \`${cmdPrefix}result <dragon1>,<dragon2> <d:hh:mm:ss|hh:mm:ss> [fast|runic]\``);
                return;
            }
            var fast = false, runic = false, last = args.pop();
            if (last === 'fast') fast = true;
            else if (last === 'runic') runic = true;
            else args.push(last);
            
            var times = args.pop().split(":");
            var days = 0, hrs = 0, mins = 0, secs = 0;
            if (times.length < 3 || times.length > 4) {
                message.channel.send("You have provided the timer in an invalid format. Please write the timer as either `d:hh:mm:ss` or `hh:mm:ss`.");
                return;
            } else {
                if (times.length == 4) days = parseInt(times[times.length - 4]);
                hrs = parseInt(times[times.length - 3]);
                mins = parseInt(times[times.length - 2]);
                secs = parseInt(times[times.length - 1]);
            }
            
            if (isNaN(days) || isNaN(hrs) || isNaN(mins) || isNaN(secs)) {
                message.channel.send("Your timer could not be parsed. Please write the timer as either `d:hh:mm:ss` or `hh:mm:ss`.");
                return;
            }
            var timeInt = (secs + (60 * mins) + (3600 * hrs) + (86400 * days)) * (runic ? 4 : 1);
            var timer = fmt_dhms(timeInt);

            var parents = args.join(" ").split(",");
            if (parents.length != 2) message.channel.send("You must specify 2 dragons for the parents.");
            else {
                var d1 = prettyString(parents[0].trim().split(" "), " ");
                if (d1.indexOf("Dragon") == -1) d1 += " Dragon";
                var d2 = prettyString(parents[1].trim().split(" "), " ");
                if (d2.indexOf("Dragon") == -1) d2 += " Dragon";
                if (!dragonList.includes(d1)) {
                    if (d1 == 'Monolith Dragon') message.channel.send("Your query contains a monolith dragon, but you did not specify which. Please re-enter the query using `Monolith #`, where `#` is replaced by the number of the monolith dragon.");
                    else if (d1 == 'Snowflake Dragon') message.channel.send("Your query contains a snowflake dragon, but you did not specify which. Please re-enter the query using `Snowflake #`, where `#` is replaced by the number of the snowflake dragon.");
                    else message.channel.send(`Unrecognized dragon name "${d1}" (did you spell it correctly?)`);
                } else if (!dragonList.includes(d2)) {
                    if (d2 == 'Monolith Dragon') message.channel.send("Your query contains a monolith dragon, but you did not specify which. Please re-enter the query using `Monolith #`, where `#` is replaced by the number of the monolith dragon.");
                    else if (d2 == 'Snowflake Dragon') message.channel.send("Your query contains a snowflake dragon, but you did not specify which. Please re-enter the query using `Snowflake #`, where `#` is replaced by the number of the snowflake dragon.");
                    else message.channel.send(`Unrecognized dragon name "${d2}" (did you spell it correctly?)`);
                } else {
                    resultsMsg = () => {
                        var timerList = dvboxCache[fast ? "fast" : "normal"][d1 + "|" + d2];

                        if (timerList.noParent) {
                            message.channel.send(`${timerList.noParent} has not yet been added to DVBox. Please try a different query.`);
                            return;
                        } else if (timerList.error) {
                            message.channel.send(`${d1} and ${d2} cannot be bred together. Please try a different query.`);
                            return;
                        }
                        
                        var exactMatches = [];
                        var approxMatches = [];
                        for (const key in timerList) {
                            if (timerList[key] == timeInt) exactMatches.push(key);
                            else if (timeInt < timerList[key] && timerList[key] <= timeInt + (runic ? 480 : 120)) approxMatches.push(key);
                        }
                        var returnMessage = "";
                        if (exactMatches.length > 0) returnMessage += (`A timer of ${(runic ? `${times.join(":")} in runic caves` : timer)} when breeding ${d1} x ${d2} exactly matches: **${exactMatches.join("**, **").replace(/_/g, " ")}`);
                        if (approxMatches.length > 0) returnMessage += (((returnMessage.length == 0) ? `A timer of ${timer + (runic ? ` (${times.join(":")} in runic cave)` : "")} when breeding ${d1} x ${d2} is *within 2 minutes* of: **` : "\nThis timer is also within 1 minute of: **") + approxMatches.join("**, **").replace(/_/g, " "));
                        if (returnMessage.length > 0) returnMessage += "**\nNOTE: Some of the listed dragons may not be available at this time. Check the dragonarium to confirm availability.";
                        else returnMessage = (`No matches found for timer ${(runic ? times.join(":") + " in runic caves" : timer)} when breeding ${d1} x ${d2}`);
                        message.channel.send(returnMessage);
                    }

                    if ((d1 + "|" + d2) in dvboxCache[fast ? "fast" : "normal"]) {
                        resultsMsg();
                    } else {
                        var link = d1.replace(/ /g, "_") + "|" + d2.replace(/ /g, "_");
                        if (fast) link += "|fast";
                        worker.once('message', timerList => {
                            dvboxCache[fast ? "fast" : "normal"][d1 + "|" + d2] = timerList;
                            resultsMsg();
                        });
                        worker.postMessage(link);
                    }
                }
            }
        } else if (cmd === 'sandbox' || cmd === 'dvbox') {
            if (args.length == 0) message.channel.send("The DragonVale Sandbox (or dvbox, for short) can be found at https://dvbox.bin.sh/. Note that DVBox is fanmade and may not be entirely up-to-date. In addition, please note that while the results and timers shown are accurate, the breeding odds provided are incorrect.");
            else {
                let fast = args.slice(-2).includes('fast');
                let beb = args.slice(-2).includes('beb');
                if (fast) args.splice(args.indexOf('fast'), 1);
                if (beb) args.splice(args.indexOf('beb'), 1);
                
                var parents = args.join(" ").split(",");
                if (parents.length != 2) message.channel.send("You must specify 2 dragons for the parents.");
                else {
                    var d1 = prettyString(parents[0].trim().split(" "), " ");
                    if (d1.indexOf("Dragon") == -1) d1 += " Dragon";
                    var d2 = prettyString(parents[1].trim().split(" "), " ");
                    if (d2.indexOf("Dragon") == -1) d2 += " Dragon";
                    if (d1.includes('Monolith') || d1.includes('Snowflake') || d2.includes('Monolith') || d2.includes('Snowflake')) message.channel.send("It looks like you're trying to breed with a Monolith and/or Snowflake. Unfortunately you will have to manually enter your query at https://dvbox.bin.sh/, as there is no way to specify the number of the dragon in the URL. Sorry!");
                    else if (!dragonList.includes(d1)) message.channel.send(`Unrecognized dragon name "${d1}" (did you spell it correctly?)`);
                    else if (!dragonList.includes(d2)) message.channel.send(`Unrecognized dragon name "${d2}" (did you spell it correctly?)`);
                    else {
                        var imgLink = "https://dvbox.bin.sh/#";
                        imgLink += "d1=" + d1.replace(/ /g, "").replace("Dragon", "").toLowerCase();
                        imgLink += ";d2=" + d2.replace(/ /g, "").replace("Dragon", "").toLowerCase();
                        if (beb) imgLink += ";beb=1";
                        if (fast) imgLink += ";fast=1";
                        message.channel.send(`See the breeding results of ${d1} x ${d2} at: ${imgLink}`);
                    }
                }
            }
        } else if (cmd === 'timer') {
            var dragon = prettyString(args, " ");
            if (!dragon) message.channel.send("You must specify a dragon!");
            else {
                if (dragon.indexOf("Dragon") == -1) dragon += " Dragon";
                if (!dragonList.includes(dragon)) message.channel.send(`Unrecognized dragon name "${dragon}" (did you spell it correctly?)`);
                else if (isNew(dragon)) message.channel.send(`${dragon} is a new release, and thus it has an incomplete wiki page; I unfortunately cannot give you information about it at this time. Try again later, or check out <#738831348915241051> in the meantime.`);
                else {
                    timerMsg = () => message.channel.send(cache[dragon]["timer"]).catch(error => {
                        message.channel.send("An error occurred and I cannot retrieve the information provided. You may be able to locate it manually on this wiki page: https://dragonvale.fandom.com/wiki/" + dragon_);
                    });
                    
                    if (dragon in cache) timerMsg();
                    else fetchFromWiki(dragon, message, timerMsg);
                }
            }
        } else if (cmd === 'uses') {
            var dragon = prettyString(args, " ");
            if (!dragon) message.channel.send("You must specify a dragon!");
            else {
                if (dragon.indexOf("Dragon") == -1) dragon += " Dragon";
                if (!dragonList.includes(dragon)) message.channel.send(`Unrecognized dragon name "${dragon}" (did you spell it correctly?)`);
                else if (isNew(dragon)) message.channel.send(`${dragon} is a new release, and thus it has an incomplete wiki page; I unfortunately cannot give you information about it at this time. Try again later, or check out <#738831348915241051> in the meantime.`);
                else {
                    usesMsg = () => message.channel.send(cache[dragon]["uses"]).catch(error => {
                        message.channel.send("An error occurred and I cannot retrieve the information provided. You may be able to locate it manually on this wiki page: https://dragonvale.fandom.com/wiki/" + dragon_);
                    });
                    
                    if (dragon in cache) usesMsg();
                    else fetchFromWiki(dragon, message, usesMsg);
                }
            }
        } else if (cmd === 'wiki') {
            var dragon = prettyString(args, " ");
            if (!dragon) message.channel.send("https://dragonvale.fandom.com/wiki/DragonVale_Wiki");
            else {
                if (dragon.indexOf("Dragon") == -1) dragon += " Dragon";
                if (!dragonList.includes(dragon)) {
                    dragon = dragon.substring(0, dragon.length - 7);
                    message.channel.send(`Search results for ${dragon} on the wiki can be found at: <https://dragonvale.fandom.com/wiki/Special:Search?query=${dragon.replace(/ /g, "+")}>`);
                } else message.channel.send('https://dragonvale.fandom.com/wiki/' + dragon.replace(/\s\d/, "").replace(/ /g, "_"));
            }
        } else if (cmd === '' || cmd === 'help') {		
            message.channel.send(helpMsg);
        } else if (cmd === 'mod' && hasModAccess(message)) {
            console.log(`${message.author.tag} ran mod cmd ${message.content.toLowerCase()}`);
            if (args.length == 0) {
                const helpMsg = `Mod command list: (prefix all commands with \`${cmdPrefix}mod\`)\n`
                        + "- `viewlist [primaries/evolutions/enhanced/dayNight/hiding]` - sends my stored list of dragons to your DMs; optionally specify a flag to only be sent dragons matching that flag, otherwise I send the whole list (warning: it's long)\n"
                        + "- `add <dragon>` - add dragon to dragon list\n"
                        + "- `remove <dragon>` - remove dragon from list\n"
                        + "- `flag <dragon> <primaries/evolutions/enhanced/dayNight/hiding>` - add the specified flag to the dragon\n"
                        + "- `unflag <dragon> <primaries/evolutions/enhanced/dayNight/hiding>` - remove the specified flag from the dragon\n"
                        + "- `getflags <dragon>` - gets all flags on the specified dragon\n"
                        + "- `guide <add/remove> <name> [contents]` - add/remove a guide\n"
                        + "- `clearcache` - clear the bot's cache (useful after updating the wiki)\n"
                        + "- `dljson` - sends a downloadable copy of my dragon list as a json file\n"
                        + "- `uljson` - upload a new dragon list json file for me to use (note: the file's name *must* be `dragonList.json`!)\n"
                        + "- `purge <# of messages>` - clears the specified number of most recent messages from the channel it's used in";
                message.channel.send(helpMsg);
            } else {
                const modCmd = args.shift();
                if (modCmd === 'viewlist') {
                    var tempList = (args == "primaries") ? [...primaries] : (args == "evolutions") ? [...evolutions] : (args == "enhanced") ? [...enhanced] : (args == "daynight") ? [...dayNight] : (args == "hiding") ? [...hiding] : (args == "new") ? [...newDrags] : [...dragonList];
                    if (tempList.length > 0) {
                        var msg = "";
                        while (tempList.length > 0) {
                            if (msg.length + tempList[0].length > 2000) {
                                message.author.send(msg);
                                msg = "";
                            }
                            msg += tempList.shift() + "\n";
                        }
                        if (msg.length > 0) message.author.send(msg);
                        message.channel.send("I have sent my list of dragons to your DMs.");
                    } else message.channel.send("There are no dragons with this flag!");
                } else if (modCmd === 'add') {
                    var dragon = prettyString(args, " ");
                    if (!dragon) {
                        message.channel.send("You must specify a dragon!");
                        return;
                    }
                    if (dragon.indexOf("Dragon") == -1) dragon += " Dragon";
                    
                    if (dragonList.includes(dragon)) {
                        message.channel.send(dragon + " is already in my list.");
                        return;
                    }
        
                    dragonList.push(dragon);
                    dragonList.sort();
                    newDrags.push(dragon);
                    newDrags.sort();
                    fs.writeFile('dragonList.json', JSON.stringify(fullData, null, 4), (err) => {
                        if (err) message.channel.send("An unexpected error occurred and the dragon list could not be updated.");
                        else message.channel.send(dragon + " was added to the list. If this was a mistake, type `" + cmdPrefix + "mod remove " + dragon + "` to remove it.");
                    });
                } else if (modCmd === 'remove') {
                    var dragon = prettyString(args, " ");
                    if (!dragon) {
                        message.channel.send("You must specify a dragon!");
                        return;
                    }
                    if (dragon.indexOf("Dragon") == -1) dragon += " Dragon";
                    
                    if (!dragonList.includes(dragon)) {
                        message.channel.send(dragon + " is already not in my list.");
                        return;
                    }

                    dragonList.splice(dragonList.indexOf(dragon), 1);
                    fs.writeFile('dragonList.json', JSON.stringify(fullData, null, 4), (err) => {
                        if (err) message.channel.send("An unexpected error occurred and the dragon list could not be updated.");
                        else {
                            message.channel.send(dragon + " was removed from the list. If this was a mistake, type `" + cmdPrefix + "mod add " + dragon + "` to re-add it.");
                            delete cache[dragon];
                        }
                    });
                } else if (modCmd === 'flag') {
                    var flag = args.pop();
                    var dragon = prettyString(args, " ");
                    if (!dragon) {
                        message.channel.send("You must specify a dragon!");
                        return;
                    }
                    if (dragon.indexOf("Dragon") == -1) dragon += " Dragon";
                    
                    if (!dragonList.includes(dragon)) {
                        message.channel.send(dragon + " is not in my list.");
                        return;
                    }

                    switch (flag) {
                        case "primaries":
                            if (primaries.includes(dragon)) {
                                message.channel.send(dragon + " already has this flag.");
                                return;
                            }
                            primaries.push(dragon);
                            primaries.sort();
                            break;
                        case "evolutions":
                            if (evolutions.includes(dragon)) {
                                message.channel.send(dragon + " already has this flag.");
                                return;
                            }
                            evolutions.push(dragon);
                            evolutions.sort();
                            break;
                        case "enhanced":
                            if (enhanced.includes(dragon)) {
                                message.channel.send(dragon + " already has this flag.");
                                return;
                            }
                            enhanced.push(dragon);
                            enhanced.sort();
                            break;
                        case "daynight":
                            if (dayNight.includes(dragon)) {
                                message.channel.send(dragon + " already has this flag.");
                                return;
                            }
                            dayNight.push(dragon);
                            dayNight.sort();
                            break;
                        case "hiding":
                            if (hiding.includes(dragon)) {
                                message.channel.send(dragon + " already has this flag.");
                                return;
                            }
                            hiding.push(dragon);
                            hiding.sort();
                            break;
                        case "new":
                            if (newDrags.includes(dragon)) {
                                message.channel.send(dragon + " already has this flag.");
                                return;
                            }
                            newDrags.push(dragon);
                            newDrags.sort();
                            break;
                        default:
                            message.channel.send("Unrecognized flag. Valid flags: `primaries`, `evolutions`, `enhanced`, `dayNight`, `hiding`, `new`");
                            return;
                    }
                    fs.writeFile('dragonList.json', JSON.stringify(fullData, null, 4), (err) => {
                        if (err) message.channel.send("An unexpected error occurred and the dragon list could not be updated.");
                        else {
                            message.channel.send(dragon + " was flagged as `" + flag + "`. If this was a mistake, type `" + cmdPrefix + "mod unflag " + dragon + " " + flag + "` to remove it.");
                            delete cache[dragon];
                        }
                    });
                } else if (modCmd === 'unflag') {
                    var flag = args.pop();
                    var dragon = prettyString(args, " ");
                    if (!dragon) {
                        message.channel.send("You must specify a dragon!");
                        return;
                    }
                    if (dragon.indexOf("Dragon") == -1) dragon += " Dragon";
                    
                    if (!dragonList.includes(dragon)) {
                        message.channel.send(dragon + " is not in my list.");
                        return;
                    }

                    switch (flag) {
                        case "primaries":
                            if (!primaries.includes(dragon)) {
                                message.channel.send(dragon + " already does not have this flag.");
                                return;
                            }
                            primaries.splice(primaries.indexOf(dragon), 1);
                            break;
                        case "evolutions":
                            if (!evolutions.includes(dragon)) {
                                message.channel.send(dragon + " already does not have this flag.");
                                return;
                            }
                            evolutions.splice(evolutions.indexOf(dragon), 1);
                            break;
                        case "enhanced":
                            if (!enhanced.includes(dragon)) {
                                message.channel.send(dragon + " already does not have this flag.");
                                return;
                            }
                            enhanced.splice(enhanced.indexOf(dragon), 1);
                            break;
                        case "daynight":
                            if (!dayNight.includes(dragon)) {
                                message.channel.send(dragon + " already does not have this flag.");
                                return;
                            }
                            dayNight.splice(dayNight.indexOf(dragon), 1);
                            break;
                        case "hiding":
                            if (!hiding.includes(dragon)) {
                                message.channel.send(dragon + " already does not have this flag.");
                                return;
                            }
                            hiding.splice(hiding.indexOf(dragon), 1);
                            break;
                        case "new":
                            if (!newDrags.includes(dragon)) {
                                message.channel.send(dragon + " already does not have this flag.");
                                return;
                            }
                            newDrags.splice(newDrags.indexOf(dragon), 1);
                            break;
                        default:
                            message.channel.send("Unrecognized flag. Valid flags: `primaries`, `evolutions`, `enhanced`, `dayNight`, `hiding`, `new`");
                            return;
                    }
                    fs.writeFile('dragonList.json', JSON.stringify(fullData, null, 4), (err) => {
                        if (err) message.channel.send("An unexpected error occurred and the dragon list could not be updated.");
                        else {
                            message.channel.send(dragon + " was unflagged as `" + flag + "`. If this was a mistake, type `" + cmdPrefix + "mod flag " + dragon + " " + flag + "` to re-add it.");
                            delete cache[dragon];
                        }
                    });
                } else if (modCmd === 'getflags') {
                    var dragon = prettyString(args, " ");
                    if (!dragon) {
                        message.channel.send("You must specify a dragon!");
                        return;
                    }
                    if (dragon.indexOf("Dragon") == -1) dragon += " Dragon";
                    if (!dragonList.includes(dragon)) {
                        message.channel.send(dragon + " is not in my list.");
                        return;
                    }
                    flags = [];
                    if (primaries.includes(dragon)) flags.push("primaries");
                    if (evolutions.includes(dragon)) flags.push("evolutions");
                    if (enhanced.includes(dragon)) flags.push("enhanced");
                    if (dayNight.includes(dragon)) flags.push("daynight");
                    if (hiding.includes(dragon)) flags.push("hiding");
                    if (newDrags.includes(dragon)) flags.push("new");

                    if (flags.length > 0) message.channel.send(`${dragon} has flags: \`${flags.join('`, `')}\``);
                    else message.channel.send(`${dragon} has no flags.`);
                } else if (modCmd === 'guide') {
                    let add = args.shift();
                    if (add === 'add') {
                        if (args.length < 2) message.channel.send("Please specify the name and contents of the guide to add.");
                        else {
                            let gName = args.shift();
                            let numChars = args.join(" ").length;
                            let gContents = message.content.replace(/\s{2,}/g, ' ').replace(/@/g, '').slice(cmdPrefix.length).trim().slice(-numChars);
                            guides[gName] = gContents;
                            fs.writeFile('guides.json', JSON.stringify(guides, null, 4), (err) => {
                                if (err) message.channel.send("An unexpected error occurred and the guide file could not be updated.");
                                else message.channel.send(`Added guide \`${gName}\` with contents:\n\n${gContents}`);
                            });
                        }
                    } else if (add === 'remove') {
                        if (args.length == 0) message.channel.send("Please specify the name of the guide to remove.");
                        else {
                            let gName = args.shift();
                            if (gName in guides) {
                                delete guides[gName];
                                fs.writeFile('guides.json', JSON.stringify(guides, null, 4), (err) => {
                                    if (err) message.channel.send("An unexpected error occurred and the guide list could not be updated.");
                                    else message.channel.send(`Removed guide \`${gName}\``);
                                });
                            } else {
                                message.channel.send(`Guide \`${gName}\` not found. See a list of available guides with \`d!guide\`.`);
                            }
                        }
                    } else {
                        message.channel.send(`Error: expected \`add\` or \`remove\`, but got \`${add}\``);
                    }
                } else if (modCmd === 'clearcache') {
                    questTable = {};
                    loadQuests();
                    cache = {};
                    dvboxCache = {
                        normal: {},
                        fast: {}
                    };
                    readMonolithWikiPage();
                    readSnowflakeWikiPage();
                    worker.terminate();
                    worker = new Worker('./dvboxreader.js');
                    message.channel.send("Cache cleared. Information given should now reflect the most recent wiki changes.");
                } else if (modCmd === 'dljson') {
                    message.author.send("Here is my current `dragonList.json` file.", {files: ["./dragonList.json"]});
                } else if (modCmd === 'uljson') {
                    let file = message.attachments.first();
                    if (!file) message.channel.send("You must upload a file!");
                    else if (file.name != "dragonList.json") message.channel.send("Invalid file name! The file's name *must* be `dragonList.json`.");
                    else {
                        var tempFile = fs.createWriteStream("./temp.json");
                        require('https').get(file.url, (res) => {
                            res.pipe(tempFile);
                            tempFile.on('finish', () => {
                                tempFile.close(() => {
                                    fs.readFile("./temp.json", (err, data) => {
                                        let newJson = JSON.parse(data.toString());
                                        if (!newJson.dragonList || !newJson.primaries || !newJson.evolutions || !newJson.enhanced || !newJson.dayNight || !newJson.hiding) {
                                            message.channel.send("You are missing one or more arrays in your JSON file.\nYour file must have the following arrays:\n"
                                                    + "- `dragonList` (containing all dragons)\n"
                                                    + "- `primaries` (containing all primary dragons)\n"
                                                    + "- `evolutions` (containing all evolved dragons)\n"
                                                    + "- `enhanced` (containing all dragons with enhancements)\n"
                                                    + "- `dayNight` (containing all dragons with day/night forms)\n"
                                                    + "- `hiding` (containing all dragons with hiding animations)");
                                        } else {
                                            fullData = newJson;
                                            primaries = newJson.primaries;
                                            evolutions = newJson.evolutions;
                                            enhanced = newJson.enhanced;
                                            dayNight = newJson.dayNight;
                                            hiding = newJson.hiding;
                                            dragonList = newJson.dragonList;
                                            cache = {};
                                            dvboxCache = {
                                                normal: {},
                                                fast: {}
                                            };
                                            message.channel.send("Successfully read new dragon list! Cache has been automatically cleared.");
                                        }
                                        fs.unlink("./temp.json", () => {console.log("Temp file deleted.")});
                                    });
                                });
                            });
                        });
                    }
                } else if (modCmd === 'purge') {
                    if (message.guild.id != '233370210617262080') { // DV guild id = '233370210617262080' | ZBMC guild id = '290552335611068427'
                        message.channel.send("This command can only be used in the DragonVale Discord server.");
                        return;
                    }
                    if (args.length == 0) message.channel.send("Please specify the number of messages to purge.");
                    else {
                        let num = parseInt(args.shift());
                        if (isNaN(num) || num <= 0) message.channel.send("The value specified must be a number, and greater than zero.");
                        else {
                            num = Math.min(num, 100);
                            //message.channel.send("Eventually, I'll purge " + num + " messages...");
                            message.channel.bulkDelete(num + 1).then(messages => {
                                console.log(`Received ${messages.size} messages`);
                                //Iterate through the messages here with the variable "messages".
                                const botLogCh = message.guild.channels.cache.get('306854862539325450'); // DV #bot_log id = '306854862539325450' | ZBMC #staff-zone id = '291749695175393284'
                                botLogCh.send(`**${message.author.tag} purged ${num} messages in <#${message.channel.id}>:**`);
                                messages.forEach(msgToDelete => {
                                    if (!msgToDelete.content.startsWith(`${cmdPrefix}mod purge`)) botLogCh.send(makePurgeEmbed(msgToDelete));
                                });
                            });
                        }
                    }
                } else if (modCmd === 'spamtest') {
                    const oracleTestCh = message.guild.channels.cache.get('818011940160405534');
                    const dv_turqwhat = client.emojis.cache.get('812096747672961086');
                    for (i = 1; i <= 10; i++) {
                        oracleTestCh.send(i + ` ${dv_turqwhat}`);
                        await sleep(500);
                    } 
                } else {
                    message.channel.send(`Unknown mod command. Type \`${cmdPrefix}mod help\` for a list of commands.`);
                }
            }
        } else if (cmd === 'aurora') {
            message.channel.send("", {files: ['https://c.tenor.com/ae6296kObnAAAAAC/dragonvale.gif']});
        } else if (cmd === 'lodestoned') {
            message.channel.send("", {files: ["https://i.imgur.com/2NBePN9.jpg"]});
        } else if (cmd === 'random') {
            let unmodifiedList = dragonList.slice(0);
            for (i = 0; i < 5; i++) unmodifiedList.push("Oracle Dragon"); // hehe xd
            message.channel.send(`Your *totally* randomly selected dragon is: **${unmodifiedList[Math.floor(Math.random() * unmodifiedList.length)]}**`);
        } else if (cmd === 'smoulderbrushed' || cmd === 'smoulderbushed') {
            message.channel.send("I just got a freaking Smoulderbush for the 30 day event gift. Is this a sick joke...? I didn't spend 30 days playing this event for a freaking SMOULDERBUSH DRAGON. I'm so mad this isn't even funny.");
        } else {
            message.channel.send(`Unknown command. Type \`${cmdPrefix}help\` for a list of commands.`);
        }
    } catch(err) {
        const oracleTestCh = client.guilds.cache.get('233370210617262080').channels.cache.get('818011940160405534');
        oracleTestCh.send(`<@!295625585299030016> error occurred while attempting to process the following command: \`${message.content}\` (stack trace logged to console)`);
        console.log(err);
    }
	
});

fetchFromWiki = function(dragon, message, callback) {
    var dragon_ = dragon.replace(/ /g, "_");
    https.get('https://dragonvale.fandom.com/wiki/' + dragon_, (res) => {
        console.log(`Received ${res.statusCode} status code for ${dragon}'s page`);
        if (res.statusCode == 404 || res.statusCode == 500) {
            message.channel.send(`ERROR: ${dragon}'s wiki page returned an error. Please try again, or wait a bit if the problem persists (and if it keeps happening, contact Messi).`);
            return;
        }
        var body = [];
        res.on('data', (chunk) => body.push(chunk)).on('end', () => {
            const $ = cheerio.load(Buffer.concat(body).toString());
            readWikiPage(dragon, $);
            callback();
        });
    });
}

botToken = (fs.existsSync("./bot_token.txt")) ? fs.readFileSync("./bot_token.txt").toString('utf-8') : process.env.BOT_TOKEN;
// Note to self: if running locally, remember to replace the variable with the secret token itself; otherwise, make sure it says process.env.BOT_TOKEN !!!
client.login(botToken);

function fmt_dhms(t) {
    if (t > 0 && t < 60) {
        var text = sprintf('%d sec', Math.floor(t + 0.5));
        
        return text;
    } else {
        var d; if (t > 86400) {
            d = Math.floor(t / 86400); t = (t % 86400);
        }
        var h = Math.floor(t / 3600); t = (t % 3600);
        var m = Math.floor(t / 60); t = (t % 60);
        var s = Math.floor(t);

        if (d) {
            return sprintf('%d:%02d:%02d:%02d', d, h, m, s);
        } else if (h) {
            return sprintf('%d:%02d:%02d', h, m, s);
        } else {
            return sprintf('%d:%02d', m, s);
        }
    }
}

hasModAccess = (message) => (message.guild.id == "233370210617262080" && message.member.roles.cache.some(r => r.name === "Mod Wizard")) || message.member.id == "295625585299030016";

prettyString = function(words, separator) {
	if (words.length == 0) return false;
	var result = words[0].toLowerCase();
	if (result == 'ponkipong') result = 'PonkiPong';
	else result = result.charAt(0).toUpperCase() + result.substring(1);
	for (i = 1; i < words.length; i++) {
		var str = words[i].toLowerCase();
        if (str == 'ponkipong') str = 'PonkiPong';
		else str = str.charAt(0).toUpperCase() + str.substring(1);
		result += separator + str;
	}
	result = result.replace(/’/g, "'");
	//result = result.replace("...", "…");
	return result;
}

isPrimary = (dName) => primaries.includes(dName.replace(" Rift", ""));
isEvolution = (dName) => evolutions.includes(dName);
isNew = (dName) => newDrags.includes(dName);
isEpic = (element) => !["Plant", "Fire", "Earth", "Cold", "Lightning", "Water", "Air", "Metal", "Light", "Dark", "Rift"].includes(element);


getSpacing = (baseLength, int) => Array(baseLength - int.toString().length).fill(" ").join("");

makePurgeEmbed = function(message) {
    const embed = new Discord.MessageEmbed()
            .setColor("#ff0000")
            .setAuthor(message.author.tag, message.author.avatarURL())
            .setDescription(message.content)
            .setTimestamp()
            .setFooter(`Message ID: ${message.id} | User ID: ${message.author.id}`);
    
    var i = 0;
    message.attachments.forEach(attachment => embed.addField(`Attachment ${++i}`, attachment.url + " (Attachment ID: " + attachment.id + ")"));

    return { embed: embed, files: Array.from(message.attachments.values()) };
}

roundRate = function(rawRate) {
    if (rawRate <= 200) return rawRate;
    else if (rawRate <= 900) return Math.ceil(rawRate / 50) * 50;
    else if (rawRate <= 1000) return 1000;
    else if (rawRate <= 1200) return 1200;
    else if (rawRate <= 1500) return 1500;
    else if (rawRate <= 2000) return 2000;
    else return 3000;
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
			var questsTableHTML = $('.sortable').first();
			var entries = questsTableHTML.find('tbody').first();
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
        uses: string,
		pictures: {
			options: [normal/day, night, organic, conjured, enhanced, nightEnhanced, charlatan, scourge, barbarous, macabre, hiding, summer, autumn, winter, spring],
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
    $(".dragonbox").first().find('tr').eq(8).children().eq(1).children().each((i, elem) => {
        elems.push($(elem).attr('title').split(" ")[0]);
    });
	var hiddenElems = [];
	$(".dragonbox").first().find('tr').eq(17).children('td').first().children().each((i, elem) => {
		var imgName = $(elem).children().first().attr('data-image-name');
		if (!imgName.includes("Iconb")) {
			hiddenElems.push(imgName.split(" ")[1].replace(".png", ""));
		}
	});
	var elemsResponse = `${dragon} has the ${prettyString(elems, ", ")} elements on its profile.\n`;
    elemsResponse += (hiddenElems.length == 10) ? dragon + " adds all 10 elements when breeding (often called a *pseudo*)." : (hiddenElems.length > 0) ? dragon + " adds the " + prettyString(hiddenElems, ", ") + " elements when breeding." : "Error: The wiki is missing the breeding elements of the " + dragon;
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
		cache[dragon]["rates"]["isEpic"] = isEpicDragon;

		for (boosts = 0; boosts <= maxBoosts; boosts++) {
			var rates = [];
			var title = $("#Earning_Rates").length ? $("#Earning_Rates") : $("#Earning_Rate");
			title.parent().next().next().children().first().children().eq(1).children().each((i, elem) => {
				let num = Math.ceil(parseInt($(elem).text().trim()) * (1 + 0.3 * boosts));
				rates[i] = (!isNaN(num)) ? roundRate(num) : "---";
			});
			title.parent().next().next().children().first().children().eq(3).children().each((i, elem) => {
				let num = Math.ceil(parseInt($(elem).text().trim()) * (1 + 0.3 * boosts));
				rates[i+10] = (!isNaN(num)) ? roundRate(num) : "---";
			});
			var table = "```| Lvl : DC/min | Lvl : DC/min |"
					   + "\n|-----:--------|-----:--------|";
			for (i = 0; i < 10; i++) {
				table += `\n| ${sprintf('%-4d', (i+1))}:${sprintf('%7s', rates[i])} | ${sprintf('%-4d', (i+11))}:${sprintf('%7s', rates[i+10])} |`;
			}
            if (elders.includes(dragon)) {
                let elderRate = roundRate(Math.ceil(parseInt(title.parent().next().next().children().first().children().eq(5).children().first().text().trim()) * (1 + 0.3 * boosts)));
                table += `\n|              | 21  :${sprintf('%7s', elderRate)} |`;
            }
			cache[dragon]["rates"]["non-rift"][boosts] = "DragonCash earning rates for " + dragon + " (" + boosts + "/" + maxBoosts + " boosts):\n" + table + "```"
					+ "\nNOTE: Your dragon's profile will likely show a lower number than what's in this table. That number is wrong (this has been experimentally proven). The numbers here are the *actual* earning rates.";
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
        if (elders.includes(dragon)) table += "\n|              | 21  :     21 |";

		cache[dragon]["rates"]["rift"] = (dragon.indexOf("Ghostly") != -1) ? dragon + " does not have etherium earning rates because it cannot exist in the rift." : "Etherium earning rates for " + dragon + ":\n" + table + "```";
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
    // Uses (now including quest name)
    var uses = [];
    if ($("#Required_Combos").length) {
        $("#Required_Combos").parent().next().next().children().each((i, elem) => uses.push($(elem).text().trim()));
        if ($("#Required_Combos").parent().next().next().next().next().prop("tagName") == "UL") $("#Required_Combos").parent().next().next().next().next().children().each((i, elem) => uses.push($(elem).text().trim()));
    }
    cache[dragon]["uses"] = (uses.length > 0) ? dragon + " is needed in order to obtain the following dragon(s): **" + uses.join("**, **") + "**" : dragon + " is not needed to obtain any other dragons.";
    var questName = $(".dragonbox").first().find('tr').eq(13).children('td').first().text().trim();
    cache[dragon]["uses"] += (questName != 'N/A') ? `\n\nCorresponding Quest: *${questName}*` : `\n\n${dragon} has no corresponding quest.`;
	// Pictures
	const dragonNoSpace = dragon.replace(/ /g, '');
	cache[dragon]["pictures"]["normal"] = {};
	cache[dragon]["pictures"]["normal"]["adult"] = $("[alt='" + dragonNoSpace + "Adult.png']").first().attr('src');
	cache[dragon]["pictures"]["normal"]["juvenile"] = $("[alt='" + dragonNoSpace + "Juvenile.png']").first().attr('src');
	cache[dragon]["pictures"]["normal"]["baby"] = $("[alt='" + dragonNoSpace + "Baby.png']").first().attr('src');
	cache[dragon]["pictures"]["egg"] = $("[alt='" + dragonNoSpace + "Egg.png']").first().attr('data-src');
	if (elders.includes(dragon)) {
        cache[dragon]["pictures"]["normal"]["elder"] = $("[alt='" + dragonNoSpace + "Elder.png']").first().attr('src');
        cache[dragon]["pictures"]["normal"]["baby"] = $("[alt='" + dragonNoSpace + "Baby.png']").first().attr('data-src');
    }
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
    if (hiding.includes(dragon)) cache[dragon]["pictures"]["hiding"] = $("[alt='" + dragonNoSpace + "Hiding.png']").first().attr('data-src');
    if (dragon == "Seasonal Dragon") {
        cache[dragon]["pictures"]["summer"] = {};
        cache[dragon]["pictures"]["autumn"] = {};
        cache[dragon]["pictures"]["winter"] = {};
        cache[dragon]["pictures"]["spring"] = {};
        cache[dragon]["pictures"]["summer"]["adult"] = $("[alt='SummerSeasonalDragonAdult.png']").first().attr('data-src');
        cache[dragon]["pictures"]["summer"]["juvenile"] = $("[alt='SummerSeasonalDragonJuvenile.png']").first().attr('data-src');
        cache[dragon]["pictures"]["summer"]["baby"] = $("[alt='SummerSeasonalDragonBaby.png']").first().attr('data-src');
        cache[dragon]["pictures"]["autumn"]["adult"] = $("[alt='AutumnSeasonalDragonAdult.png']").first().attr('data-src');
        cache[dragon]["pictures"]["autumn"]["juvenile"] = $("[alt='AutumnSeasonalDragonJuvenile.png']").first().attr('data-src');
        cache[dragon]["pictures"]["autumn"]["baby"] = $("[alt='AutumnSeasonalDragonBaby.png']").first().attr('data-src');
        cache[dragon]["pictures"]["winter"]["adult"] = $("[alt='WinterSeasonalDragonAdult.png']").first().attr('data-src');
        cache[dragon]["pictures"]["winter"]["juvenile"] = $("[alt='WinterSeasonalDragonJuvenile.png']").first().attr('data-src');
        cache[dragon]["pictures"]["winter"]["baby"] = $("[alt='WinterSeasonalDragonBaby.png']").first().attr('data-src');
        cache[dragon]["pictures"]["spring"]["adult"] = $("[alt='SpringSeasonalDragonAdult.png']").first().attr('src');
        cache[dragon]["pictures"]["spring"]["juvenile"] = $("[alt='SpringSeasonalDragonJuvenile.png']").first().attr('src');
        cache[dragon]["pictures"]["spring"]["baby"] = $("[alt='SpringSeasonalDragonBaby.png']").first().attr('src');
    } else if (dragon == "Snowball Dragon") {
        cache[dragon]["pictures"]["snowman"] = $("[alt='SnowballDragonSnowman.png']").first().attr('data-src');
    } else if (dragon == "Giddle Dragon") {
        cache[dragon]["pictures"]["wrapped"] = $("[alt='GiddleDragonWrapped.png']").first().attr('data-src');
    } else if (dragon == "Dargon Dragon") {
        cache[dragon]["pictures"]["bush"] = $("[alt='DargonDragonAdultBush.png']").first().attr('data-src');
    }
    // Edge cases for dragons whose images work weirdly
    if (dragon == "Dark Dragon") {
        cache[dragon]["pictures"]["normal"]["adult"] = $("[alt='DarkDragonAdultOld.png']").first().attr('src');
        cache[dragon]["pictures"]["normal"]["juvenile"] = $("[alt='DarkDragonJuvenileOld.png']").first().attr('src');
        cache[dragon]["pictures"]["normal"]["baby"] = $("[alt='DarkDragonBabyOld.png']").first().attr('data-src');
    } else if (dragon == "Flower Dragon") {
        cache[dragon]["pictures"]["normal"]["adult"] = $("[alt='FlowerDragonAdult.png']").first().attr('data-src');
        cache[dragon]["pictures"]["normal"]["juvenile"] = $("[alt='FlowerDragonJuvenile.png']").first().attr('data-src');
        cache[dragon]["pictures"]["normal"]["baby"] = $("[alt='FlowerDragonBaby.png']").first().attr('data-src');
        cache[dragon]["pictures"]["egg"] = $("[alt='FlowerDragonRiftEgg.png']").first().attr('data-src');
    } else if (dragon == "Meteor Dragon") {
        cache[dragon]["pictures"]["normal"]["adult"] = $("[alt='MeteorDragonAdult.png']").first().attr('data-src');
        cache[dragon]["pictures"]["normal"]["juvenile"] = $("[alt='MeteorDragonJuvenile.png']").first().attr('data-src');
        cache[dragon]["pictures"]["normal"]["baby"] = $("[alt='MeteorDragonBaby.png']").first().attr('data-src');
        cache[dragon]["pictures"]["egg"] = $("[alt='MeteorDragonRiftEgg.png']").first().attr('data-src');
    }
}

/* cache: {
    "Monolith # Dragon": {
        ...
    },
    "Snowflake # Dragon": {
        ...
    }
}
*/
readMonolithWikiPage = function() {
    https.get('https://dragonvale.fandom.com/wiki/Monolith_Dragon', (res) => {
		console.log("Received " + res.statusCode + " status code for monoliths page");
		var body = [];
		res.on('data', (chunk) => {
			body.push(chunk);
		}).on('end', () => {
			body = Buffer.concat(body).toString();
			const $ = cheerio.load(body);
            
            // Breeding combo
            for (let id = 1; id <= 6; id++) {
                let dragon = "Monolith " + id + " Dragon";
                var table = $(".dragonbox").eq(id - 1);
                cache[dragon] = {};

                // Breeding combo
                cache[dragon]["breedCombo"] = $("#Breeding").parent().next().text().trim();

                // Elements
                var elems = [];
                table.find('tr').eq(8).children().eq(1).children().each((j, elem) => {
                    elems.push($(elem).attr('title').split(" ")[0]);
                });
                var hiddenElems = [];
                table.find('tr').eq(17).children('td').first().children().each((j, elem) => {
                    var imgName = $(elem).children().first().attr('data-image-name');
                    if (!imgName.includes("Iconb")) {
                        hiddenElems.push(imgName.split(" ")[1].replace(".png", ""));
                    }
                });
                var elemsResponse = dragon + " has the " + prettyString(elems, ", ") + " elements on its profile.\n";
                elemsResponse += (hiddenElems.length == 10) ? dragon + " adds all 10 elements when breeding (often called a *pseudo*)." : (hiddenElems.length > 0) ? dragon + " adds the " + prettyString(hiddenElems, ", ") + " elements when breeding." : "Error: The wiki is missing the breeding elements of the " + dragon;
                cache[dragon]["elements"] = elemsResponse;

                // Rates
                cache[dragon]["rates"] = {};
                cache[dragon]["rates"]["non-rift"] = {};

                let ratesTable = $("#Earning_Rates").parent().nextAll('table').eq((id <= 2) ? 0 : (id <= 4) ? 1 : id - 3);

                var maxBoosts = table.find('tr').eq(9).children().eq(1).find('img').length - 1;
                var isEpicDragon = true;
                cache[dragon]["rates"]["isEpic"] = isEpicDragon;

                for (boosts = 0; boosts <= maxBoosts; boosts++) {
                    var rates = [];
                    ratesTable.children().first().children().eq(1).children().each((i, elem) => {
                        let num = Math.ceil(parseInt($(elem).text().trim()) * (1 + 0.3 * boosts));
                        rates[i] = (!isNaN(num)) ? roundRate(num) : "---";
                    });
                    ratesTable.children().first().children().eq(3).children().each((i, elem) => {
                        let num = Math.ceil(parseInt($(elem).text().trim()) * (1 + 0.3 * boosts));
                        rates[i+10] = (!isNaN(num)) ? roundRate(num) : "---";
                    });
                    var rTable = "```| Lvl : DC/min | Lvl : DC/min |"
                            + "\n|-----:--------|-----:--------|";
                    for (i = 0; i < 10; i++) {
                        var lvlA = i + 1;
                        var lvlB = i + 11;
                        result = "\n| " + lvlA + getSpacing(4, lvlA) + ":" + getSpacing(7, rates[i]) + rates[i] + " | " + lvlB + getSpacing(4, lvlB) + ":" + getSpacing(7, rates[i+10]) + rates[i+10] + " |";
                        rTable += result;
                    }
                    cache[dragon]["rates"]["non-rift"][boosts] = "DragonCash earning rates for " + dragon + " (" + boosts + "/" + maxBoosts + " boosts):\n" + rTable + "```"
                            + "\nNOTE: Your dragon's profile will likely show a lower number than what's in this table. That number is wrong (this has been experimentally proven). The numbers here are the *actual* earning rates.";
                }
                var rates = [];
                for (i = 0; i < 20; i++) {
                    rates[i] = Math.ceil((i+1) * (isEpicDragon ? 1.5 : 1));
                }
                var rTable = "```| Lvl : Eth/hr | Lvl : Eth/hr |"
                        + "\n|-----:--------|-----:--------|";
                for (i = 0; i < 10; i++) {
                    var lvlA = i + 1;
                    var lvlB = i + 11;
                    result = "\n| " + lvlA + getSpacing(4, lvlA) + ":" + getSpacing(7, rates[i]) + rates[i] + " | " + lvlB + getSpacing(4, lvlB) + ":" + getSpacing(7, rates[i+10]) + rates[i+10] + " |";
                    rTable += result;
                }
                cache[dragon]["rates"]["rift"] = "Etherium earning rates for " + dragon + ":\n" + rTable + "```";

                cache[dragon]["rates"]["maxBoosts"] = maxBoosts;
                cache[dragon]["isGemstone"] = false;

                // Timer
                var regTimer = table.find('tr').eq(5).children().last().text().trim();
                var upTimer = table.find('tr').eq(6).children().last().text().trim();
                cache[dragon]["timer"] = "The breeding times of " + dragon + " are **" + regTimer + "** (regular cave) or **" + upTimer + "** (upgraded cave).";

                // Uses
                var uses = [];
                if ($("#Required_Combos").length) {
                    $("#Required_Combos").parent().next().next().children().each((k, elem) => uses.push($(elem).text().trim()));
                    if ($("#Required_Combos").parent().next().next().next().next().prop("tagName") == "UL") $("#Required_Combos").parent().next().next().next().next().children().each((i, elem) => uses.push($(elem).text().trim()));
                }
                cache[dragon]["uses"] = (uses.length > 0) ? dragon + " is needed in order to obtain the following dragon(s): **" + uses.join("**, **") + "**" : dragon + " is not needed to obtain any other dragons.";
                cache[dragon]["uses"] += `\n\n${dragon} has no corresponding quest.`;

                // Pictures
                const dragonNoSpace = "MonolithDragon";
                cache[dragon]["pictures"] = {};
                cache[dragon]["pictures"]["normal"] = {};
                cache[dragon]["pictures"]["normal"]["adult"] = $("[alt='" + dragonNoSpace + "Adult" + id + ".png']").first().attr((id == 1) ? 'src' : 'data-src');
                cache[dragon]["pictures"]["normal"]["juvenile"] = $("[alt='" + dragonNoSpace + "Juvenile" + id + ".png']").first().attr('data-src');
                cache[dragon]["pictures"]["normal"]["baby"] = $("[alt='" + dragonNoSpace + "Baby" + id + ".png']").first().attr('data-src');
                cache[dragon]["pictures"]["egg"] = $("[alt='" + dragonNoSpace + "Egg.png']").first().attr('data-src');

            }
		}).on('error', (e) => {
			console.error("An error occurred, monolith dragons info could not be loaded.\nFull error:\n" + e);
		});
	});
}
readSnowflakeWikiPage = function() {
    https.get('https://dragonvale.fandom.com/wiki/Snowflake_Dragon', (res) => {
		console.log("Received " + res.statusCode + " status code for snowflakes page");
		var body = [];
		res.on('data', (chunk) => {
			body.push(chunk);
		}).on('end', () => {
			body = Buffer.concat(body).toString();
			const $ = cheerio.load(body);
            
            // Breeding combo
            for (let id = 1; id <= 7; id++) {
                let dragon = "Snowflake " + id + " Dragon";
                var table = $(".dragonbox").eq(id - 1);
                cache[dragon] = {};

                // Breeding combo
                cache[dragon]["breedCombo"] = $("#Breeding").parent().next().text().trim();

                // Elements
                var elems = [];
                table.find('tr').eq(8).children().eq(1).children().each((j, elem) => {
                    elems.push($(elem).attr('title').split(" ")[0]);
                });
                var hiddenElems = [];
                table.find('tr').eq(17).children('td').first().children().each((j, elem) => {
                    var imgName = $(elem).children().first().attr('data-image-name');
                    if (!imgName.includes("Iconb")) {
                        hiddenElems.push(imgName.split(" ")[1].replace(".png", ""));
                    }
                });
                var elemsResponse = dragon + " has the " + prettyString(elems, ", ") + " elements on its profile.\n";
                elemsResponse += (hiddenElems.length == 10) ? dragon + " adds all 10 elements when breeding (often called a *pseudo*)." : (hiddenElems.length > 0) ? dragon + " adds the " + prettyString(hiddenElems, ", ") + " elements when breeding." : "Error: The wiki is missing the breeding elements of the " + dragon;
                cache[dragon]["elements"] = elemsResponse;

                // Rates
                cache[dragon]["rates"] = {};
                cache[dragon]["rates"]["non-rift"] = {};

                let ratesTable = $("#Earning_Rates").parent().nextAll('table').eq((id <= 2) ? 0 : (id <= 4) ? 1 : id - 3);

                var maxBoosts = table.find('tr').eq(9).children().eq(1).find('img').length - 1;
                var isEpicDragon = true;
                cache[dragon]["rates"]["isEpic"] = isEpicDragon;

                for (boosts = 0; boosts <= maxBoosts; boosts++) {
                    var rates = [];
                    ratesTable.children().first().children().eq(1).children().each((i, elem) => {
                        let num = Math.ceil(parseInt($(elem).text().trim()) * (1 + 0.3 * boosts));
                        rates[i] = (!isNaN(num)) ? roundRate(num) : "---";
                    });
                    ratesTable.children().first().children().eq(3).children().each((i, elem) => {
                        let num = Math.ceil(parseInt($(elem).text().trim()) * (1 + 0.3 * boosts));
                        rates[i+10] = (!isNaN(num)) ? roundRate(num) : "---";
                    });
                    var rTable = "```| Lvl : DC/min | Lvl : DC/min |"
                            + "\n|-----:--------|-----:--------|";
                    for (i = 0; i < 10; i++) {
                        var lvlA = i + 1;
                        var lvlB = i + 11;
                        result = "\n| " + lvlA + getSpacing(4, lvlA) + ":" + getSpacing(7, rates[i]) + rates[i] + " | " + lvlB + getSpacing(4, lvlB) + ":" + getSpacing(7, rates[i+10]) + rates[i+10] + " |";
                        rTable += result;
                    }
                    cache[dragon]["rates"]["non-rift"][boosts] = "DragonCash earning rates for " + dragon + " (" + boosts + "/" + maxBoosts + " boosts):\n" + rTable + "```"
                            + "\nNOTE: Your dragon's profile will likely show a lower number than what's in this table. That number is wrong (this has been experimentally proven). The numbers here are the *actual* earning rates.";
                }
                var rates = [];
                for (i = 0; i < 20; i++) {
                    rates[i] = Math.ceil((i+1) * (isEpicDragon ? 1.5 : 1));
                }
                var rTable = "```| Lvl : Eth/hr | Lvl : Eth/hr |"
                        + "\n|-----:--------|-----:--------|";
                for (i = 0; i < 10; i++) {
                    var lvlA = i + 1;
                    var lvlB = i + 11;
                    result = "\n| " + lvlA + getSpacing(4, lvlA) + ":" + getSpacing(7, rates[i]) + rates[i] + " | " + lvlB + getSpacing(4, lvlB) + ":" + getSpacing(7, rates[i+10]) + rates[i+10] + " |";
                    rTable += result;
                }
                cache[dragon]["rates"]["rift"] = "Etherium earning rates for " + dragon + ":\n" + rTable + "```";

                cache[dragon]["rates"]["maxBoosts"] = maxBoosts;
                cache[dragon]["isGemstone"] = false;

                // Timer
                var regTimer = table.find('tr').eq(5).children().last().text().trim();
                var upTimer = table.find('tr').eq(6).children().last().text().trim();
                cache[dragon]["timer"] = "The breeding times of " + dragon + " are **" + regTimer + "** (regular cave) or **" + upTimer + "** (upgraded cave).";

                // Uses
                var uses = [];
                if ($("#Required_Combos").length) {
                    $("#Required_Combos").parent().next().next().children().each((k, elem) => uses.push($(elem).text().trim()));
                    if ($("#Required_Combos").parent().next().next().next().next().prop("tagName") == "UL") $("#Required_Combos").parent().next().next().next().next().children().each((i, elem) => uses.push($(elem).text().trim()));
                }
                cache[dragon]["uses"] = (uses.length > 0) ? dragon + " is needed in order to obtain the following dragon(s): **" + uses.join("**, **") + "**" : dragon + " is not needed to obtain any other dragons.";
                cache[dragon]["uses"] += `\n\n${dragon} has no corresponding quest.`;

                // Pictures
                const dragonNoSpace = "SnowflakeDragon";
                cache[dragon]["pictures"] = {};
                cache[dragon]["pictures"]["normal"] = {};
                cache[dragon]["pictures"]["normal"]["adult"] = $("[alt='" + dragonNoSpace + "Adult" + id + ".png']").first().attr((id == 1) ? 'src' : 'data-src');
                cache[dragon]["pictures"]["normal"]["juvenile"] = $("[alt='" + dragonNoSpace + "Juvenile" + id + ".png']").first().attr('data-src');
                cache[dragon]["pictures"]["normal"]["baby"] = $("[alt='" + dragonNoSpace + "Baby" + id + ".png']").first().attr('data-src');
                cache[dragon]["pictures"]["egg"] = $("[alt='" + dragonNoSpace + "Egg.png']").first().attr('data-src');

            }
		}).on('error', (e) => {
			console.error("An error occurred, snowflake dragons info could not be loaded.\nFull error:\n" + e);
		});
	});
}
