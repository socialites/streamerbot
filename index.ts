import OBSWebSocket from 'obs-websocket-js';
import * as tmi from "tmi.js";
import { handleCommand, registerObsEvents } from './handlers';

const client = new tmi.Client({
    options: {
        debug: true,
    },
    ...(process.env.CHAT_BOT_USERNAME && process.env.CHAT_BOT_OAUTH_TOKEN) ? {
    identity: {
            username: process.env.CHAT_BOT_USERNAME,
            password: process.env.CHAT_BOT_OAUTH_TOKEN,
        }
    } : {},
    channels: ["itspinot","strawberrysuz"],
});

const obs = new OBSWebSocket();

client.connect().then(async () => {
    console.log('Connected to Twitch');

    await obs.connect(`ws://localhost:${process.env.OBS_WEBSOCKET_PORT}`, process.env.OBS_WEBSOCKET_PASSWORD);
    console.log('Connected to OBS');

    if (process.argv.slice(2).includes('debug')) {
        registerObsEvents({obs});
        console.log('Registered OBS events');
    }
}).catch(console.error);

client.on('message', (_channel: string, tags: tmi.ChatUserstate, message: string, self: boolean) => {
	// Ignore echoed messages.
	if(self) return;

    if (message.trim().toLowerCase().startsWith("!")) {
        if (Boolean(tags.badges?.broadcaster) === true) {
            handleCommand(message.trim().slice(1), {obs});
        }
    }
});

client.on('join', (channel: string) => {
    console.log('Joined channel', channel);
});
