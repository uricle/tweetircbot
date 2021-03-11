// twitter get bot
const irc = require('irc');
const jconv = require('jconv');
const Twitter = require('twitter-v2');
require('dotenv').config();

const server = process.env.SERVER;
const nick = process.env.NICK;
const targetChannel = process.env.TARGET_CHANNEL;
const channels = [targetChannel];
const password = process.env.PASSWORD;
const port = process.env.PORT;
const BearerToken = process.env.BEARER_TOKEN;
const ServerEncode = process.env.SERVER_ENCODE || "JIS";
const ClientEncode = process.env.CLIENT_ENCODE || "UTF8";
const tweetRe = /https?:\/\/(?:mobile\.)?twitter.com\/.+?\/status\/(\d+)/;
const DEBUG = false;

const client = new Twitter({
    bearer_token: BearerToken
});
// console.log(`s:${ServerEncode}`);
// console.log(`c:${ClientEncode}`);
ircserve();

function ircserve()
{
    const client = new irc.Client(server, nick, {channels: channels, port: port, password: password});
    client.addListener('message', async function (from, to, message) {
        var str = (ServerEncode == ClientEncode) ? message : jconv.convert(message, ServerEncode, ClientEncode);
        if ( DEBUG ) console.log('from:' + from + ' to:' + to + ' :message' + str);
        const found = tweetRe.exec(str);
        if ( found ) {
            const msgs = await tweetget(found[1]);
            msgs.forEach( m => {
                const sendmessage = (ServerEncode == ClientEncode) ? m : jconv.convert(m, ClientEncode, ServerEncode);
                client.notice(to, sendmessage)
            });
        }
    });
}
async function tweetget(id)
{
    const { data } = await client.get('tweets', { ids: id });
    const msg = [...data[0].text];
    const len = 200;
    const messages = msg.reduce( (acc, c, i) => i % len ? acc : [...acc, msg.slice( i, i + len).join('') ], [] );
    return messages;
}
