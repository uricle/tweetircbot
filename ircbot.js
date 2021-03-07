// twitter get bot
const irc = require('irc');
const jconv = require('jconv');
const Twitter = require('twitter-v2');
require('dotenv').config();

const server = process.env.SERVER;
const nick = process.env.NICK;
const targetChannel = process.env.TARGET_CHANNEL;
const channels = [targetChannel];

var BearerToken = process.env.BEARER_TOKEN;
const tweetRe = /https?:\/\/(?:mobile\.)?twitter.com\/.+?\/status\/(\d+)/;

const client = new Twitter({
    bearer_token: BearerToken
});

ircserve();

function ircserve()
{
    var client = new irc.Client(server, nick, {channels: channels});
    client.addListener('message', async function (from, to, message) {
        // var str = jconv.convert(message, 'JIS', 'UTF8');
        // console.log('from:' + from + ' to:' + to + ' :message' + str);
        var found = tweetRe.exec(message);
        if ( found ) {
            const msgs = await tweetget(found[1]);
            msgs.forEach( m => client.notice(targetChannel, jconv.convert(m, 'UTF8', 'JIS')) );
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
