const Discord = require('discord.js');
const client = new Discord.Client();

const cmdPrefix = 'd!';

client.on('ready', () => {
    console.log('I am ready!');
});
 
client.on('message', message => {
	message.reply('Looking for command prefix ' + cmdPrefix);
    if (!message.content.startsWith(cmdPrefix) || message.author.bot) return;
    
	
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    message.channel.send("Received command " + command + " with arguments " + args);
});
 
// THIS  MUST  BE  THIS  WAY
client.login(process.env.BOT_TOKEN);//BOT_TOKEN is the Client Secret
