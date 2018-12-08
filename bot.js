// A simple discord bot by Daniel Wykerd
// Made using the Discord API (discord.js)
//
// Dictionary searches are provided by datamuse API

const Discord = require('discord.js');
//var auth = require('./auth.json');
var cmds = require('./commands.json');
var config = require('./config.json');
var fs = require("fs");
const datamuse = require('datamuse');

var dictionary = '';
fs.readFile("./words.txt", (err, data) =>{
    dictionary = data.toString('utf-8').split('\n');
});

var hangman = 
{
    playing: false,
    word: '',
    channel: '',
    guessedCharacters: [' '],
    incorrect: 0
}

const embedColor = 0x4DD0E1;

// Create an instance of a Discord client
const client = new Discord.Client();

/**
 * The ready event is vital, it means that only _after_ this will your bot start reacting to information
 * received from Discord
 */
client.on('ready', () => {
    console.log('Bot is ready');
    client.user.setStatus('available')
    client.user.setPresence({
        game: {
            name: 'with depression',
            type: "PLAYING",
        }
    });
});

client.on('error', console.error);

// Create an event listener for messages
client.on('message', message => {
    if (message.author.bot) return;
    if (message.guild === null){
        message.channel.send('Hi, unfortunatly I currently only work on discord guilds (servers).');
        return;
    }
    var args = message.content.substring(0).split(' ');
    var cmd = args[0].toUpperCase();
    console.log('Args length = ' + args.length);
    console.log('Message: ' + message.content);
    //Commands!
    if (message.content.substring(0,1) === '$'){
        console.log('Command: ' + cmd);
        switch (cmd){
            case '$PING':
                message.channel.send('Pong!');
                break;
            case '$HANGMAN':
                if (!hangman.playing) {
                    hangman.playing = true;
                    startHangman(message);
                } else {
                    hangman.playing = false;
                    endHangman(message);
                }
                break;
            case '$ADDCOMMAND':
                addCommand(message);
                break;
            case '$ADDPHRASE':
                addPhrase(message);
                break;
            case '$PHRASECOUNT':
                sendPhraseCount(message);
                break;
            case '$HELP':
                sendHelp(message);
                break;
            case '$DELPHRASE':
                delPhrase(message);
                break;
            case '$SYNONYMS':
                wordLookup(message);
                break;
        }
    } else if ((hangman.playing)&&(message.channel.id == hangman.channel)){
        parseHangman(message);
    } else {
        switch (cmd){
            case '=PLAY':
                message.channel.send('Jy stuur die command in die verkeerde channel! Gebruik ' + message.guild.channels.find(channel => channel.name === config.botChannel.name));
                break;
            case "!PLAY":
                message.channel.send('Jy stuur die command in die verkeerde channel! Gebruik ' + message.guild.channels.find(channel => channel.name === config.botChannel.name));
                break;
            case ";;PLAY":
                message.channel.send('Jy stuur die command in die verkeerde channel! Gebruik ' + message.guild.channels.find(channel => channel.name === config.botChannel.name));
                break;
            default: 
                processMessage(message);    
        }
    }
});

function wordLookup(cmd){
    var args = cmd.content.split('"'); //$synonyms "eiers is lekker" ---> ["$synonyms ", "eiers is lekker", ""] //length 3
    if (args.length < 3) {
        cmd.channel.send('Not enough arguments! Format should be $synonyms "<WORD/PHRASE>"'); return;
    } else if (args.length > 3){
        cmd.channel.send('Too many arguments! Format should be $synonyms "<WORD/PHRASE>"'); return;
    }
    datamuse.words({
        ml: args[1],
        max: 5,
        md: "d"
    })
    .then((json) => {
        var msg = 
        {
            embed: {
                color: embedColor,
                title: "Synonym Search:",
                fields: []
            }
        };

        console.log(json.length);

        for (var i = 0; i < json.length; i++){
            var word = {};
            try{
                if (typeof json[i].defs === 'undefined'){
                    word.value = 'Meaning not found';
                } else if (json[i].defs === ''){
                    word.value = 'Meaning not found';  
                } else {
                    word.value = json[i].defs[0]; 
                }
                if (typeof json[i].word !== 'undefined'){
                    word.name = json[i].word,
                    msg.embed.fields.push(word);
                }
            } catch (e) {
                console.error(e);
            }
        }

        if (msg.embed.fields.length < 1){
            msg.embed.description = 'No results returned from API';
        }

        cmd.channel.send(msg);
    })
    .catch(console.error);
}

