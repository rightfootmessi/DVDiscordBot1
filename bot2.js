const {Discord, Client, GatewayIntentBits, SnowflakeUtil, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, AttachmentBuilder} = require('discord.js');
const client = new Client(
    {
        intents: [
            GatewayIntentBits.AutoModerationConfiguration,
            GatewayIntentBits.AutoModerationExecution,
            GatewayIntentBits.DirectMessageReactions,
            GatewayIntentBits.DirectMessageTyping,
            GatewayIntentBits.DirectMessages,
            GatewayIntentBits.GuildEmojisAndStickers,
            GatewayIntentBits.GuildIntegrations,
            GatewayIntentBits.GuildInvites,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.GuildMessageReactions,
            GatewayIntentBits.GuildMessageTyping,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.GuildModeration,
            GatewayIntentBits.GuildPresences,
            GatewayIntentBits.GuildScheduledEvents,
            GatewayIntentBits.GuildVoiceStates,
            GatewayIntentBits.GuildWebhooks,
            GatewayIntentBits.Guilds,
            GatewayIntentBits.MessageContent
        ]
    }
);
const https = require('https');
const httpsFR = require('follow-redirects/https');
const cheerio = require('cheerio');
const { Worker } = require('worker_threads');
const fs = require('fs');
const sprintf = require('sprintf-js').sprintf;
const crypto = require('crypto');

const cmdPrefix = 'd%';

// if odd # of cmds, give the extra to msg2 since msg1 also has the header
const helpMsg1 = `Command list (prefix all commands with \`${cmdPrefix}\`):\n`
                + "- `breed <dragon>` - find out how to breed a dragon\n"
                + "- `elements <dragon>` - get the breeding elements (aka hidden elements) of a dragon\n"
                + "- `evolve <dragon>` - find the evolution requirements for a dragon\n"
                + "- `feed [initial level] <final level> [rift]` - find the number of treats needed to feed a dragon from the initial level (defaults to 1 if not specified) to the final level\n"
                + "- `guide [guide]` - retrieves a guide, or lists all available guides if none specified (alias: `guides`)\n"
                + "- `image <dragon> <adult|juvenile|baby|egg> [qualifier]` - get a PNG image of the dragon; defaults to adult if no stage specified; valid qualifiers can be listed using `d!image flags`  (aliases: `picture`, `img`, `pic`)\n"
                + "- `info <dragon>` - view a comprehensive information card about a dragon\n"
                + "- `odds <dragon>` - lists the breeding odds of the specified dragon in each cave, including cloning rates (aliases: `chances`, `percents`)\n"
                + "- `parent <dragon> [normal|fast|coop|rift|runic] [noclone]` - lists the 10 breeding combinations with the highest odds of resulting in the specified dragon in the specified cave; omitting the cave argument defaults to the normal cave; add the `noclone` to exclude all combinations that involve the dragon as a parent (aliases: `parents`, `combo`)\n";
const helpMsg2 = "- `quest <quest>` - get the correct dragon to send on a quest\n"
                + "- `rates <dragon> [b #] [g #] [rift]` - get the earning rates of a dragon. Add `b` followed by a number to apply boosts, and/or `g` followed by a number to apply generators, or `rift` to get etherium earning rates\n"
                + "- `result <dragon1>, <dragon2> <d:hh:mm:ss OR ##d ##h ##m ##s> [normal|fast|coop|runic]` - given 2 parent dragons and the resulting timer, find the potential dragons that can result from the breed; if a cave is not specified, the normal breeding cave is assumed (aliases: `results`, `fakeouts`)\n"
                + "- `sandbox <dragon1>, <dragon2> [normal|fast|coop|rift|runic]` - displays all possible results of the specified breeding combo (alias: `dvbox`, `sim`, `breedsim`)\n"
                + "- `timer <dragon name>` - get the breeding times of the dragon\n"
                + "- `uses <dragon name>` - get all dragons that include the specified dragon in its breeding combination\n"
                + "- `wiki <dragon name OR item>` - get the link to a dragon's wiki page, or displays the wiki's search results if the argument is another item\n"
                + "- `help` - view this message";
const helpMsgHelper = `Mod command list: (prefix all commands with \`${cmdPrefix}mod\`)\n`
                + "- `pin <message link/ID>` - pins the linked message to the channel (MUST use command in the same channel as the message to be pinned!); does nothing if the channel is at the pin limit already\n"
                + "- `unpin <message link/ID>` - unpins the linked message from the channel (MUST use commandin the same channel as the message to be unpinned!)\n";
const helpMsgMod = helpMsgHelper
                + "- `viewlist [primaries/evolutions/enhanced/dayNight/hiding]` - sends my stored list of dragons to your DMs; optionally specify a flag to only be sent dragons matching that flag, otherwise I send the whole list (warning: it's long)\n"
                + "- `dragon <add/remove> <dragon>` - add/remove dragon to dragon list. Dragons added automatically receive the `new` flag\n"
                + "- `flag <dragon> <primaries/evolutions/enhanced/dayNight/hiding>` - add the specified flag to the dragon\n"
                + "- `unflag <dragon> <primaries/evolutions/enhanced/dayNight/hiding>` - remove the specified flag from the dragon\n"
                + "- `getflags <dragon>` - gets all flags on the specified dragon\n"
                + "- `guide <add/remove> <name> [contents]` - add/remove a guide\n"
                + "- `qotd <viewlist/add/edit/remove> <position> <asker> <anon> <question>` - Adds/removes an upcoming QOTD, or lists all pending questions\n"
                + "- `clearcache` - clear the bot's cache and redownloads all data files\n"
                + "- `dljson` - sends a downloadable copy of my dragon list as a json file\n"
                + "- `purge <# of messages>` - clears the specified number of most recent messages from the channel it's used in\n"
                + "- `cleanthread <id> [# days] [list] [remove]` - counts the number of users who have not sent a message in the specified thread in the specified number of days; adding the `list` argument DMs you with the names of these users, and/or adding the `remove` argument kicks them all from the thread";

const riftFeeding = [2500, 6000, 9000, 12000, 20000, 30000, 45000, 70000, 100000, 150000, 250000, 350000, 500000, 800000, 1200000, 1800000, 3000000, 4000000, 6250000, 12500000];

// let worker = new Worker('./dvboxreader.js');
let qotd_worker = new Worker('./qotd.js');

function post_qotd(data) {
    console.log('listener attached');
    console.log(JSON.stringify(data));
    if (data != null) {
        var postStr = `**Question of the Day ${data.num}:** ${data.q.question}`;
        if (data.q.asker != null) {
            if (data.q.anon) postStr += " (Thank you for the submission!)";
            else postStr += ` (Thank you <@${data.q.asker}> for the submission!)`;
        }
        const qotdCh = client.guilds.cache.get('233370210617262080').channels.cache.get('999342201387630732'); // oracle-pet ID = 818011940160405534
        qotdCh.send(postStr).then(qMsg => {
            console.log(qMsg.constructor.name);
            console.log(typeof qMsg.startThread === 'function');
            qMsg.startThread({
                name: `Question of the Day ${data.num}`,
                autoArchiveDuration: qMsg.channel.defaultAutoArchiveDuration
            }).then(thread => console.log(thread.name));
            client.channels.fetch('276384829593878529').then(channel => {
                let modMsg = `Just posted QOTD #${data.num}.`;
                if (data.remaining == 0) modMsg += ` **__WARNING: NO MORE QUESTIONS IN THE QOTD QUEUE!!!__**`;
                else if (data.remaining <= 5) modMsg += ` **Warning: only ${data.remaining} question(s) currently in the QOTD queue!**`;
                else modMsg += ` There are ${data.remaining} questions in the QOTD queue.`;
                channel.send(modMsg);
            });
        });
    } else {
        console.log("No QOTD received - did we run out?");
    }
    // TODO remove inactive members from Adding Friends forum post?
}

var primaries, evolutions, enhanced, dayNight, hiding, elders, dragonList, newDrags, fullData;

var guides = {};

var wikiBreedingHints = {};
var wikiDragons = {};
var wikiEarnRates = {};
var wikiEthEarnRates = {};
var wikiLimited = {};
var questTable = {};
var compEarnRates = {};

var dvboxCache = {
    normal: {},
    upgraded: {},
    cooperative: {},
    rift: {},
    runic: {}
};
var comboCache = {
    clone: {
        normal: {},
        upgraded: {},
        cooperative: {},
        rift: {},
        runic: {}
    },
    no_clone: {
        normal: {},
        upgraded: {},
        cooperative: {},
        rift: {},
        runic: {}
    }
};
var oddsCache = {};

var botStartTimestamp = 0;
var lastBackupDate = "never";

var readWikiSuccess = [];
var readWikiFail = [];
var readWikiChangesDetected = [];

client.on('ready', () => {
    botStartTimestamp = Math.floor(Date.now() / 1000);
    console.log(`Oracle is waking up at ${botStartTimestamp}...`);
    let data = JSON.parse(fs.readFileSync('dragonList2.json'));
    fullData = data;
    primaries = data.primaries;
    evolutions = data.evolutions;
    enhanced = data.enhanced;
    dayNight = data.dayNight;
    hiding = data.hiding;
    elders = data.elders;
    dragonList = data.dragonList;
    newDrags = data.newDrags;
    fs.readdirSync('.').forEach(file => {
        if (file.includes('-backup')) {
            lastBackupDate = file.slice(17, -5).split('.');
            lastBackupDate = new Date(2000 + parseInt(lastBackupDate[2]), lastBackupDate[0] - 1, lastBackupDate[1]);
            lastBackupDate.setUTCHours(5);
            lastBackupDate = lastBackupDate.getTime() / 1000;
        }
    });
    qotd_worker.on('message', data => post_qotd(data));
    qotd_worker.postMessage({cmd: 'restart'});
    loadWikiData();
    guides = JSON.parse(fs.readFileSync('guides.json'));

    // const modChatCh = client.guilds.cache.get('233370210617262080').channels.cache.get('818011940160405534'); // mod-chat = '276384829593878529'
    client.channels.fetch('276384829593878529').then(channel => {
        let qotdData = JSON.parse(fs.readFileSync('qotdlist.json'));
        if (qotdData.queue.length == 0) channel.send(`**WARNING: NO QUESTIONS IN THE QOTD QUEUE!!!**`);
        else if (qotdData.queue.length <= 5) channel.send(`Warning: only ${qotdData.queue.length} question(s) currently in the QOTD queue!`);
    });
});

