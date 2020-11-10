const Discord = require('discord.js');
const client = new Discord.Client();

const cmdPrefix = 'd!';

client.on('ready', () => {
    console.log('I am ready!');
});
 
client.on('message', message => {
    if (!message.content.startsWith(cmdPrefix) || message.author.bot) return;
    console.log("Prefix found and messenger is not bot");
	
    const args = message.content.slice(cmdPrefix.length).trim().split(" ");
    const cmd = args.shift().toLowerCase();
	if (cmd === 'quest') {
		var questname = args[0];
		for (i = 1; i < args.length; i++) {
			questname += " " + args[i];
		}
		message.channel.send("You are looking for the dragon whose quest is " + questname);
	} else {
    	message.channel.send("Received command " + cmd + " with arguments " + args);
	}
});
 
// THIS  MUST  BE  THIS  WAY
client.login(process.env.BOT_TOKEN);//BOT_TOKEN is the Client Secret
