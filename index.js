const { Client, GatewayIntentBits } = require('discord.js');
const ytdl = require('ytdl-core');
const youtubeSearch = require('youtube-search-api');
const queue = new Map();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

client.once('ready', () => {
    console.log('Bot is ready!');
});

client.on('messageCreate', async (message) => {
    if (message.content.startsWith('!play')) {
        const args = message.content.split(' ');
        const searchString = args.slice(1).join(' ');

        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) {
            return message.reply('You need to be in a voice channel to play music!');
        }

        const serverQueue = queue.get(message.guild.id);

        let songInfo;
        try {
            const result = await youtubeSearch.GetListByKeyword(searchString, false, 1);
            const songUrl = `https://www.youtube.com/watch?v=${result.items[0].id}`;
            songInfo = await ytdl.getInfo(songUrl);
        } catch (error) {
            console.error(error);
            return message.reply('Error fetching song information.');
        }

        const song = {
            title: songInfo.videoDetails.title,
            url: songInfo.videoDetails.video_url
        };

        if (!serverQueue) {
            const queueConstruct = {
                textChannel: message.channel,
                voiceChannel: voiceChannel,
                connection: null,
                songs: [],
                playing: true
            };

            queue.set(message.guild.id, queueConstruct);
            queueConstruct.songs.push(song);

            try {
                const connection = await voiceChannel.join();
                queueConstruct.connection = connection;
                play(message.guild, queueConstruct.songs[0]);
            } catch (err) {
                console.error(err);
                queue.delete(message.guild.id);
                return message.reply('Could not join the voice channel.');
            }
        } else {
            serverQueue.songs.push(song);
            return message.reply(`${song.title} has been added to the queue!`);
        }
    } else if (message.content.startsWith('!skip')) {
        skipSong(message);
    } else if (message.content.startsWith('!stop')) {
        stopSong(message);
    }
});

const play = (guild, song) => {
    const serverQueue = queue.get(guild.id);
    if (!song) {
        serverQueue.voiceChannel.leave();
        queue.delete(guild.id);
        return;
    }

    const dispatcher = serverQueue.connection
        .play(ytdl(song.url, { filter: 'audioonly' }))
        .on('finish', () => {
            serverQueue.songs.shift();
            play(guild, serverQueue.songs[0]);
        })
        .on('error', (error) => console.error(error));

    dispatcher.setVolumeLogarithmic(5 / 5);
    serverQueue.textChannel.send(`Now playing: **${song.title}**`);
};

const skipSong = (message) => {
    const serverQueue = queue.get(message.guild.id);
    if (!serverQueue) {
        return message.reply('There is no song to skip!');
    }
    serverQueue.connection.dispatcher.end();
};

const stopSong = (message) => {
    const serverQueue = queue.get(message.guild.id);
    if (!serverQueue) {
        return message.reply('There is no song to stop!');
    }
    serverQueue.songs = [];
    serverQueue.connection.dispatcher.end();
};

client.login('YOUR_DISCORD_BOT_TOKEN');