function sendHelp(msg){
    msg.author.send(
    {
        embed: {
            color: embedColor,
            title: "Bot Help",
            fields: [{
                name: "$PING",
                value: "Responds with pong. Simple way to test if the bot is online"
            },
            {
                name: "$HANGMAN",
                value: "Starts a game of hangman in the current text channel"
            },
            {
                name:'$ADDCOMMAND "<PHRASE>" "<RESPONSE>"',
                value: 'Add custom chat command to your guild that uses DanielBot. Replace <PHRASE> with the sentence or phrase the bot should respond to and <RESPONSE> with the response the bot should send'
            },
            {
                name:'$ADDPHRASE <JSON OBJECT>',
                value: "Adds a new phrase object to the current guild's phrases array. For more help read the README.txt file at https://github.com/Wykerd/DanielDiscordBOT"     
            },
            {
                name: '$PHRASECOUNT',
                value: "Returns the amount of phrases assigned to the current guild"    
            },
            {
                name: '$DELPHRASE "<WORD/PHRASE>"',
                value: 'Delete a phrase assigned to the guild'
            }]
        }
    });
    msg.channel.send('A message has been sent to your DM containing help');
}

function sendPhraseCount(msg){
    var guildNo = 0;
    var guildID = msg.guild.id;
    while ((guildNo < cmds.guilds.length)&&(cmds.guilds[guildNo].id != guildID)){
        guildNo++;
    }

    if (guildNo > cmds.guilds.length - 1){
        msg.channel.send('No phrases assigned to this guild!');          
    } else {
        msg.channel.send(cmds.guilds[guildNo].phrases.length + ' phrases are currently assigned to this guild!');
    }
}

function addPhrase(msg){
    var args = msg.content.split('{');
    console.log(args);   
    if (args.length < 2){
        msg.channel.send('Not enough arguments!');    
    } else if (args.length > 2){
        msg.channel.send('Too many arguments!');
    } else {
        var guildNo = 0;
        var guildID = msg.guild.id;
        while ((guildNo < cmds.guilds.length)&&(cmds.guilds[guildNo].id != guildID)){
            guildNo++;
        }

        if (guildNo > cmds.guilds.length - 1){
            guildNo = cmds.guilds.push({
                id: msg.guild.id,
                phrases: []
            });
            guildNo -= 1;
            
        }

        var newPhrase = {};

        var addedSuccessfully = true;

        try {
            newPhrase = JSON.parse("{"+args[1]);
        } catch(e) {
            msg.channel.send('An error occured while parsing the JSON object!');
            addedSuccessfully = false;
        } 
        if (!((newPhrase.hasOwnProperty('keywords'))&&(newPhrase.hasOwnProperty('response')))){
            msg.channel.send('Invalid JSON object!');
        } else if (addedSuccessfully){
            cmds.guilds[guildNo].phrases.push(newPhrase);
            fs.writeFile('./commands.json', JSON.stringify(cmds), (err) =>{
                if (err) throw err;
                console.log('Added command to commands.json');
                msg.channel.send('Phrase added successfully!');
            });
        }
    }
}

function addCommand(msg){ 
    var args = msg.content.split('"'); //$addcommand "eiers is lekker" "dit is waar" // [ '$addcommand ', 'eiers is lekker', ' ', 'ja dis waar', '' ]  // Length = 5
    var likelyPhrase = getPhrase(args[1].replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g,"").split(' '), msg.guild.id);
    console.log(likelyPhrase.likelihood);
    if (args.length < 5) {
        msg.channel.send('Not enough arguments! Format should be $hangman "<PHRASE>" "<RESPONSE>"');
    } else if (args.length > 5){
        msg.channel.send('Too many arguments! Format should be $hangman "<PHRASE>" "<RESPONSE>"');
    } else if (likelyPhrase.likelihood == 1) {
        msg.channel.send("This phrase is already added, with response *" + likelyPhrase.response + "*");
    } else {
        var guildNo = 0;
        var guildID = msg.guild.id;
        while ((guildNo < cmds.guilds.length)&&(cmds.guilds[guildNo].id != guildID)){
            guildNo++;
        }

        if (guildNo > cmds.guilds.length - 1){
            guildNo = cmds.guilds.push({
                id: msg.guild.id,
                phrases: []
            });
            guildNo -= 1;
        }

        var arrKeyword = args[1].toLowerCase().split(' ');
        cmds.guilds[guildNo].phrases.push({
            keywords: arrKeyword,
            response: args[3]
        });
        fs.writeFile('./commands.json', JSON.stringify(cmds), (err) =>{
            if (err) throw err;
            console.log('Added command to commands.json');
            msg.channel.send('Command added successfully!');
        });
    }
}