client.on('messageCreate', async (message) => {
    try {
        if (!message.content.toLowerCase().startsWith(cmdPrefix) || message.author.bot) return;
        else if (!checkIfLoaded()) {
            message.channel.send("Still loading resources, please wait!");
            return;
        }

        var args = message.content.replace(/\s{2,}/g, ' ').replace(/@/g, '').slice(cmdPrefix.length).trim().split(" ");
        const cmd = args.shift().toLowerCase();

        if (Math.random() < 0.01 && !['aurora', 'ban', 'lodestoned', 'pet', 'random', 'smoulderbrushed', 'smoulderbushed', 'msg', 'mod', 'help'].includes(cmd)) {
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
            let emote = [
                '<:dv_owobowos:803676880850780160>', 
                '<:dv_ikastarko:870846746190831677>', 
                '<:dv_loveheart:722966875952382002>', 
                '<:dv_blazinglol:936305959104577536>', 
                '<a:dv_dargondance:1076889334181019719>', 
                '<a:dv_partyparrot:437051709542498306>', 
                '<:dv_radiantgrin:1039696923457769552>', 
                '<:dv_ruckuswink:1148974493155463178>', 
                '<:dv_serenityface:1248792574265790616>', 
                '<:dv_surgeswag:1129224403557822686>', 
                '<:dv_berryhehe:894608501735817267>'
            ];
            emote = emote[Math.floor(Math.random() * emote.length)];
            message.channel.send(`Just kidding! Sorry about that friend ${emote}`);
            await sleep(500);
        }
    
        if (cmd === 'breed') {
            if (cmdInWrongChannel(message)) return;
            let dragon = parseDragon(args, message);
            if (!dragon) return;
            else if (newDrags.includes(dragon)) message.channel.send(`**__${dragon}:__** ${dragon} is a new release, so this information may not be available yet. Try again later, or check out <#738831348915241051> in the meantime.`);
            else if (isPrimary(dragon)) message.channel.send(`**__${dragon}:__** ${dragon} is a primary dragon. To get more, breed 2 together or just buy it from the market.`);
            else if (wikiBreedingHints[dragon].IsEvolution) message.channel.send(`**__${dragon}:__** ${dragon} is obtained through evolution. Use \`${cmdPrefix}evolve ${dragon}\` to find out how to evolve it. In order to breed more, *both* parents must be ${dragon}.`);
            else {
                let msg = `**__${dragon}:__**\n**Hint:** ${wikiBreedingHints[dragon].Text ? wikiBreedingHints[dragon].Text : generateBreedingHint(dragon)}`;
                let availability = getAvailability(dragon);
                let isAvailable = !availability ? 0 : availability === 'permanent' ? -1 : 1;
                if (isAvailable >= 0) {
                    if (isAvailable) {
                        if (availability.isBreedable) msg += `\n**Availability:** :white_check_mark: available to breed and/or purchase until **${availability.countdown}**!`;
                        else msg += `\n**Availability:** :warning: available for purchase but **not** for breeding until **${availability.countdown}**!`
                    }
                    else msg += `\n**Availability:** :prohibited: currently unavailable!`;
                    msg += ' *Note: check the Dragonarium to confirm this claim.*';
                }
                else msg += ' **\nAvailability:** :white_check_mark: always available!';
                message.channel.send(msg);
            }
        } else if (cmd === 'elements') {
            if (cmdInWrongChannel(message)) return;
            let dragon = parseDragon(args, message);
            if (!dragon) return;
            else message.channel.send(`**__${dragon}:__**\nProfile Elements: ${wikiDragons[dragon].Elements.map(x => getIcon(x)).join('')}\nBreeding Elements: ${wikiDragons[dragon].BreedingElements ? wikiDragons[dragon].BreedingElements.map(x => getIcon(x)).join('') : wikiDragons[dragon].Elements.map(x => getIcon(x)).join('')}`);
        } else if (cmd === 'evolve') {
            if (cmdInWrongChannel(message)) return;
            let dragon = parseDragon(args, message);
            if (!dragon) return;
            else if (newDrags.includes(dragon)) message.channel.send(`**__${dragon}:__** ${dragon} is a new release, so this information may not be available yet. Try again later, or check out <#738831348915241051> in the meantime.`);
            else if (wikiBreedingHints[dragon] && wikiBreedingHints[dragon].IsEvolution) {
                let currency, cost;
                wikiDragons[wikiDragons[dragon].Devolution].Evolutions.map(o => {if (o.Name === dragon) {currency = o.CostType; cost = o.Cost;}});
                message.channel.send(`**__${dragon}:__**\n**Hint:** ${wikiBreedingHints[dragon].Text ? wikiBreedingHints[dragon].Text : generateBreedingHint(dragon)}\n**Cost:** ${getIcon(currency)} ${cost}`);
            }
            else message.channel.send(`**${dragon}** is not obtained through evolution.`);
        } else if (cmd === 'feed') {
            if (cmdInWrongChannel(message)) return;
            let rift = args.filter((x, i, a) => {if (x.toLowerCase() === 'rift') {a.splice(i,1); return true;} else return false;}).length > 0;
            if (args.length > 2) message.channel.send("Invalid command format. Please provide the starting level and ending level (and add 'rift' if you are feeding a rift dragon).");
            else {
                let level2 = parseInt(args.pop());
                if (!Number.isInteger(level2) || level2 < 2 || level2 > 21) {
                    message.channel.send("Please specify an integer between 2 and 21 for the dragon's final level.");
                    return;
                }
                let level1 = parseInt(args.pop());
                if (!level1) level1 = 1;
                if (!Number.isInteger(level1) || level1 < 1 || level1 > 20) message.channel.send("Please specify an integer between 1 and 20 for the dragon's initial level.");
                else if (level1 >= level2) message.channel.send("The initial level needs to be below the final level.");
                else {
                    let treatsNeeded = 0;
                    for (i = level1; i < level2; i++) treatsNeeded += 4 * (rift ? riftFeeding[i-1] : 5 * Math.pow(2, i-1));
                    message.channel.send(`A total of **${treatsNeeded.toLocaleString()} treats** are required to feed a${rift ? " rift" : ""} dragon from level ${level1} to ${level2}.`);
                }
            }
        } else if (cmd === 'guide' || cmd === 'guides') {
            if (args.length == 0) {
                message.channel.send(`Available guides: \`${Object.keys(guides).join("`, `")}\``);
            } else {
                let guide = args.shift();
                if (guide in guides) message.channel.send(guides[guide]);
                else message.channel.send(`Guide \`${guide}\` not found. See a list of available guides with \`${cmdPrefix}guide\`.`);
            }
        } else if (cmd === 'image' || cmd === 'picture' || cmd === 'img' || cmd === 'pic') {
            if (cmdInWrongChannel(message)) return;
            if (args.length == 0) {
                message.channel.send(`Usage: \`${cmdPrefix}image <dragon> <adult|juvenile|baby|egg> [qualifier]\` - get a PNG image of the dragon; defaults to adult if no stage specified; valid qualifiers can be listed using \`d!image flags\`  (aliases: \`picture\`, \`img\`, \`pic\`)`);
                return;
            } else if (args[0].toLowerCase() === 'flags') {
                message.channel.send("All currently available image flags (note that no flags are applicable to every dragon; if no flag is specified, the normal/day form is assumed): `normal`, `day`, `night`, `organic`/`conjured` (spellforms), `enhanced`/`nightEnhanced` (rave set), `charlatan`/`scourge`/`barbarous`/`macabre` (eldritch), `hiding`, `summer`/`autumn`/`winter`/`spring` (seasonal), `snowman` (snowball), `wrapped` (giddle), `bush` (dargon)");
                return;
            }
            const ages = ['baby', 'juvenile', 'adult', 'elder', 'egg'];
            const forms = ["normal", "day", "night", "organic", "conjured", "enhanced", "nightenhanced", "charlatan", "scourge", "barbarous", "macabre", "hiding", "summer", "autumn", "winter", "spring", "snowman", "wrapped", "bush"];
            let age = args.filter((x, i, a) => {if (i > 0 && ages.includes(x.toLowerCase())) {a.splice(i,1); return true;} else return false;});
            age = age.length > 0 ? prettyString(age, '') : "Adult";
            let form = args.filter((x, i, a) => {if (i > 0 && forms.includes(x.toLowerCase())) {a.splice(i,1); return true;} else return false;});
            form = form.length > 0 ? prettyString(form, '') : "";
            let dragon = parseDragon(args, message);
            if (!dragon) return;
            let url = generateImageLink(dragon, age, form, message);
            if (!url) return;
            message.channel.send(url);
            // let url = calculateURL(`${dragon.replace(/ /g, "")}DragonAdult.png`);
            // let file = new AttachmentBuilder(url);
            // message.channel.send({files: [file]});
        } else if (cmd === 'info') {
            if (cmdInWrongChannel(message)) return;
            let dragon = parseDragon(args, message);
            if (!dragon) return;
            let dInfo = wikiDragons[dragon];
            let desc = dInfo.Description.replace(/<br\s*[\/]?>/gi, '\n');
            let rarity = dInfo.Rarity;
            let releaseDate = dInfo.ReleaseDate.split("#");
            let timer = 0;
            let timeStr = wikiDragons[dragon].BreedingTime.replace(/\s{2,}/g, ' ').split(" ");
            if (timeStr.length > 1) for (i = 1; i < timeStr.length; i++) {
                switch (timeStr[i]) {
                    case 'H':
                        timer += 3600 * parseInt(timeStr[i-1]);
                        break;
                    case 'M':
                        timer += 60 * parseInt(timeStr[i-1]);
                        break;
                    case 'S':
                        timer += parseInt(timeStr[i-1]);
                        break;
                }
            }
            let quest = Object.keys(questTable).filter(x => questTable[x].dragon === dragon);
            quest = quest[0] ? questTable[quest[0]].proper : "N/A";
            let availability = getAvailability(dragon);
            let isAvailable = !availability ? 0 : availability === 'permanent' ? -1 : 1;
            let embed = new EmbedBuilder()
                .setColor(rarity === 'Rare' ? 0x009FFF : rarity === 'Epic' ? 0xBF00FF : rarity === 'Gemstone' ? 0xFF7F00 : rarity === 'Galaxy' ? 0x00FFFF : 0xBFBFBF)
                .setTitle(`${dragon} Dragon`)
                .setThumbnail(`https://dvboxcdn.com/dragons/${dragon.replace(/ /g, '_').replace("_&", "")}.png`)
                .setDescription(desc.length <= 500 ? `*${desc}*` : `*${desc.substring(0, 500)}...*`)
                .addFields(
                    {name: 'Purchase Price', value: (isAvailable > 0 && availability.currency.length > 0) ? `${getIcon(availability.currency)} ${availability.cost}` : dInfo.BuyCurrency ? `${getIcon(dInfo.BuyCurrency)} ${dInfo.BuyPrice}` : "N/A", inline: true},
                    {name: 'Profile Elements', value: `${dInfo.Elements.map(x => getIcon(x)).join('')}`, inline: true},
                    {name: 'Breeding Elements', value: `${dInfo.BreedingElements ? dInfo.BreedingElements.map(x => getIcon(x)).join('') : dInfo.Elements.map(x => getIcon(x)).join('')}`, inline: true},
                )
                .addFields({name: `${(wikiBreedingHints[dragon] && wikiBreedingHints[dragon].IsEvolution) ? "Evolution" : "Breeding"} Hint`, value: `${wikiBreedingHints[dragon] ? (wikiBreedingHints[dragon].Text ? wikiBreedingHints[dragon].Text : generateBreedingHint(dragon)) : "N/A"}`})
                .addFields({name: 'Availability', value: isAvailable < 0 ? ":white_check_mark: Always available" : isAvailable > 0 ? `:white_check_mark: Available until **${availability.countdown}** ${!availability.isBreedable ? "(but __NOT__ through breeding!)" : ""}` : ":prohibited: Currently unavailable"})
                .addFields(
                    {name: 'Unlocks at Level', value: `${dInfo.LevelRequirement}`, inline: true},
                    {name: 'Normal Timer', value: `${fmt_dhms(timer)}`, inline: true},
                    {name: 'Upgraded Timer', value: `${fmt_dhms(Math.ceil(timer * 0.8))}`, inline: true},
                )
                .addFields(
                    {name: 'Quest', value: quest, inline: true},
                    {name: 'Hatch XP', value: `${dInfo.HatchExperience}`, inline: true},
                    {name: 'Sell Price', value: `${getIcon(dInfo.SellCurrency)} ${dInfo.SellPrice}`, inline: true}
                )
                .addFields({name: 'Goal', value: dInfo.Goal ? dInfo.Goal : "N/A"})
                .setFooter({text: `Released on ${releaseDate[0].trim()} as dragon #${releaseDate[1]}`});
            message.channel.send({embeds: [embed]});
        } else if (cmd === 'odds' || cmd === 'chances' || cmd === 'percents') {
            if (cmdInWrongChannel(message)) return;
            let dragon = parseDragon(args, message);
            if (!dragon) return;
            if (dragon in oddsCache) message.channel.send(oddsCache[dragon]);
            else {
                let msgRef = await message.channel.send("Fetching data from the DV Compendium, please wait a moment... (this message will be edited once the content is ready)");
                httpsFR.get(`https://script.google.com/macros/s/AKfycbwvFX3FtYmAr4nsPcpXsGyEqrX7jC8y8sqguX9GMgLDyXdBBn7Sa300GGO3vR9pFV0k-g/exec?dragon=${dragon}`, (res) => {
                    if (res.statusCode != 200) {
                        msgRef.edit("The Compendium returned an unexpected error. Please try again, or wait a bit if the problem persists (and if it keeps happening, contact staff).");
                        return;
                    }
                    let body = [];
                    res.on('data', (chunk) => body.push(chunk)).on('end', () => {
                        try {
                            response = JSON.parse(body)[0];
                            pattern = /(\d{1,2}(?:\.\d{1,2})?|\?)%(?: \((\d{1,2}(?:\.\d{1,2})?|\?)%\))?/;
                            breed = response["Breed Chance"] ? response["Breed Chance"].match(pattern) : undefined;
                            normal = response["Normal Clone"].match(pattern);
                            social = response["Social Clone"].match(pattern);
                            rift = response["Rift Clone"].match(pattern);

                            oddsObj = {
                                breedFirst: breed ? breed[1] : undefined, // default rate
                                breedAgain: breed ? breed[2] : undefined, // only some dragons have this
                                baseSingle: normal[1], // single clone in normal cave/ebi
                                baseDouble: normal[2], // double clone in normal cave/ebi
                                coopSingle: social[1], // single clone in coop cave
                                coopDouble: social[2], // double clone in coop cave
                                riftSingle: rift[1], // single clone in rift cave
                                riftDouble: rift[2]  // double clone in rift cave
                            };

                            oddsMsg = `**__${dragon} breeding odds:__**\n`
                                        + `__Base chance:__ **${oddsObj.breedFirst ? `${oddsObj.breedFirst}%`: "N/A"}** ${oddsObj.breedAgain ? `(if unowned) OR **${oddsObj.breedAgain}%** (if owned)` : ``}\n`
                                        + `__Normal cloning:__ **${oddsObj.baseSingle}%** (single); **${oddsObj.baseDouble}%** (double)\n`
                                        + `__Social cloning:__ **${oddsObj.coopSingle}%** (single); **${oddsObj.coopDouble}%** (double)\n`
                                        + `__Rift cloning:__ **${oddsObj.riftSingle}%** (single); **${oddsObj.riftDouble}%** (double)\n`
                                        + `This data is sourced from the DV Compendium. Check it out for more data and simulation options!`;
                            
                            oddsCache[dragon] = oddsMsg;

                            msgRef.edit(oddsMsg);
                        } catch (err) {
                            console.log(err);
                            msgRef.edit(`Error: the DV Compendium did not return data for ${dragon} (if it's a brand new dragon, it may not have been added to the Compendium yet!).`);
                        }
                    });
                });
            }
        } else if (cmd === 'parent' || cmd === 'parents' || cmd === 'combo') {
            if (cmdInWrongChannel(message)) return;
            let includeClone = args.filter((x, i, a) => {if (x.toLowerCase() === 'noclone') {a.splice(i,1); return true;} else return false;}).length == 0;
            const caves = ['normal', 'fast', 'coop', 'social', 'cooperative', 'rift', 'runic'];
            let cave = args.filter((x, i, a) => {
                if (caves.includes(x.toLowerCase())) {
                    if (x.toLowerCase() === 'rift' && isPrimary(prettyString(a.slice(Math.max(0, i-1), i+1), ' '))) return false;
                    a.splice(i,1);
                    return true;
                } else return false;
            });
            cave = cave.length > 0 ? cave[0].toLowerCase() : 'normal';
            if (cave === 'fast') cave = 'upgraded';
            else if (cave === 'social' || cave == 'coop') cave = 'cooperative';
            let dragon = parseDragon(args, message);
            if (!dragon) return;
            else if (dragon in comboCache[includeClone ? "clone" : "no_clone"][cave]) message.channel.send(comboCache[includeClone ? "clone" : "no_clone"][cave][dragon]);
            else {
                var msgRef = await message.channel.send("Fetching data from DVBox, please wait a moment... (this message will be edited once the content is ready)");
                let d_fmt = dragon.replace(/ /g, "_").replace("_&", "").toLowerCase();
                // query that INCLUDES cloning
                https.get(`https://dvbox.bin.sh/api-v1/parents.cgi?dragon=${d_fmt}&cave=${cave}&limit=10`, (res) => {
                    console.log(`Received ${res.statusCode} status code for DVBox request`);
                    var body = [];
                    res.on('data', (chunk) => {
                        body.push(chunk);
                    }).on('end', () => {
                        body = Buffer.concat(body).toString();
                        json = JSON.parse(body);
                        json = json.filter(combo => combo.d1 != null);
                        if (json.length > 0) {
                            let k = 1;
                            let cloneEmbed = new EmbedBuilder()
                                .setColor(0xFF00FF)
                                .setTitle(`Top 10 breeding combos for __${dragon}__ in the ${cave} cave (*includes* cloning):`)
                                .addFields(json.slice(0, 10).map(combo => ({
                                        name: `${k++}. ${combo.odds}% - ${combo.d1} Dragon x ${combo.d2} Dragon`,
                                        value: `${combo.offspring} possible results | ${combo.time_fmt} average breed time`
                                    }))
                                );
                            comboCache.clone[cave][dragon] = {content: "The following information is provided by the DragonVale Sandbox. Be sure to thank them!", embeds: [cloneEmbed]};
                            if (includeClone) msgRef.edit(comboCache.clone[cave][dragon]);
                        } else {
                            let returnMsg = `ERROR: DVBox reports no possible combinations that will result in ${dragon} in the ${cave} cave at this time. This could be due to cave restrictions or attempting to breed outside the dragon's period of availability.`;
                            msgRef.edit(returnMsg);
                            comboCache.clone[cave][dragon] = returnMsg;
                            comboCache.no_clone[cave][dragon] = returnMsg;
                        }
                    });
                });
                // query that EXCLUDES cloning
                https.get(`https://dvbox.bin.sh/api-v1/parents.cgi?dragon=${d_fmt}&cave=${cave}&limit=10&novel=1`, (res) => {
                    console.log(`Received ${res.statusCode} status code for DVBox request`);
                    var body = [];
                    res.on('data', (chunk) => {
                        body.push(chunk);
                    }).on('end', () => {
                        body = Buffer.concat(body).toString();
                        json = JSON.parse(body);
                        json = json.filter(combo => combo.d1 != null);
                        if (json.length > 0) {
                            let k = 1;
                            let noCloneEmbed = new EmbedBuilder()
                                .setColor(0xFF00FF)
                                .setTitle(`Top 10 breeding combos for __${dragon}__ in the ${cave} cave (*excludes* cloning):`)
                                .addFields(json.slice(0, 10).map(combo => ({
                                        name: `${k++}. ${combo.odds}% - ${combo.d1} Dragon x ${combo.d2} Dragon`,
                                        value: `${combo.offspring} possible results | ${combo.time_fmt} average breed time`
                                    }))
                                );
                            comboCache.no_clone[cave][dragon] = {content: "The following information is provided by the DragonVale Sandbox. Be sure to thank them!", embeds: [noCloneEmbed]};
                            if (!includeClone) msgRef.edit(comboCache.no_clone[cave][dragon]);
                        } else {
                            let returnMsg = `According to DVBox, it is not possible to obtain ${dragon} in the ${cave} cave without parent breeding at this time.`;
                            if (!includeClone) msgRef.edit(returnMsg);
                            // is already set if there are no valid combos even with parent breeding, so don't overwrite that message
                            if (!(dragon in comboCache.no_clone[cave])) comboCache.no_clone[cave][dragon] = returnMsg;
                        }
                    });
                });
            }
        } else if (cmd === 'quest') {
            if (cmdInWrongChannel(message)) return;
            var questname = prettyString(args, " ");
            if (!questname) message.channel.send("You must give me a quest name to look for!");
            else {
                let answer = questTable[questname.replace('…', '...').toLowerCase()];
                if (answer) message.channel.send(`Use **${answer.dragon}** to complete the quest "${answer.proper}"`);
                else message.channel.send(`"${questname}" is not a recognized quest name (did you type it correctly?)`);
            }
        } else if (cmd === 'rates') {
            if (cmdInWrongChannel(message)) return;
            let boosts = 0;
            args.filter((x, i, a) => {if (['b', 'boost', 'boosts'].includes(x.toLowerCase())) {boosts = a[i+1]; a.splice(i, 2); return true;} else return false});
            boosts = parseInt(boosts);
            if (!Number.isInteger(boosts) || boosts < 0) {
                message.channel.send('Please enter a positive integer for the number of boosts.');
                return;
            }
            let gens = 0;
            args.filter((x, i, a) => {if (['g', 'gen', 'gens', 'generator', 'generators'].includes(x.toLowerCase())) {gens = a[i+1]; a.splice(i, 2); return true;} else return false});
            gens = parseInt(gens);
            if (!Number.isInteger(gens) || gens < 0) {
                message.channel.send('Please enter a positive integer for the number of generators.');
                return;
            }
            let rift = args.filter((x, i, a) => {if (x.toLowerCase() === 'rift' && !isPrimary(prettyString(a.slice(Math.max(0, i-1), i+1), ' '))) {a.splice(i,1); return true;} else return false;}).length > 0;
            let dragon = parseDragon(args, message);
            if (!dragon) return;
            let maxBoosts = getMaxBoosts(dragon);
            let multiplier = maxBoosts[1];
            maxBoosts = maxBoosts[0];
            boosts = Math.min(boosts, maxBoosts);
            multiplier = Math.min(0.3 * boosts, multiplier);
            if (!rift) {
                if (!wikiDragons[dragon].Elements.includes('Gemstone') && !wikiDragons[dragon].Elements.includes('Crystalline')) {
                    let rates = [];
                    let s = compEarnRates[dragon];
                    let b = 1 + multiplier + 0.02*gens;
                    let getRate = (L) => Math.floor(6000 / Math.floor(Math.floor(s / (0.6*L + 0.4)) / b));
                    for (i = 1; i <= (elders.includes(dragon) ? 21 : 20); i++) {rates[i-1] = getRate(i); if (rates[i-1] == Infinity) rates[i-1] = 0;}
                    let table = "```| Lvl : DC/min | Lvl : DC/min |"
                            + "\n|-----:--------|-----:--------|";
                    for (i = 0; i < 10; i++) {
                        table += `\n| ${sprintf('%-4d', (i+1))}:${sprintf('%7s', rates[i])} | ${sprintf('%-4d', (i+11))}:${sprintf('%7s', rates[i+10])} |`;
                    }
                    if (rates.length == 21) table += `\n|              | 21  :${sprintf('%7s', rates[20])} |`;
                    table += "```";
                    message.channel.send(`**__${dragon}:__**\n${getIcon('dragoncash')} DragonCash earning rates with ${boosts}/${maxBoosts} boosts and ${gens} generators:\n${table}\nNOTE: your dragon's profile will likely show a lower number than what's in this table. That number is wrong (this has been experimentally proven). The numbers here are the *actual* earning rates.`);
                } else {
                    let rates = wikiEarnRates[dragon].Rates;
                    let table = "```| Lvl : Gem/mo | Lvl : Gem/mo |"
                            + "\n|-----:--------|-----:--------|";
                    for (i = 0; i < 5; i++) {
                        table += `\n| ${sprintf('%-4d', (i+1))}:${sprintf('%7s', rates[i])} | ${sprintf('%-4d', (i+6))}:${sprintf('%7s', rates[i+5])} |`;
                    }
                    table += "```";
                    message.channel.send(`**__${dragon}:__**\n${getIcon('gems')} Gem earning rates (per month basis):\n${table}`);
                }
            } else {
                if (dragon.includes('Ghostly')) message.channel.send('Ghostly dragons do not generate etherium as they cannot be displayed in the rift.');
                else if (!wikiDragons[dragon].Elements.includes('Gemstone') && !wikiDragons[dragon].Elements.includes('Crystalline')) {
                    let rates = [];
                    if (wikiEthEarnRates[dragon]) rates = wikiEthEarnRates[dragon].Rates;
                    else for (i = 1; i <= 20; i++) rates[i-1] = ['Epic', 'Gemstone'].includes(wikiDragons[dragon].Rarity) ? 1.5*i : i;
                    let table = "```| Lvl : Eth/hr | Lvl : Eth/hr |"
                            + "\n|-----:--------|-----:--------|";
                    for (i = 0; i < 10; i++) {
                        table += `\n| ${sprintf('%-4d', (i+1))}:${sprintf('%7s', rates[i])} | ${sprintf('%-4d', (i+11))}:${sprintf('%7s', rates[i+10])} |`;
                    }
                    table += "```";
                    message.channel.send(`**__${dragon}:__**\n${getIcon('etherium')} Etherium earning rates:\n${table}`);
                } else {
                    let table = "```| Lvl : Eth/hr | Lvl : Eth/hr |"
                            + "\n|-----:--------|-----:--------|";
                    for (i = 1; i <= 5; i++) {
                        table += `\n| ${sprintf('%-4d', (i))}:${sprintf('%7s', i * 1.5)} | ${sprintf('%-4d', (i+5))}:${sprintf('%7s', (i+5) * 1.5)} |`;
                    }
                    table += "```";
                    message.channel.send(`**__${dragon}:__**\n${getIcon('etherium')} Etherium earning rates:\n${table}`);
                }
            }
        } else if (cmd === 'result' || cmd === 'results' || cmd === 'fakeouts') {
            if (cmdInWrongChannel(message)) return;

            if (args.length === 0) {
                message.channel.send(`Usage: \`${cmdPrefix}result <dragon1>,<dragon2> <d:hh:mm:ss|hh:mm:ss> [fast|runic]\``);
                return;
            }
            const caves = ['normal', 'fast', 'coop', 'social', 'cooperative', 'runic'];
            let cave = args.filter((x, i, a) => {
                if (caves.includes(x.toLowerCase())) {
                    a.splice(i,1);
                    return true;
                } else return false;
            });
            cave = cave.length > 0 ? cave[0].toLowerCase() : 'normal';
            if (cave === 'fast') cave = 'upgraded';
            else if (cave === 'social' || cave == 'coop') cave = 'cooperative';

            let days = 0, hrs = 0, mins = 0, secs = 0;
            const timerPattern = /\s(\d+\s?d)?\s?(\d+\s?h)?\s?(\d+\s?m)?\s?(\d+\s?s)?\s/;
            let times = (args.join(' ') + " ").match(timerPattern);
            if (times) {
                days = parseInt(times[1] ? times[1].slice(0,-1).trim() : 0);
                hrs = parseInt(times[2] ? times[2].slice(0,-1).trim() : 0);
                mins = parseInt(times[3] ? times[3].slice(0,-1).trim() : 0);
                secs = parseInt(times[4] ? times[4].slice(0,-1).trim() : 0);
                args = (args.join(' ') + " ").replace(times[0], '').split(' ');
            } else {
                times = args.pop().split(":");
                if (times.length < 3 || times.length > 4) {
                    message.channel.send("Your timer could not be parsed. Please write the timer as either `d:hh:mm:ss` or `##d ##h ##m ##s`.");
                    return;
                } else {
                    if (times.length == 4) days = parseInt(times[times.length - 4]);
                    hrs = parseInt(times[times.length - 3]);
                    mins = parseInt(times[times.length - 2]);
                    secs = parseInt(times[times.length - 1]);
                }
            }
            
            if (isNaN(days) || isNaN(hrs) || isNaN(mins) || isNaN(secs)) {
                message.channel.send("Your timer could not be parsed. Please write the timer as either `d:hh:mm:ss` or `##d ##h ##m ##s`.");
                return;
            }
            var timeInt = (secs + (60 * mins) + (3600 * hrs) + (86400 * days));// * (runic ? 4 : 1);
            var timer = fmt_dhms(timeInt);

            var parents = args.join(" ").split(",");
            if (parents.length != 2) message.channel.send("You must specify 2 dragons for the parents.");
            else {
                var d1 = parseDragon(parents[0].trim().split(" "), message);
                var d2 = parseDragon(parents[1].trim().split(" "), message);
                if (!d1 || !d2) return;
                var msgRef = await message.channel.send("Fetching data from DVBox, please wait a moment... (this message will be edited once the content is ready)");
                
                resultsMsg = () => {
                    var resultsList = dvboxCache[cave][`${d1}|${d2}`];

                    if (resultsList.error) {
                        msgRef.edit("ERROR: DVBox does not recognize one of the dragons you listed. If you're querying with a newly released dragon, please allow some time for DVBox to update and try again later, or try a different query.");
                        return;
                    } 
                    if (resultsList.length == 0) {
                        msgRef.edit("DVBox reports no possible outcomes for this breeding pair. Check to see if your parents are incompatible types (e.g. opposing elementals or non-breedable dragons).");
                        return;
                    }

                    var exactMatches = [];
                    var closeMatches = [];

                    for (i = 0; i < resultsList.length; i++) {
                        child = resultsList[i];
                        if (timeInt == child.time_sec) exactMatches.push(`**${child.name}** (${child.odds}%)`);
                        else if (Math.abs(child.time_sec - timeInt) < 120) closeMatches.push(`**${child.name}** (${child.odds}%)`);
                    }
                    let returnMsg = `__**${d1}** x **${d2}:**__\n`;
                    if (exactMatches.length > 0) returnMsg += `A timer of ${timer} when breeding in the ${cave} cave *exactly* matches: ${exactMatches.join(", ")}\n`;
                    if (closeMatches.length > 0) returnMsg += `A timer of ${timer} when breeding in the ${cave} cave *is within 2 minutes of*: ${closeMatches.join(", ")}\n`;
                    if (exactMatches.length == 0 && closeMatches == 0) returnMsg = `No matches found for timer ${timer} when breeding in the ${cave} cave.`;
                    else {
                        returnMsg += "NOTE 1: Some of the listed dragons may not be available at this time. Check the dragonarium to confirm availability.\n";
                        returnMsg += "NOTE 2: the provided odds are a relatively accurate approximation, but does not account for a few factors such as parent level. Your actual results may differ slightly.";
                    }
                    msgRef.edit(returnMsg);
                }
                
                if (`${d1}|${d2}` in dvboxCache[cave]) resultsMsg();
                else {
                    let d1_fmt = d1.replace(/ /g, "_").replace("_&", "").toLowerCase();
                    let d2_fmt = d2.replace(/ /g, "_").replace("_&", "").toLowerCase();
                    https.get(`https://dvbox.bin.sh/api-v1/breed.cgi?d1=${d1_fmt}&d2=${d2_fmt}&cave=${cave}&sort=odds-descending`, (res) => {
                        console.log(`Received ${res.statusCode} status code for DVBox request`);
                        var body = [];
                        res.on('data', (chunk) => {
                            body.push(chunk);
                        }).on('end', () => {
                            body = Buffer.concat(body).toString();
                            json = JSON.parse(body);
                            // sort first by odds descending then by name ascending
                            json.sort(dvBoxSorters.odds);
                            dvboxCache[cave][`${d1}|${d2}`] = json;
                            resultsMsg();
                        });
                    });
                }
            }
        } else if (cmd === 'sandbox' || cmd === 'dvbox' || cmd === 'sim' || cmd === 'breedsim') {
            if (cmdInWrongChannel(message)) return;
            if (args.length == 0) {
                message.channel.send("The DragonVale Sandbox (or dvbox, for short) can be found at https://dvbox.bin.sh/. Note that DVBox is fanmade and needs to be manually updated by its creator in response to changes in the game, so it may not always be fully up to date.");
                return;
            }
            const caves = ['normal', 'fast', 'coop', 'social', 'cooperative', 'rift', 'runic'];
            let cave = args.filter((x, i, a) => {
                if (caves.includes(x.toLowerCase())) {
                    if (x.toLowerCase() === 'rift' && isPrimary(prettyString(a.slice(Math.max(0, i-1), i+1), ' '))) return false;
                    a.splice(i,1);
                    return true;
                } else return false;
            });
            cave = cave.length > 0 ? cave[0].toLowerCase() : 'normal';
            if (cave === 'fast') cave = 'upgraded';
            else if (cave === 'social' || cave == 'coop') cave = 'cooperative';
            var parents = args.join(" ").split(",");
            if (parents.length != 2) message.channel.send("You must specify 2 dragons for the parents.");
            else {
                var d1 = parseDragon(parents[0].trim().split(" "), message);
                var d2 = parseDragon(parents[1].trim().split(" "), message);
                if (!d1 || !d2) return;

                let msgRef = await message.channel.send("Fetching data from DVBox, please wait a moment... (this message will be edited once the content is ready)");
                resultsMsg = async () => {
                    var resultsList = [...dvboxCache[cave][`${d1}|${d2}`]];

                    if (resultsList.error) {
                        msgRef.edit("ERROR: DVBox does not recognize one of the dragons you listed. If you're querying with a newly released dragon, please allow some time for DVBox to update and try again later, or try a different query.");
                        return;
                    } 
                    if (resultsList.length == 0) {
                        msgRef.edit("DVBox reports no possible outcomes for this breeding pair. Check to see if your parents are incompatible types (e.g. opposing elementals or non-breedable dragons).");
                        return;
                    }

                    let idNum = Date.now();
                    let prevId = `prev${idNum}`;
                    let nextId = `next${idNum}`;
                    let selectId = `select${idNum}`;

                    const btnPrev = new ButtonBuilder().setStyle(ButtonStyle.Secondary).setLabel('<').setCustomId(prevId);
                    const btnNext = new ButtonBuilder().setStyle(ButtonStyle.Secondary).setLabel(`11-${Math.min(resultsList.length, 20)} >`).setCustomId(nextId);

                    const selectSort = (defaultOption) => {
                        return new StringSelectMenuBuilder()
                        .setCustomId(selectId)
                        .addOptions(
                            new StringSelectMenuOptionBuilder()
                                .setLabel('Sort by Odds')
                                .setDescription('Sort by odds (descending), then name (alphabetical)')
                                .setValue('odds')
                                .setDefault(defaultOption === 'odds'),
                            new StringSelectMenuOptionBuilder()
                                .setLabel('Sort by Name')
                                .setDescription('Sort by name (alphabetical), then odds (descending)')
                                .setValue('name')
                                .setDefault(defaultOption === 'name'),
                            new StringSelectMenuOptionBuilder()
                                .setLabel('Sort by Timer')
                                .setDescription('Sort by timer (ascending), then odds (descending)')
                                .setValue('time')
                                .setDefault(defaultOption === 'time')
                        );
                    }

                    const generateEmbed = idx => {
                        const current = resultsList.slice(idx, idx+10);
                        
                        let k = 1;
                        return new EmbedBuilder()
                            .setColor(0x0099FF)
                            .setTitle(`Showing results ${idx+1}-${idx+current.length} out of ${resultsList.length}:`)
                            .addFields(current.map(child => ({
                                    name: `${idx + k++}. ${child.name} Dragon`,
                                    value: `Timer = ${child.time_fmt} | Odds = ${child.odds}%`
                                }))
                            );
                    }

                    let needsOnePage = resultsList.length <= 10;

                    await msgRef.edit({
                        embeds: [generateEmbed(0)],
                        components: [
                            ...(needsOnePage ? [] : [new ActionRowBuilder().addComponents(btnNext)]),
                            ...([new ActionRowBuilder().addComponents(selectSort('odds'))])
                        ]
                    })

                    const collector = msgRef.createMessageComponentCollector({filter: ({user}) => user.id === message.author.id});

                    let currentIndex = 0;
                    let currentSort = 'odds';
                    let timeToExpire = 120 * 1000;

                    let expire = setTimeout(() => {
                        msgRef.edit({embeds: [generateEmbed(currentIndex)], components: []});
                    }, timeToExpire);

                    collector.on('collect', interaction => {
                        if (interaction.customId === prevId) currentIndex -= 10;
                        else if (interaction.customId === nextId) currentIndex += 10;
                        else {
                            let newSort = interaction.values[0];
                            if (!(newSort === currentSort)) {
                                currentSort = newSort;
                                resultsList.sort(dvBoxSorters[currentSort]);
                            }
                        }
                        btnPrev.setLabel(`< ${currentIndex-9}-${currentIndex}`);
                        btnNext.setLabel(`${currentIndex+11}-${Math.min(resultsList.length, currentIndex+20)} >`);
                        interaction.update({
                            embeds: [generateEmbed(currentIndex)],
                            components: [
                                ...(needsOnePage ? [] : [new ActionRowBuilder().addComponents(currentIndex ? [btnPrev] : []).addComponents(currentIndex + 10 < resultsList.length ? [btnNext] : [] )]),
                                ...([new ActionRowBuilder().addComponents(selectSort(currentSort))])
                            ]
                        });
                        // refreshes the timeout countdown before the buttons are removed
                        clearTimeout(expire);
                        expire = setTimeout(() => {
                            msgRef.edit({embeds: [generateEmbed(currentIndex)], components: []});
                        }, timeToExpire);
                    });

                    msgRef.edit(`__**${d1}** x **${d2}:**__\n${getIcon('eom')} Breeding results in the **${cave} cave**. \nUse the buttons below the list to turn the pages and/or change the sorting order.\nNOTE: the provided odds are an accurate approximation, but does not account for a few factors such as parent level; your actual results may differ slightly. This information is provided by the DragonVale Sandbox. Be sure to thank them!`);
                    
                }
                if (`${d1}|${d2}` in dvboxCache[cave]) {
                    resultsMsg();
                } else {
                    let d1_fmt = d1.replace(/ /g, "_").replace("_&", "").toLowerCase();
                    let d2_fmt = d2.replace(/ /g, "_").replace("_&", "").toLowerCase();
                    https.get(`https://dvbox.bin.sh/api-v1/breed.cgi?d1=${d1_fmt}&d2=${d2_fmt}&cave=${cave}&sort=odds-descending`, (res) => {
                        console.log(`Received ${res.statusCode} status code for DVBox request`);
                        var body = [];
                        res.on('data', (chunk) => {
                            body.push(chunk);
                        }).on('end', () => {
                            body = Buffer.concat(body).toString();
                            json = JSON.parse(body);
                            // sort first by odds descending then by name ascending
                            json.sort(dvBoxSorters.odds);
                            dvboxCache[cave][`${d1}|${d2}`] = json;
                            resultsMsg();
                        });
                    });
                }
            }
        } else if (cmd === 'timer') {
            if (cmdInWrongChannel(message)) return;
            let dragon = parseDragon(args, message);
            if (!dragon) return;
            else {
                let timer = 0;
                let timeStr = wikiDragons[dragon].BreedingTime.replace(/\s{2,}/g, ' ').split(" ");
                if (timeStr.length > 1) for (i = 1; i < timeStr.length; i++) {
                    switch (timeStr[i]) {
                        case 'H':
                            timer += 3600 * parseInt(timeStr[i-1]);
                            break;
                        case 'M':
                            timer += 60 * parseInt(timeStr[i-1]);
                            break;
                        case 'S':
                            timer += parseInt(timeStr[i-1]);
                            break;
                    }
                }
                message.channel.send(`**__${dragon}:__** Breeds in **${fmt_dhms(timer)}** (normal/co-op cave) or **${fmt_dhms(Math.ceil(timer * 0.8))}** (upgraded cave).`);
            }
        } else if (cmd === 'uses') {
            if (cmdInWrongChannel(message)) return;
            let dragon = parseDragon(args, message);
            if (!dragon) return;
            else {
                let msg = `**__${dragon}:__**`;
                for (n in questTable) if (questTable[n].dragon === dragon) {
                    msg += `\nQuest: *${questTable[n].proper}*`;
                    break;
                }
                let usedToBreed = [];
                for (d in wikiBreedingHints) if (wikiBreedingHints[d].RequiredDragons) if (wikiBreedingHints[d].RequiredDragons.includes(dragon)) usedToBreed.push(d);
                usedToBreed.sort();
                msg += usedToBreed.length > 0 ? `\nRequired to breed: **${usedToBreed.join('**, **')}**` : "";
                if (wikiDragons[dragon].Evolutions) {
                    let evolvesInto = [];
                    for (i = 0; i < wikiDragons[dragon].Evolutions.length; i++) {
                        let o = wikiDragons[dragon].Evolutions[i];
                        evolvesInto.push(`**${o.Name}** (${getIcon(o.CostType)} ${o.Cost})`);
                    }
                    evolvesInto.sort();
                    msg += `\nEvolves into: ${evolvesInto.join(', ')}`;
                }
                message.channel.send(msg !== `**__${dragon}:__**` ? msg : `**${dragon}** is not explicitly required for anything.`);
            }
        } else if (cmd === 'wiki') {
            if (cmdInWrongChannel(message)) return;
            var dragon = prettyString(args, " ");
            if (!dragon) message.channel.send("https://dragonvale.fandom.com/wiki/DragonVale_Wiki");
            else {
                if (!dragonList.includes(dragon)) message.channel.send(`Search results for ${dragon} on the wiki can be found at: <https://dragonvale.fandom.com/wiki/Special:Search?query=${dragon.replace(/ /g, "+")}>`);
                else message.channel.send(`https://dragonvale.fandom.com/wiki/${dragon.replace(/\s\d/, "").replace(/ /g, "_")}_Dragon`);
            }
        } else if (cmd === 'help' || cmd === '') {	
            if (cmdInWrongChannel(message)) return;
            message.channel.send(helpMsg1);
            message.channel.send(helpMsg2);
        } else if (cmd === 'mod' && hasHelperAccess(message)) {
            console.log(`${message.author.tag} ran mod cmd ${message.content}`);
            const modCmd = args.shift();
            if (!modCmd) {
                let timestamps = JSON.parse(fs.readFileSync('resources/downloadtimes.json'));
                let tsStr = "";
                for (let f in timestamps) {
                    tsStr += `${f}: <t:${Math.floor(timestamps[f] / 1000)}:F>\n`;
                }
                let attach = new AttachmentBuilder('lodestoned.jpg');
                let embed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('Oracle Bot 2.0 Diagnostics')
                    .setDescription(`Use \`${cmdPrefix}mod help\` to view all available mod commands. Contact <@295625585299030016> for bugs/issues/feature requests.`)
                    .setFooter({text: 'Created by rightfootmessi | originally released on 11/10/2020'})
                    .setThumbnail('attachment://lodestoned.jpg')
                    .addFields(
                        {name: ':stopwatch: Startup Time', value: `<t:${botStartTimestamp}:F>`},
                        {name: ':scroll: Dragon List Size', value: `${dragonList.length}`},
                        {name: ':arrows_counterclockwise: Last Dragon List Backup Date', value: `<t:${lastBackupDate}:D>`},
                        {name: ':white_check_mark: Successful Resource File Downloads', value: readWikiSuccess.length > 0 ? readWikiSuccess.join(", ") : "None!"},
                        {name: ':x: Failed Resource File Downloads', value: readWikiFail.length > 0 ? readWikiFail.join(", ") : "None!"},
                        {name: ':warning: Resource File Structure Changes Detected', value: readWikiChangesDetected.length > 0 ? readWikiChangesDetected.join(", ") : "None!"},
                        {name: ':floppy_disk: Last Resource File Download Timestamps', value: tsStr},
                    );
                message.channel.send({embeds: [embed], files: [attach]});
            } else if (modCmd === 'help') {
                message.channel.send(hasModAccess(message) ? helpMsgMod : helpMsgHelper);
            } else if (modCmd === 'viewlist' && hasModAccess(message)) {
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
            } else if (modCmd === 'dragon' && hasModAccess(message)) {
                const subCmd = args.shift();
                if (subCmd === 'add') {
                    var dragon = prettyString(args, " ");
                    if (!dragon) {
                        message.channel.send("You must specify a dragon!");
                        return;
                    }
                    
                    if (dragonList.includes(dragon)) {
                        message.channel.send(`${dragon} is already in my list.`);
                        return;
                    }
        
                    dragonList.push(dragon);
                    dragonList.sort();
                    newDrags.push(dragon);
                    newDrags.sort();
                    fs.writeFile('dragonList2.json', JSON.stringify(fullData, null, 4), (err) => {
                        if (err) message.channel.send("An unexpected error occurred and the dragon list could not be updated.");
                        else message.channel.send(`${dragon} was added to my list and automatically flagged as \`new\`. If this was a mistake, type \`${cmdPrefix}mod dragon remove ${dragon}\` to remove it.`);
                    });
                } else if (subCmd === 'remove') {
                    var dragon = prettyString(args, " ");
                    if (!dragon) {
                        message.channel.send("You must specify a dragon!");
                        return;
                    }
                    
                    if (!dragonList.includes(dragon)) {
                        message.channel.send(`${dragon} is already not in my list.`);
                        return;
                    }

                    for (let list in fullData) {
                        if (fullData[list].includes(dragon)) fullData[list].splice(fullData[list].indexOf(dragon), 1);
                    }
                    fs.writeFile('dragonList2.json', JSON.stringify(fullData, null, 4), (err) => {
                        if (err) message.channel.send("An unexpected error occurred and the dragon list could not be updated.");
                        else message.channel.send(`${dragon} was removed from my lists. If this was a mistake, type \`${cmdPrefix}mod dragon add ${dragon}\` to re-add it.`);
                    });
                } 
            } else if (modCmd === 'flag' && hasModAccess(message)) {
                var flag = args.pop();
                var dragon = prettyString(args, " ");
                if (!dragon) {
                    message.channel.send("You must specify a dragon!");
                    return;
                }
                
                if (!dragonList.includes(dragon)) {
                    message.channel.send(`${dragon} is not in my lists.`);
                    return;
                }

                switch (flag) {
                    case "primaries":
                        if (primaries.includes(dragon)) {
                            message.channel.send(`${dragon} already has this flag.`);
                            return;
                        }
                        primaries.push(dragon);
                        primaries.sort();
                        break;
                    case "evolutions":
                        if (evolutions.includes(dragon)) {
                            message.channel.send(`${dragon} already has this flag.`);
                            return;
                        }
                        evolutions.push(dragon);
                        evolutions.sort();
                        break;
                    case "enhanced":
                        if (enhanced.includes(dragon)) {
                            message.channel.send(`${dragon} already has this flag.`);
                            return;
                        }
                        enhanced.push(dragon);
                        enhanced.sort();
                        break;
                    case "daynight":
                        if (dayNight.includes(dragon)) {
                            message.channel.send(`${dragon} already has this flag.`);
                            return;
                        }
                        dayNight.push(dragon);
                        dayNight.sort();
                        break;
                    case "hiding":
                        if (hiding.includes(dragon)) {
                            message.channel.send(`${dragon} already has this flag.`);
                            return;
                        }
                        hiding.push(dragon);
                        hiding.sort();
                        break;
                    case "new":
                        if (newDrags.includes(dragon)) {
                            message.channel.send(`${dragon} already has this flag.`);
                            return;
                        }
                        newDrags.push(dragon);
                        newDrags.sort();
                        break;
                    default:
                        message.channel.send("Unrecognized flag. Valid flags: `primaries`, `evolutions`, `enhanced`, `dayNight`, `hiding`, `new`");
                        return;
                }
                fs.writeFile('dragonList2.json', JSON.stringify(fullData, null, 4), (err) => {
                    if (err) message.channel.send("An unexpected error occurred and the dragon list could not be updated.");
                    else message.channel.send(`${dragon} was flagged as \`${flag}\`. If this was a mistake, type \`${cmdPrefix}mod unflag ${dragon} ${flag}\` to remove it.`);
                });
            } else if (modCmd === 'unflag' && hasModAccess(message)) {
                    var flag = args.pop();
                    var dragon = prettyString(args, " ");
                    if (!dragon) {
                        message.channel.send("You must specify a dragon!");
                        return;
                    }
                    
                    if (!dragonList.includes(dragon)) {
                        message.channel.send(`${dragon} is not in my list.`);
                        return;
                    }

                    switch (flag) {
                        case "primaries":
                            if (!primaries.includes(dragon)) {
                                message.channel.send(`${dragon} already does not have this flag.`);
                                return;
                            }
                            primaries.splice(primaries.indexOf(dragon), 1);
                            break;
                        case "evolutions":
                            if (!evolutions.includes(dragon)) {
                                message.channel.send(`${dragon} already does not have this flag.`);
                                return;
                            }
                            evolutions.splice(evolutions.indexOf(dragon), 1);
                            break;
                        case "enhanced":
                            if (!enhanced.includes(dragon)) {
                                message.channel.send(`${dragon} already does not have this flag.`);
                                return;
                            }
                            enhanced.splice(enhanced.indexOf(dragon), 1);
                            break;
                        case "daynight":
                            if (!dayNight.includes(dragon)) {
                                message.channel.send(`${dragon} already does not have this flag.`);
                                return;
                            }
                            dayNight.splice(dayNight.indexOf(dragon), 1);
                            break;
                        case "hiding":
                            if (!hiding.includes(dragon)) {
                                message.channel.send(`${dragon} already does not have this flag.`);
                                return;
                            }
                            hiding.splice(hiding.indexOf(dragon), 1);
                            break;
                        case "new":
                            if (!newDrags.includes(dragon)) {
                                message.channel.send(`${dragon} already does not have this flag.`);
                                return;
                            }
                            newDrags.splice(newDrags.indexOf(dragon), 1);
                            break;
                        default:
                            message.channel.send("Unrecognized flag. Valid flags: `primaries`, `evolutions`, `enhanced`, `dayNight`, `hiding`, `new`");
                            return;
                    }
                    fs.writeFile('dragonList2.json', JSON.stringify(fullData, null, 4), (err) => {
                        if (err) message.channel.send("An unexpected error occurred and the dragon list could not be updated.");
                        else message.channel.send(`${dragon} was unflagged as \`${flag}\`. If this was a mistake, type \`${cmdPrefix}mod flag ${dragon} ${flag}\` to re-add it.`);
                    });
            } else if (modCmd === 'getflags' && hasModAccess(message)) {
                var dragon = prettyString(args, " ");
                if (!dragon) {
                    message.channel.send("You must specify a dragon!");
                    return;
                }
                if (!dragonList.includes(dragon)) {
                    message.channel.send(`${dragon} is not in my list.`);
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
            } else if (modCmd === 'guide' && hasModAccess(message)) {
                const subCmd = args.shift();
                if (subCmd === 'add') {
                    if (args.length < 2) message.channel.send("Please specify the name and contents of the guide to add.");
                    else {
                        let gName = args.shift();
                        let numChars = args.join(" ").length;
                        let gContents = message.content.replace(/\s{2,}/g, ' ').replace(/@/g, '').slice(cmdPrefix.length).trim().slice(-numChars);
                        guides[gName] = gContents;
                        fs.writeFile('guides.json', JSON.stringify(guides, null, 4), (err) => {
                            if (err) message.channel.send("An unexpected error occurred and the guide file could not be updated.");
                            else message.channel.send(`Added guide \`${gName}\` with contents:\n\n\`${gContents}\``);
                        });
                    }
                } else if (subCmd === 'remove') {
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
                            message.channel.send(`Guide \`${gName}\` not found. See a list of available guides with \`${cmdPrefix}guide\`.`);
                        }
                    }
                } else {
                    message.channel.send(`Error: expected \`add\` or \`remove\`, but got \`${subCmd}\``);
                }
            } else if (modCmd === 'qotd' && hasModAccess(message)) {
                let subCmd = args.shift();
                let qotdData = JSON.parse(fs.readFileSync('qotdlist.json'));
                if (subCmd === 'viewlist') {
                    let response = "Pending QOTDs:\n";
                    let idx = 0;
                    while (qotdData.queue.length > 0) {
                        let next = qotdData.queue.shift();
                        let nextLine = `**#${qotdData.num++} (pos ${idx++}):** ${next.question} *[asked by ${next.asker}${next.anon ? " anonymously" : ""}]*\n`
                        if (response.length + nextLine.length > 2000) {
                            message.channel.send(response);
                            response = nextLine;
                        }
                        else response += nextLine;
                    }
                    message.channel.send(response);
                } else if (subCmd === 'add') {
                    if (args.length <= 3) {
                        message.channel.send(`Too few arguments! \`${cmdPrefix}mod qotd add <position> <asker> <anon> <question>\``);
                        return;
                    }
                    let pos = parseInt(args.shift());
                    if (!Number.isInteger(pos) || pos < 0) {
                        message.channel.send("Position should be a nonnegative integer!");
                        return;
                    } else if (pos > qotdData.queue.length) pos = qotdData.queue.length;
                    let asker = args.shift();
                    if (asker === "null") asker = null;
                    // TODO verify valid user ID?
                    let anon = args.shift();
                    console.log(`anon = ${anon}`);
                    if (anon != "true" && anon != "false") {
                        message.channel.send(`Please indicate with either \`true\` or \`false\` whether the question was asked anonymously (if asker is null, it doesn't matter what you put).\nCommand usage: \`${cmdPrefix}mod qotd <viewlist/add/remove> <position> <asker> <anon> <question>\``);
                        return;
                    } else {
                        anon = anon === "true";
                    }
                    let numChars = args.join(" ").length;
                    let qContents = message.content.replace(/\s{2,}/g, ' ').replace(/@/g, '').slice(cmdPrefix.length).trim().slice(-numChars);
                    qObj = {
                        question: qContents,
                        asker: asker,
                        anon: anon
                    };
                    console.log(qotdData.queue.length);
                    qotdData.queue.splice(pos, 0, qObj);
                    console.log(qotdData.queue.length);
                    fs.writeFile('qotdlist.json', JSON.stringify(qotdData, null, 4), (err) => {
                        if (err) message.channel.send("An unexpected error occurred and the QOTD file could not be updated.");
                        else {
                            message.channel.send(`Added new QOTD at position ${pos} (#${qotdData.num + pos}) in queue: "${qContents}" *(asked by ${asker}, with anon = ${anon})*\n\nConfirm the new queue is correct using \`${cmdPrefix}mod qotd viewlist\`.`);
                            qotd_worker.postMessage({cmd: 'loadfile'});
                        }
                    });
                } else if (subCmd === 'remove') {
                    if (args.length < 1) {
                        message.channel.send("Error: please specify the position (0-indexed) of the QOTD to be removed!");
                    } else {
                        let pos = parseInt(args.shift());
                        if (!Number.isInteger(pos) || pos < 0) {
                            message.channel.send("Error: position should be a nonnegative integer!");
                            return;
                        } else if (pos >= qotdData.queue.length) {
                            message.channel.send(`Error: position ${pos} is out of the queue boundaries!`);
                        } else {
                            console.log(qotdData.queue.length);
                            let removed = qotdData.queue.splice(pos, 1)[0];
                            console.log(qotdData.queue.length);
                            fs.writeFile('qotdlist.json', JSON.stringify(qotdData, null, 4), (err) => {
                                if (err) message.channel.send("An unexpected error occurred and the QOTD file could not be updated.");
                                else {
                                    message.channel.send(`Removed QOTD at position ${pos} from queue: "${removed.question}" *(asked by ${removed.asker}, with anon = ${removed.anon})*\n\nConfirm the new queue is correct using \`${cmdPrefix}mod qotd viewlist\`.`);
                                    qotd_worker.postMessage({cmd: 'loadfile'});
                                }
                            });
                        }
                    }
                } else if (subCmd === 'edit') {
                    if (args.length <= 1) {
                        message.channel.send(`Too few arguments! \`${cmdPrefix}mod qotd edit <position> <question>\``);
                    } else {
                        let pos = parseInt(args.shift());
                        if (!Number.isInteger(pos) || pos < 0) {
                            message.channel.send("Error: position should be a nonnegative integer!");
                            return;
                        } else if (pos >= qotdData.queue.length) {
                            message.channel.send(`Error: position ${pos} is out of the queue boundaries!`);
                        } else {
                            let numChars = args.join(" ").length;
                            let qContents = message.content.replace(/\s{2,}/g, ' ').replace(/@/g, '').slice(cmdPrefix.length).trim().slice(-numChars);
                            let qObj = qotdData.queue[pos];
                            let oldQ = qObj.question;
                            qObj.question = qContents;
                            qotdData.queue[pos] = qObj;
                            fs.writeFile('qotdlist.json', JSON.stringify(qotdData, null, 4), (err) => {
                                if (err) message.channel.send("An unexpected error occurred and the QOTD file could not be updated.");
                                else {
                                    message.channel.send(`Edited QOTD at position ${pos} in queue: Old question was "${oldQ}"; new question is "${qContents}"\n\nConfirm the new queue is correct using \`${cmdPrefix}mod qotd viewlist\`.`);
                                    qotd_worker.postMessage({cmd: 'loadfile'});
                                }
                            });
                        }
                    }
                } else {
                    message.channel.send(`Command usage: \`${cmdPrefix}mod qotd <viewlist/add/edit/remove> <position> <asker> <anon> <question>\``);
                }
            } else if (modCmd === 'clearcache' && hasModAccess(message)) {
                wikiBreedingHints = {};
                wikiDragons = {};
                wikiEarnRates = {};
                wikiEthEarnRates = {};
                wikiLimited = {};
                questTable = {};
                compEarnRates = {};
                
                dvboxCache = {
                    normal: {},
                    upgraded: {},
                    cooperative: {},
                    rift: {},
                    runic: {}
                };
                comboCache = {
                    clone: {
                        normal: {},
                        upgraded: {},
                        cooperative: {},
                        rift: {},
                        runic: {}
                    },
                    no_clone: {
                        normal: {},
                        upgraded: {},
                        cooperative: {},
                        rift: {},
                        runic: {}
                    }
                };
                oddsCache = {};

                readWikiSuccess = [];
                readWikiFail = [];
                loadWikiData();
                message.channel.send("Clearing caches and redownloading all resources. This may take a few seconds!");
            } else if (modCmd === 'dljson' && hasModAccess(message)) {
                message.author.send({content: "Here is my current `dragonList2.json` file.", files: ["./dragonList2.json"]});
            } else if (modCmd === 'purge' && hasModAccess(message)) {
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
            } else if (modCmd === 'cleanthread' && hasModAccess(message)) {
                // Removes inactive members from thread
                // Pass in thread by ID
                if (args.length == 0) {
                    message.channel.send("Please specify of the channel ID of the thread/forum post.");
                    return;
                }
                let threadId = args[0];
                let days = 30;
                let shouldList = false;
                let shouldRemove = false;
                if (args.length > 1) {
                    if (!isNaN(parseInt(args[1]))) days = parseInt(args[1]); // only sets if not NaN
                    console.log(`parse = ${parseInt(args[1])} => days = ${days}`);
                    if (days == 0 || days == NaN) days = 30; // just in case
                    shouldList = args.includes('list');
                    shouldRemove = args.includes('remove');
                }
                // Get all members of thread
                let thread = message.guild.channels.cache.get(threadId);
                if (thread) {
                    if (thread.isThread()) {
                        message.channel.send(`Checking for inactive users in ${thread.name} over the last ${days} days. Flags: list=${shouldList}, remove=${shouldRemove}`);
                        // For each member:
                        // - get last message
                        // - if message was sent >30 days ago, remove user from thread
                        let threadMems = await thread.members.fetch();
                        let time = new Date();
                        time.setDate(time.getDate() - days);
                        msgs = await getThreadMsgsAfterDate(thread, time);
                        let idsFound = new Set();
                        msgs.forEach((obj) => {
                            idsFound.add(obj.author);
                        });
                        console.log(`Found ${idsFound.size} unique users in ${msgs.length} messages`);
                        let notInMostRecent = [];
                        threadMems.each(mem => {
                            if (!idsFound.has(mem.id)) {
                                if (mem.user && !mem.user.bot) {
                                    if (!isStaffMember(mem.guildMember)) notInMostRecent.push(mem);
                                }
                            }
                        });
                        message.channel.send(`${notInMostRecent.length}/${threadMems.size} thread members sent no messages in the thread in the past ${days} days.`);
                        if (shouldList) {
                            let dmToMod = `Here are the usernames of all ${notInMostRecent.length} members of thread "${thread.name}" who have not sent a message in it in over ${days} days:`;
                            notInMostRecent.forEach(mem => {
                                dmToMod += `\n\`${mem.user.username}\``;
                            });
                            message.channel.send(dmToMod);
                        }
                        if (shouldRemove) {
                            thread.send(`NOTICE: Cleaning the thread member list. Removing ${notInMostRecent.length} users who have not sent a message here in the past ${days} days. Apologies in advance for the spam! <:dv_owobowos:803676880850780160>`);
                            notInMostRecent.forEach(async (mem) => {
                                await mem.remove(`Removed from thread: "${thread.name}" for inactivity. Please rejoin if you wish to continue using it.`);
                            });
                        }
                    } else {
                        message.channel.send(`ID ${threadId} is for channel \`${thread.name}\`, which is not a thread!`);
                    }
                } else message.channel.send(`Did not find a channel/thread with ID ${threadId}`);
            } else if (modCmd === 'pin') {
                if (args.length == 0) {
                    let failMsg = await message.channel.send("Please specify of the ID of the message to pin.");
                    await sleep(3000);
                    failMsg.delete();
                    return;
                }
                let msgMgr = message.channel.messages;
                let msgId = args[0].split('/').at(-1).trim();
                msgMgr.fetchPinned().then(pins => {
                    msgMgr.fetch(msgId).then(async msgToPin => {
                        if (pins.size >= 50) {
                            message.channel.send("ERROR: Cannot pin that message as the channel pin limit has been reached.");
                        } else if (pins.get(msgId)) {
                            let failMsg = await message.channel.send("ERROR: That message is already pinned!");
                            await sleep(3000);
                            message.delete();
                            failMsg.delete();
                        } else {
                            msgMgr.pin(msgToPin).then(async () => {
                                let successMsg = await message.channel.send("Successfully pinned message!");
                                await sleep(3000);
                                message.delete();
                                successMsg.delete();
                            })
                        }
                    }).catch(error => {
                        message.channel.send("ERROR: No message found with that ID.");
                    });
                });
            } else if (modCmd === 'unpin') {
                if (args.length == 0) {
                    let failMsg = await message.channel.send("Please specify of the ID of the message to unpin.");
                    await sleep(3000);
                    failMsg.delete();
                    return;
                }
                let msgMgr = message.channel.messages;
                let msgId = args[0].split('/').at(-1).trim();
                msgMgr.fetchPinned().then(pins => {
                    msgMgr.fetch(msgId).then(async msgToPin => {
                        if (!pins.get(msgId)) {
                            let failMsg = await message.channel.send("ERROR: That message is not pinned.");
                            await sleep(3000);
                            message.delete();
                            failMsg.delete();
                        } else {
                            msgMgr.unpin(msgToPin).then(async () => {
                                let successMsg = await message.channel.send("Successfully unpinned message!");
                                await sleep(3000);
                                message.delete();
                                successMsg.delete();
                            })
                        }
                    }).catch(error => {
                        message.channel.send("ERROR: No message found with that ID.");
                    });
                });
            } else {
                message.channel.send(`Unknown mod command and/or permissions error. Type \`${cmdPrefix}mod help\` for a list of available commands.`);
            }
        }
        // meme commands below
        else if (cmd === 'aurora') {
            message.channel.send({files: ['aurora.gif']});
        } else if (cmd === 'ban') {
            let victim = args.join(" ");
            if (!victim) {
                message.channel.send('Tell me who to ban!');
                return;
            } else if (victim.toLowerCase() === 'oracle' || victim.toLowerCase() === '<775382842670055425>') {
                message.channel.send("You're walking a fine line buddy <:a:976511138902728744>");
                return;
            } else {
                // parse mentions
                const mentionPattern = /<!?(\d+)>/;
                let men = victim.match(mentionPattern);
                if (men) {
                    // let userId = men[1];
                    let nickname = client.users.cache.get(men[1]).username;
                    victim = victim.replace(men[0], nickname);
                }
            }
            const banResponses = [
                `${victim} was banned successfully!`,
                "Yes.",
                `${victim} was given up, let down, run around, and deserted!`,
                `${victim}'s next breed in each cave will all be rainbows!`,
                "Instructions unclear, banned you instead!",
                "<:a:1274540545233911860>",
                "Consider it done chief!",
                "Sentenced to death",
            ];
            message.channel.send(banResponses[Math.floor(Math.random() * banResponses.length)]);
        } else if (cmd === 'lodestoned') {
            message.channel.send({files: ["lodestoned.jpg"]});
        } else if (cmd === 'pet') {
            let rand = Math.random();
            message.channel.send(rand < 0.79 ? "thank <:dv_ikastarko:870846746190831677>" : rand < 0.94 ? "no u <:dv_epochnou:794321854042734602>" : rand < 0.99 ? "fite me <:dv_ikatastrophe:870846763173552158>" : "you thought it was oracle but it was me, ~~dio~~ lodestone! <:dv_lodestoned:894608674390167612>");
            if (rand >= 0.99) message.guild.channels.cache.get('626180297993748499').send(`${message.member.displayName} tried to pet Oracle, but got lodestoned.`);
        } else if (cmd === 'random') {
            let rand = Math.random();
            let notRigged = 0.10;
            dragon = rand < notRigged ? "Oracle" : dragonList[Math.floor(dragonList.length * (rand-notRigged)/(1-notRigged))];
            message.channel.send(`Your *totally* randomly selected dragon is: **${dragon}**`);
        } else if (cmd === 'smoulderbushed' || cmd === 'smoulderbrushed') {
            message.channel.send("I just got a freaking Smoulderbush for the 30 day event gift. Is this a sick joke...? I didn't spend 30 days playing this event for a freaking SMOULDERBUSH DRAGON. I'm so mad this isn't even funny. <:dv_fiREEEEE:894997064574963723>");
        } else if (cmd === 'msg' && message.member.id == '295625585299030016') {
            let serverId = args.shift();
            if (!serverId) {
                message.channel.send("I need a server ID!");
                return;
            }
            if (serverId.toLowerCase() === 'dv') {
                let server = client.guilds.cache.get('233370210617262080');
                const dvChannels = {
                    'general': '626180297993748499',
                    'media-and-music': '626187499164925954',
                    'art': '626181494779674624',
                    'other-games': '626181518343012378',
                    'animals-and-nature': '626182809081479168',
                    'memes': '626182840517918760',
                    'bot-commands': '626182769256693770',
                    'dragonvale': '626181797696503818',
                    'help-and-tips': '626182930217304064',
                    'park-showcase': '626182910365532161',
                    'mod-chat': '276384829593878529',
                    'helper-chat': '1225213593616650330',
                    'reddit-mod-chat': '861749215172755476',
                    'oracle-pet': '818011940160405534'
                };
                let cName = args.shift();
                if (cName) {
                    let cId = dvChannels[cName] ? dvChannels[cName] : cName;
                    let chan = server.channels.cache.get(cId);
                    if (chan) {
                        if (args.length > 0) chan.send(args.join(" "));
                        else message.channel.send("I need a message to send!");
                    } else message.channel.send(`Channel with name/ID "${cName}" not found!`);
                } else message.channel.send("I need a channel name/ID!");
            } else {
                let server = client.guilds.cache.get(serverId);
                if (server) {
                    let cId = args.shift();
                    if (cId) {
                        let chan = server.channels.cache.get(cId);
                        if (chan) {
                            if (args.length > 0) chan.send(args.join(" "));
                            else message.channel.send("I need a message to send!");
                        } else message.channel.send(`Channel with ID ${cId} not found!`);
                    } else message.channel.send("I need a channel ID!");
                } else message.channel.send('Server not found!');
            }
        } else {
            if (!cmdInWrongChannel(message)) message.channel.send(`Unknown command. Type \`${cmdPrefix}help\` for a list of commands.`);
        }
    } catch (err) {
        message.channel.send('An unexpected error occurred while attempting to process this command. The bot developer has been notified and will look into it soon.');
        const oracleTestCh = client.guilds.cache.get('233370210617262080').channels.cache.get('818011940160405534');
        oracleTestCh.send(`<@!295625585299030016> an error occurred while attempting to execute command \`${message.content}\` (full stack trace logged to console):\n\`\`\`${err.stack/*.split('\n').slice(0,4).join('\n')*/.replace(/aroni/g, '<name>')}\`\`\``);
    }
});

function sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
}

hasModAccess = (message) => (message.guild.id == "233370210617262080" && message.member.roles.cache.some(r => r.name === "Mod Wizard")) || message.member.id == "295625585299030016";
hasHelperAccess = (message) => hasModAccess(message) || (message.guild.id == "233370210617262080" && message.member.roles.cache.some(r => r.name === "Helper Dragon"));

isStaffMember = (guildMember) => {
    return guildMember && guildMember.roles.cache.some(r => ["Owner Wizard", "Admin Wizard", "Mod Wizard", "Helper Dragon"].includes(r.name));
};

cmdInWrongChannel = function(message) {
    if (hasModAccess(message)) return false;
    // (DragonVale server only) prevent non-meme commands from being executed outside appropriate channels
    if (message.channel.type == 'dm') return false;
    if (message.guild.id != '233370210617262080') return false;
    else {
        // Only want to respond in #bot-commands, mod-chat, oracle-pet
        if (message.channel.id == '626182769256693770') return false; // #bot-commands
        else if (message.channel.id == '818011940160405534') return false; // #oracle-pet
        else if (message.channel.id == '276384829593878529') return false; // #mod-chat
        return true;
    }
};

prettyString = function(words, separator) {
	if (words.length == 0) return false;
	var result = words[0].toLowerCase();
	if (result == 'ponkipong') result = 'PonkiPong';
    else if (result === 'drack-o-lantern') result = 'Drack-o-Lantern';
    else if (result === 'nightenhanced') result = 'NightEnhanced';
	else result = result.charAt(0).toUpperCase() + result.substring(1);
	for (i = 1; i < words.length; i++) {
		var str = words[i].toLowerCase();
        if (str == 'ponkipong') str = 'PonkiPong';
        else if (str === 'drack-o-lantern') str = 'Drack-o-Lantern';
		else str = str.charAt(0).toUpperCase() + str.substring(1);
		result += separator + str;
	}
	result = result.replace(/’/g, "'");
	//result = result.replace("...", "…");
	return result;
};