function delPhrase(msg){
    var guildNo = 0;
    var guildID = msg.guild.id;
    while ((guildNo < cmds.guilds.length)&&(cmds.guilds[guildNo].id != guildID)){
        guildNo++;
    }

    if (guildNo > cmds.guilds.length - 1){
        msg.channel.send('No phrases assigned to this guild!');  
    } else {
        var args = msg.content.split('"'); //$delphrase "eiers is lekker" // ["$delphrase ", "eiers is lekker", ""] // Length = 3
        if (args.length == 3)  var likelyPhrase = getPhrase(args[1].toString().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g,"").split(' '), msg.guild.id);
        if (args.length < 3) {
            msg.channel.send('Not enough arguments! Format should be $delphrase "<PHRASE>"');
        } else if (args.length > 3){
            msg.channel.send('Too many arguments! Format should be $delphrase "<PHRASE>"');
        } else if (likelyPhrase.likelihood < 1) {
            msg.channel.send('Could not find a 100% match for the queried phrase!\n'+
            'The closest match has the keywords "'+likelyPhrase.keywords.toString()+'" with response "'+likelyPhrase.response+
            '" and is a '+Math.round(likelyPhrase.likelihood*100)+'% match to your query!' );            
        } else {
            var objJSON = JSON.stringify(cmds.guilds[guildNo].phrases[likelyPhrase.position]);
            cmds.guilds[guildNo].phrases.splice(likelyPhrase.position, 1);
            msg.channel.send('Successfully deleted '+objJSON);
        }
    }

}

function getPhrase(args, guildID){
    var mostLikelyValue = 0;
    var mostLikelyPhrase = '';
    var mostLikelyPosition = 0;
    var mostLikelyKeywords = [];

    var guildNo = 0;
    while ((guildNo < cmds.guilds.length)&&(cmds.guilds[guildNo].id != guildID)){
        guildNo++;
    }

    if (guildNo > cmds.guilds.length - 1) return {
        likelihood: 0,
        response: ''
    };

    for (var i = 0; i < cmds.guilds[guildNo].phrases.length; i++) {
        var numFound = 0;
        for (var y = 0; y < cmds.guilds[guildNo].phrases[i].keywords.length; y++){
            var found = false;
            for (var x = 0; x < args.length; x++){
                var find = cmds.guilds[guildNo].phrases[i].keywords[y].substring(0).split(' ');
                for (var z = 0; z < find.length; z++){
                    if ((find[z] === args[x])&&(!found)){
                        numFound += 1;
                        found = true;
                    }
                }
            }
        }
        //cmds.phrases[i].keywords[y];
        if (numFound >= cmds.guilds[guildNo].phrases[i].keywords.length){
            var likelihood = numFound/((args.length/cmds.guilds[guildNo].phrases[i].keywords.length)-1+cmds.guilds[guildNo].phrases[i].keywords.length);
        } else {
            likelihood = 0;
        }
        if (likelihood > mostLikelyValue) {
            mostLikelyValue = likelihood;
            mostLikelyPhrase = cmds.guilds[guildNo].phrases[i].response;
            mostLikelyPosition = i;
            mostLikelyKeywords = cmds.guilds[guildNo].phrases[i].keywords;
        }
    }
    return {
        likelihood: mostLikelyValue,
        response: mostLikelyPhrase,
        position: mostLikelyPosition,
        keywords: mostLikelyKeywords
    }
}

function processMessage(msg){
    var likelyPhrase = getPhrase(msg.content.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g,"").split(' '),  msg.guild.id);
    if (likelyPhrase.likelihood > 0.8){
        msg.channel.send(likelyPhrase.response);
        console.log('Responded with likelihood of ' + likelyPhrase.likelihood);
    }
}