function parseDragon(words, message) {
    let dragon = prettyString(words, ' ');
    if (!dragon) message.channel.send("You must specify a dragon!");
    else if (!dragonList.includes(dragon)) {
        if (dragon === 'Dracomancy' || dragon === 'Monolith' || dragon === 'Snowflake') message.channel.send(`Please specify the number/stage for ${dragon}.`);
        else message.channel.send(`Unrecognized dragon name "${dragon}" (did you spell it correctly?)`);
    } else if (!wikiDragons[dragon]) {
        message.channel.send(`Data for ${dragon} does not appear to be available yet, please try again later!`);
    } else return dragon;
    return false;
}

isPrimary = (dName) => primaries.includes(dName.replace(" Rift", ""));

function calculateURL(fileName) {
    const hash = crypto.createHash('md5').update(fileName).digest('hex');
    return `https://static.wikia.nocookie.net/dragonvale/images/${hash[0]}/${hash[0]}${hash[1]}/${fileName}`;
}

function generateImageLink(dragon, age, form, message) {
    let num = '';
    if (dragon.includes('Dracomancy') || dragon.includes('Monolith') || dragon.includes('Snowflake')) {
        if (age !== 'Egg') num = dragon.slice(-1);
        dragon = dragon.slice(0, -2);
    }
    if (age === 'Elder' && !elders.includes(dragon)) {
        message.channel.send(`${dragon} does not have an elder form!`);
        return false;
    }
    if (age === 'Egg') form = '';
    switch (form) {
        case '':
            break;
        case 'Normal':
        case 'Day':
            form = '';
            break;
        case 'Night':
            if (!dayNight.includes(dragon)) {
                message.channel.send(`${form} form does not apply to ${dragon}.`);
                return false;
            } else if (dragon === 'Lycan') form = 'FullMoon';
            break;
        case 'Hiding':
            if (!hiding.includes(dragon)) {
                message.channel.send(`${form} does not apply to ${dragon}.`);
                return false;
            }
            if (age !== 'Adult') form = '';
            else age = '';
            break;
        case 'Snowman':
            if (dragon !== 'Snowball') {
                message.channel.send(`${form} only applies to the Snowball dragon.`);
                return false;
            } else if (age !== 'Adult') form = '';
            else age = '';
            break;
        case 'Wrapped':
            if (dragon !== 'Giddle') {
                message.channel.send(`${form} only applies to the Giddle dragon.`);
                return false;
            } else if (age !== 'Adult') form = '';
            else age = '';
            break;
        case 'Bush':
            if (dragon !== 'Dargon') {
                message.channel.send(`${form} only applies to the Dargon dragon.`);
                return false;
            } else if (age !== 'Adult') form = '';
            break;
        case 'Spring':
        case 'Summer':
        case 'Autumn':
        case 'Winter':
            if (dragon === 'Seasonal') {
                dragon = form + dragon;
                form = '';
                break;
            } else {
                message.channel.send(`${form} form only applies to the Seasonal dragon.`);
                return false;
            }
        case 'Enhanced':
        case 'NightEnhanced':
            if (!(enhanced.includes(dragon) && dayNight.includes(dragon))) {
                message.channel.send(`${form} does not apply to ${dragon}.`);
                return false;
            } else if (age !== 'Adult') form = form == 'NightEnhanced' ? 'Night' : '';
            break;
        case 'Organic':
        case 'Conjured':
            if (!(enhanced.includes(dragon) && !dayNight.includes(dragon)) || dragon === 'Eldritch') {
                message.channel.send(`${form} does not apply to this dragon.`);
                return false;
            } else if (age !== 'Adult') form = '';
            break;
        case 'Barbarous':
        case 'Charlatan':
        case 'Macabre':
        case 'Scourge':
            if (dragon !== 'Eldritch') {
                message.channel.send(`${form} form only applies to the Eldritch dragon.`);
                return false;
            } else if (age !== 'Adult') form = '';
            break;
        default:
            break;
    }
    if (dragon === 'Dark' && !['Elder', 'Egg'].includes(age)) form = 'Old';
    else if (dragon === 'Seasonal') {
        let month = (new Date()).getMonth();
        if (month < 3) dragon = 'WinterSeasonal';
        else if (month < 6) dragon = 'SpringSeasonal';
        else if (month < 9) dragon = 'SummerSeasonal';
        else dragon = 'AutumnSeasonal';
    }
    filename = `${dragon.replace(/ /g, '')}Dragon${age}${form}${num}.png`;
    return calculateURL(filename);
}

function getMaxBoosts(dragon) {
    let elements = wikiDragons[dragon].Elements;
    let numBoosts = 0;
    let multiplier = 0;
    for (let e of elements) {
        if (isPrimary(e)) {numBoosts += 1; multiplier += 0.3;}
        else if (e === 'Monolith' || e === 'Zodiac') {numBoosts += 1; multiplier += 0.2;}
    }
    return [numBoosts, Math.round(multiplier*10)/10];
}

const evoMsgs = {
    "Aquadruple Leap Year": "This dragon can only be obtained by evolving a Quadruple Leap Year Dragon with the Rainbow Fountain decoration.",
    "Aubergine": "To evolve the level 18 Berry Dragon with any rift trait into the Aubergine Dragon, 6 Jelly Plants must be fully-grown but not harvested and the Jelly Plant Log decoration must be placed in the park. The Aubergine Dragon also requires that it is raining in the park at the time of the evolution.",
    "Avarice": "Evolve a Coal dragon with all ten colors of Poinsettia decorations.",
    "Bloatato": "The Bloatato Dragon requires 6 Omega Squashes to be fully-grown but not harvested, and the Omega Squash Barrel decoration must be placed in the park to be able to evolve the level 20 Sprout Dragon.",
    "Burglehoo": "Evolve a Coal dragon with all ten colors of Present decorations.",
    "Corrupticorn": "Evolve a Chromacorn dragon with all ten colors of Flame of Corruption decorations.",
    "Curlyleaf": "The Curlyleaf Dragon requires 6 Kraken Kabbages to be fully-grown but not harvested, and the Kraken Kabbage Planter decoration must be placed in the park to be able to evolve the level 20 Leaf Dragon.",
    "Dracomancy 2": "Evolve Dracomancy 1 with an Ominous Digsite decoration at upgrade 2 or higher.",
    "Dracomancy 3": "Evolve Dracomancy 2 with an Ominous Digsite decoration at upgrade 3 or higher.",
    "Dracomancy 4": "Evolve Dracomancy 3 with an Ominous Digsite decoration at upgrade 5.",
    "Ghostly Cold": "Evolve a Cold dragon with the Effigy of the Frost decoration.",
    "Ghostly Earth": "Evolve a Earth dragon with the Effigy of the Ground decoration.",
    "Ghostly Fire": "Evolve a Fire dragon with the Effigy of the Flame decoration.",
    "Ghostly Plant": "Evolve a Plant dragon with the Effigy of the Leaf decoration.",
    "Glyph": "Evolve a Monolith 4 dragon with all ten colors of Wooden Idol decorations.",
    "Gulletail": "Evolve a Coal dragon with all ten colors of Stocking decorations.",
    "Hedera": "Evolve a Monolith 3 dragon with all ten colors of Ivy Leaf decorations.",
    "Jadice": "Evolve a Coal dragon with all ten colors of Arc Lamp decorations.",
    "Karroot": "To evolve into the Karroot Dragon, the level 20 Seed Dragon must be placed in the same habitat as a Curlyleaf Dragon and Bloatato Dragon. The Karroot Dragon also requires 6 Meta-carotene to be fully-grown but not harvested, and the Meta-carotene Planter decoration must be placed in the park at the time of the evolution.",
    "Lavaloch": "Evolve a Liveloch dragon with the Volcano decoration.",
    "Libretto": "Evolve a Gift dragon with all ten colors of Tuplet decorations.",
    "Lokilure": "Evolve a Coal dragon with all ten colors of Feather decorations.",
    "Loveydovey": "Evolve a Lovey dragon with the Love Potion decoration.",
    "Mesmerus": "Evolve a Mesmer dragon with all ten colors of Idol of Hypnosis decorations.",
    "Minchi": "Evolve a Stoneshell dragon with all ten colors of Shell decorations.",
    "Nibwhip": "Evolve a Gift dragon with all ten colors of Cocoa Mug decorations.",
    "Pixie": "Evolve a Monolith 6 dragon with all ten colors of Rose decorations.",
    "Porcelain": "Evolve a Bone dragon with all ten colors of Ornament of Porcelain decorations.",
    "Saccharine": "Evolve a Gift dragon with all ten colors of Gumdrop decorations.",
    "Sugarplum": "Evolve a Gift dragon with all ten colors of Flutter Fruit decorations.",
    "Trepak": "Evolve a Gift dragon with all ten colors of Nutcracker decorations.",
    "Umbra": "Evolve a Scout dragon with all ten colors of Tent decorations.",
    "Vidalia": "To evolve into the Vidalia Dragon, the level 20 Seed Dragon must be placed in the same habitat as a Curlyleaf Dragon and Bloatato Dragon. The Vidalia Dragon also requires 6 Jive Chives to be fully-grown but not harvested, and the Jive Chive Planter decoration must be placed in the park at the time of the evolution.",
    "Wrath": "Evolve a Love dragon with all ten colors of Tendril of Wrath decorations."
};
function generateBreedingHint(dragon) {
    let hint = wikiBreedingHints[dragon];
    let msg = '';
    if (!hint.IsEvolution) {
        if (hint.RequiredElementsForBothParents) msg = `The breeding pair must be two dragons *both* with the ${hint.RequiredElementsForBothParents.map(x => getIcon(x)).join('')} element(s).`;
        else if (hint.RequiredDragons) {
            if (hint.RequiredDragons.length == 2) msg = `The breeding pair must be **${hint.RequiredDragons[0]}** ${hint.RequiredDragonTraits ? `with the ${getIcon(hint.RequiredDragonTraits[0])} trait and` : 'and'} **${hint.RequiredDragons[1]}**${hint.RequiredDragonTraits ? ` with the ${getIcon(hint.RequiredDragonTraits[1])} trait.` : '.'}`;
            else if (hint.RequiredElements) msg = `The breeding pair must include **${hint.RequiredDragons[0]}** and the ${hint.RequiredElements.map(x => getIcon(x)).join('')} element(s).`;
            else msg = `The breeding pair must include **${hint.RequiredDragons[0]}**. The other parent can be any dragon.`;
        } else if (hint.RequiredElements) {
            msg = `The breeding pair must include the ${hint.RequiredElements.map(x => getIcon(x)).join('')} element(s).`;
        } else msg = 'The breeding pair can be any two dragons!';
        if (hint.DragonExceptions) msg += ` The breeding pair must NOT include *${hint.DragonExceptions.join('*, *')}*.`;
        if (hint.MinimumRequiredElements) msg += ` The breeding pair must include at least ${hint.MinimumRequiredElements} different elements.`;
        if (hint.RequiredTraits) msg += ` The breeding pair must include the ${hint.RequiredTraits.map(x => getIcon(x)).join('')} trait(s).`;
        if (hint.RiftAlignment) msg += ` The rift must be aligned to ${getIcon(hint.RiftAlignment)} during breeding.`;
        if (hint.RequiredTime) msg += ` Breeding must start during the ${hint.RequiredTime.toLowerCase()}.`;
        if (hint.RequiredWeather) msg += ` The weather in your park must be set to ${hint.RequiredWeather}.`;
        if (hint.RequiredTraits || hint.RiftAlignment || (hint.RequiredElements && hint.RequiredElements.includes('Rift')) || (hint.RequiredElementsForBothParents && hint.RequiredElementsForBothParents.includes('Rift'))) msg += ` Breeding must occur in the rift cave.`;
        else if (wikiDragons[dragon].Elements.includes('Galaxy') && !hint.RequiredCave) msg += ` Breeding must occur in the cooperative cave.`;
        if (hint.RequiredCloneCave) msg += ` Cloning can only occur in the cooperative cave.`;
        if (hint.Prerequisites && dragon === 'Rigel') msg += ` All other galaxy dragons must already be owned and present in your park.`;
    } else {
        msg = evoMsgs[dragon] ? evoMsgs[dragon] : "ERROR: the evolution hint for this dragon is missing!";
    }
    wikiBreedingHints[dragon].Text = msg;
    return msg;
}