function startHangman(msg){
    hangman.channel = msg.channel.id;
    hangman.word = dictionary[Math.floor(Math.random()*dictionary.length)];
    var guess = '';
    for (var i = 0; i < hangman.word.length - 1; i++){
        guess += '-';       
    }
    const embed = new Discord.RichEmbed()
    .setTitle('Hangman')
    .setColor(embedColor)
    .setDescription('<@'+msg.author.id+'> has started a game of hangman in <#'+hangman.channel+'>!');
    msg.channel.send(embed);
    const embed2 = new Discord.RichEmbed()
    .setTitle('Hangman')
    .setColor(embedColor)
    .setDescription(guess)
    .setImage('https://raw.githubusercontent.com/Wykerd/DanielDiscordBOT/master/hangman_assets/hangman1.png');
    msg.channel.send(embed2);
}

function parseHangman(msg){
    if (!msg.author.bot){
        if (msg.content.length != 1){
            const embed = new Discord.RichEmbed()
            .setTitle('Hangman')
            .setColor(embedColor)
            .setDescription('<@'+msg.author.id+'> hangman is in progress! Please only send one letter at a time!'); 
            msg.channel.send(embed);   
        } else {
            var letter = msg.content.toLowerCase()[0];
            if (hangman.guessedCharacters.indexOf(letter) > -1){
                const embed = new Discord.RichEmbed()
                .setTitle('Hangman')
                .setColor(embedColor)
                .setDescription('<@'+msg.author.id+'> that letter was already guessed!'); 
                msg.channel.send(embed);
            } else {
                hangman.guessedCharacters.push(letter);
                if (hangman.word.indexOf(letter) == -1){
                    const embed = new Discord.RichEmbed()
                    .setTitle('Hangman')
                    .setColor(embedColor)
                    .setDescription('<@'+msg.author.id+'> guessed *'+letter.toUpperCase()+'* but guessed incorrectly!'); 
                    msg.channel.send(embed);    
                    hangman.incorrect += 1;
                    printHangman(msg);
                } else {
                    const embed = new Discord.RichEmbed()
                    .setTitle('Hangman')
                    .setColor(embedColor)
                    .setDescription('<@'+msg.author.id+'> guessed *'+letter.toUpperCase()+'* and was correct!'); 
                    msg.channel.send(embed); 
                    printHangman(msg);   
                }
            }
        } 
    }     
}

function printHangman(msg){
    var guess = '';
    for(var x = 0; x < hangman.word.length - 1; x++){
        var guessed = false;
        for(var i = 0; i < hangman.guessedCharacters.length; i++){
            if (hangman.word[x] == hangman.guessedCharacters[i]){
                guess += hangman.word[x];
                guessed = true;
            }
        }
        if (!guessed) guess += '-';
    }
    const embed2 = new Discord.RichEmbed()
    .setTitle('Hangman')
    .setColor(embedColor)
    .setDescription(guess)
    .setImage('https://raw.githubusercontent.com/Wykerd/DanielDiscordBOT/master/hangman_assets/hangman'+(hangman.incorrect+1)+'.png');
    msg.channel.send(embed2);
    if (hangman.incorrect == 6){
        const embed = new Discord.RichEmbed()
        .setTitle('Hangman')
        .setColor(embedColor)
        .setDescription('You have lost, the word was '+hangman.word);
        msg.channel.send(embed); 
        hangman = 
        {
            playing: false,
            word: '',
            channel: '',
            guessedCharacters: [' '],
            incorrect: 0
        }    
    } else if (guess === hangman.word.toLowerCase()) {
        const embed = new Discord.RichEmbed()
        .setTitle('Hangman')
        .setColor(embedColor)
        .setDescription('You have won!');
        msg.channel.send(embed); 
        hangman = 
        {
            playing: false,
            word: '',
            channel: '',
            guessedCharacters: [' '],
            incorrect: 0
        }      
    }
}
function endHangman(msg){
    const embed = new Discord.RichEmbed()
    .setTitle('Hangman')
    .setColor(embedColor)
    .setDescription('<@'+msg.author.id+'> has ended the game of hangman in <#'+hangman.channel+'>!');
    msg.channel.send(embed); 
    hangman = 
    {
        playing: false,
        word: '',
        channel: '',
        guessedCharacters: [' '],
        incorrect: 0
    }   
}

// Log our bot in using the token from https://discordapp.com/developers/applications/me
client.login(progress.env.token); // Replace with your own token!