const emotes = {
    plant: "<:a:1028651087135248444>",
    fire: "<:a:1028651255322652712>",
    earth: "<:a:1028651314906927104>",
    cold: "<:a:1028651439679082566>",
    lightning: "<:a:1028651496025370774>",
    water: "<:a:1028651647431360602>",
    air: "<:a:1028651648685461514>",
    metal: "<:a:1028651649755004938>",
    light: "<:a:1028651651168485466>",
    dark: "<:a:1028651652447740005>",
    rift: "<:a:1029184146897117254>",
    apocalypse: "<:a:1028652443787079740>",
    aura: "<:a:1028652688524722217>",
    chrysalis: "<:a:1028653236095295569>",
    crystalline: "<:a:1028653786236977202>",
    dream: "<:a:1028652444860813362>",
    galaxy: "<:a:1029184385271988314>",
    gemstone: "<:a:1028653784735416421>",
    hidden: "<:a:1028653237395533894>",
    melody: "<:a:1029184145269719095>",
    monolith: "<:a:1028652685680967761>",
    moon: "<:a:1028652003972358205>",
    olympus: "<:a:1028652186093244498>",
    ornamental: "<:a:1028652687224488047>",
    rainbow: "<:a:1028652001686470806>",
    seasonal: "<:a:1028652183773777930>",
    snowflake: "<:a:1028652446261714954>",
    sun: "<:a:1028652002772791296>",
    surface: "<:a:1028653238720921681>",
    treasure: "<:a:1028652184839131217>",
    zodiac: "<:a:1029184149644382279>",
    dragoncash: "<:a:794723780269834240>",
    etherium: "<:a:1127798807413919865>",
    gems: "<:a:804765803492016138>",
    eom: "<:a:1285704282573897819>",
    doubloons: "<:a:1129605812302663750>",
};
getIcon = function(element) {
    return Object.keys(emotes).includes(element.toLowerCase()) ? emotes[element.toLowerCase()] : element;
};

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
};

const dvBoxSorters = {
    odds: (a, b) => {
        if (a.odds > b.odds) return -1;
        else if (a.odds < b.odds) return 1;
        else if (a.name < b.name) return -1;
        else if (a.name > b.name) return 1;
        else return 0;
    },
    name: (a, b) => {
        if (a.name < b.name) return -1;
        else if (a.name > b.name) return 1;
        else if (a.odds > b.odds) return -1;
        else if (a.odds < b.odds) return 1;
        else if (a.time_sec < b.time_sec) return -1;
        else if (a.time_sec > b.time_sec) return 1;
        else return 0;
    },
    time: (a, b) => {
        if (a.time_sec < b.time_sec) return -1;
        else if (a.time_sec > b.time_sec) return 1;
        else if (a.odds > b.odds) return -1;
        else if (a.odds < b.odds) return 1;
        else if (a.name < b.name) return -1;
        else if (a.name > b.name) return 1;
        else return 0;
    }
};

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

getAvailability = function(dragon) {
    if (!wikiDragons[dragon].IsLimited) return "permanent";
    let response = {
        countdown: "",
        currency: "",
        cost: -1,
        isBreedable: false
    };
    for (let d in wikiLimited.dragons) {
        if (d === dragon) {
            let date = new Date(wikiLimited.dragons[d].countdown);
            date.setUTCHours(14);
            response.countdown = `<t:${Math.floor(date.getTime() / 1000)}:F>`;
            response.cost = 0;
            response.isBreedable = true;
            return response;
        }
    }
    for (let e in wikiLimited.events) {
        for (let d in wikiLimited.events[e].dragons) {
            if (d === dragon) {
                response.countdown = wikiLimited.events[e].dragons[d].countdown;
                if (!response.countdown) response.countdown = wikiLimited.events[e].countdown;
                let date = new Date(response.countdown);
                date.setUTCHours(14);
                response.countdown = `<t:${Math.floor(date.getTime() / 1000)}:F>`;
                response.cost = wikiLimited.events[e].dragons[d].Cost;
                response.currency = wikiLimited.events[e].dragons[d].Currency;
                response.isBreedable = wikiLimited.events[e].dragons[d].Breedable;
                if (response.isBreedable == undefined) response.isBreedable = true;
                return response;
            }
        }
    }
    return undefined;
}

async function getThreadMsgsAfterDate(thread, time) {
    let snowflake = SnowflakeUtil.generate({timestamp: time});
    let mostRecentMsg = (await thread.messages.fetch({limit: 1})).first();
    console.log(`Most recent message was sent at ${(new Date(mostRecentMsg.createdTimestamp)).toLocaleString()}`);
    let msgsObj = [];
    let fetchMore = true;
    while (fetchMore) {
        let threadMsgs = await thread.messages.fetch({limit: 100, after: snowflake});
        threadMsgs.reverse().each(message => {
            msgsObj.push({
                "time": message.createdTimestamp,
                "author": message.author.id
            });
        });
        let lastFetched = msgsObj[msgsObj.length - 1];
        let newTime = new Date(lastFetched.time);
        console.log(`Most recent fetch of this batch was sent at ${newTime.toLocaleString()}`);
        if (lastFetched) fetchMore = mostRecentMsg.createdTimestamp != lastFetched.time;
        else fetchMore = false; // only happens if the first fetch yields no messages, i.e. nothing sent at all in the specified timeframe
        console.log(`fetchMore = ${fetchMore}`);
        snowflake = SnowflakeUtil.generate({timestamp: newTime});
    }
    console.log(`Found ${msgsObj.length} messages in \`${thread.name}\` after ${time.toLocaleString()}`);

    return msgsObj;
}

botToken = (fs.existsSync("./bot_token.txt")) ? fs.readFileSync("./bot_token.txt").toString('utf-8') : process.env.BOT_TOKEN;
client.login(botToken);

function checkIfLoaded() {
    return Object.keys(wikiBreedingHints).length > 0
        && Object.keys(wikiDragons).length > 0
        && Object.keys(wikiEarnRates).length > 0
        && Object.keys(wikiEthEarnRates).length > 0
        && Object.keys(wikiLimited).length > 0
        && Object.keys(questTable).length > 0
        && Object.keys(compEarnRates).length > 0;
}

function loadWikiData() {
    let structures = JSON.parse(fs.readFileSync('resources/structures.json'));
    let downloadtimes = JSON.parse(fs.readFileSync('resources/downloadtimes.json'));
    const oracleTestCh = client.guilds.cache.get('233370210617262080').channels.cache.get('818011940160405534');
    oracleTestCh.send(":arrows_counterclockwise: Attempting resource file downloads...");

    function loadAndProcess(url, isFandom, filename, processData, processFields) {
        httpsFR.get(url, (res) => {
            console.log(`Received ${res.statusCode} for ${filename} request`);
            let body = [];
            res.on('data', chunk => {
                body.push(chunk);
            }).on('end', () => {
                if (res.statusCode != 200) {
                    console.log(`Data for ${filename} was unavailable, loading from backup!`);
                    oracleTestCh.send(`:x: Data for ${filename} was unavailable (server returned ${res.statusCode}), loading from backup!`);
                    readWikiFail.push(filename);
                    processData(JSON.parse(fs.readFileSync(`resources/${filename}`)));
                    saveAfterLoad(structures, downloadtimes);
                    return;
                }
                oracleTestCh.send(`:white_check_mark: Data for ${filename} was successfully retrieved!`);
                body = Buffer.concat(body).toString();
                json = JSON.parse(body);
                if (isFandom) {
                    json = json['parse']['wikitext']['*'];
                    json = JSON.parse(json);
                }
                fs.writeFile(`resources/${filename}`, JSON.stringify(json, null, 4), () => {console.log(`Saved a copy of ${filename}`);});
                downloadtimes[filename] = Date.now();
                processData(json);
                let fields = processFields(json);
                if (JSON.stringify(fields) !== JSON.stringify(structures[filename])) {
                    readWikiChangesDetected.push(filename);
                    oracleTestCh.send(`:warning: Warning: a structure change was detected in ${filename}!\nNew: \`\`\`${JSON.stringify(fields, null, 4)}\`\`\`\nOld: \`\`\`${JSON.stringify(structures[filename], null, 4)}\`\`\``);
                }
                structures[filename] = fields;
                saveAfterLoad(structures, downloadtimes, oracleTestCh);
                readWikiSuccess.push(filename);
            });
        }).on('error', e => {
            console.log(`Error trying to fetch ${filename}: ${e}`);
            oracleTestCh.send(`Error trying to fetch ${filename}: ${e}`);
            readWikiFail.push(filename);
            processData(JSON.parse(fs.readFileSync(`resources/${filename}`)));
            saveAfterLoad(structures, downloadtimes, oracleTestCh);
        });
    }

    // BreedingHints.json from wiki
    loadAndProcess(
        'https://dragonvale.fandom.com/api.php?action=parse&page=Data:BreedingHints.json&prop=wikitext&format=json', true,
        'BreedingHints.json',
        (json) => {
            wikiBreedingHints = json.breedingHints;
        },
        (json) => {
            json = json.breedingHints;
            let fields = [];
            for (let d in json) for (let field in json[d]) if (!fields.includes(field)) fields.push(field);
            return fields.sort();
        }
    );
    // Dragons.json from wiki
    loadAndProcess(
        'https://dragonvale.fandom.com/api.php?action=parse&page=Data:Dragons.json&prop=wikitext&format=json', true,
        'Dragons.json',
        (json) => {
            json = json.dragons;
            wikiDragons = {};
            for (i = 0; i < json.length; i++) wikiDragons[json[i].Name] = json[i];
        },
        (json) => {
            json = json.dragons;
            let fields = [];
            for (let d in json) for (let field in json[d]) if (!fields.includes(field)) fields.push(field);
            return fields.sort();
        }
    );
    // EarningRates.json from wiki
    loadAndProcess(
        'https://dragonvale.fandom.com/api.php?action=parse&page=Data:EarningRates.json&prop=wikitext&format=json', true,
        'EarningRates.json',
        (json) => {
            wikiEarnRates = json.earningRates;
        },
        (json) => {
            json = json.earningRates;
            let fields = [];
            for (let d in json) for (let field in json[d]) if (!fields.includes(field)) fields.push(field);
            return fields.sort();
        }
    );
    // EtheriumEarningRates.json from wiki
    loadAndProcess(
        'https://dragonvale.fandom.com/api.php?action=parse&page=Data:EtheriumEarningRates.json&prop=wikitext&format=json', true,
        'EtheriumEarningRates.json',
        (json) => {
            wikiEthEarnRates = json.etheriumEarningRates;
        },
        (json) => {
            json = json.etheriumEarningRates;
            let fields = [];
            for (let d in json) {
                fields.push(d);
                for (let field in json[d]) if (!fields.includes(field)) fields.push(field);
            }
            return fields.sort();
        }
    );
    // Limited.json from wiki
    loadAndProcess(
        'https://dragonvale.fandom.com/api.php?action=parse&page=Data:Limited.json&prop=wikitext&format=json', true,
        'Limited.json',
        (json) => {
            wikiLimited = json;
        },
        (json) => {
            let fields = {
                main: [],
                eventNames: [],
                event: [],
            };
            for (let d in json) fields.main.push(d);
            for (let e in json.events) {
                fields.eventNames.push(e);
                for (let d in json.events[e].dragons) for (let field in json.events[e].dragons[d]) if (!fields.event.includes(field)) fields.event.push(field);
            }
            fields.main.sort();
            fields.eventNames.sort();
            fields.event.sort();
            return fields;
        }
    );
    // Quests.json from wiki
    loadAndProcess(
        'https://dragonvale.fandom.com/api.php?action=parse&page=Data:Quests.json&prop=wikitext&format=json', true,
        'Quests.json',
        (json) => {
            questTable = {};
            json = json.quests;
            for (let d in json) {
                questName = json[d].Name.trim();
                questTable[questName.toLowerCase()] = {dragon: d, proper: questName};
            }
        },
        (json) => {
            json = json.quests;
            let fields = [];
            for (let d in json) for (let field in json[d]) if (!fields.includes(field)) fields.push(field);
            return fields.sort();
        }
    );
    // Compendium earning rates
    loadAndProcess(
        'https://script.google.com/macros/s/AKfycbwvFX3FtYmAr4nsPcpXsGyEqrX7jC8y8sqguX9GMgLDyXdBBn7Sa300GGO3vR9pFV0k-g/exec?type=gold', false,
        'compEarnRates.json',
        (json) => {
            compEarnRates = {};
            for (i = 0; i < json.length; i++) {
                compEarnRates[json[i].Dragon] = json[i].Gold;
            }
        },
        (json) => {
            let fields = [];
            for (i = 0; i < json.length; i++) {
                for (let field in json[i]) if (!fields.includes(field)) fields.push(field);
            }
            return fields.sort();
        }
    );
}

function saveAfterLoad(structures, downloadtimes, oracleTestCh) {
    if (!checkIfLoaded()) return;
    console.log('All data loaded, saving!');
    oracleTestCh.send(":floppy_disk: All resource files loaded!")
    fs.writeFile('resources/structures.json', JSON.stringify(structures, null, 4), () => {console.log('Resource structures updated');});
    fs.writeFile('resources/downloadtimes.json', JSON.stringify(downloadtimes, null, 4), () => {console.log('Resource download times updated');});
}