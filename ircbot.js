// twitter get bot
const irc = require('irc');
const jconv = require('jconv');
const Twitter = require('twitter-v2');
const axiosBase = require('axios');
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
const DEBUG = false;

const twitterClient = new Twitter({
    bearer_token: BearerToken
});
const axios = axiosBase.create(
    {baseURL: 'https://www.jma.go.jp/bosai/amedas/', 
     headers: { 
         'Content-Type': 'application/json',
         'X-Requested-With': 'XMLHttpRequest',
     },
     responseType: 'json'
    });

// console.log(`s:${ServerEncode}`);
// console.log(`c:${ClientEncode}`);
ircserve();
// amedasget('八王子');
// amedasget('山口');
// --------------------------------------------------
// 
// --------------------------------------------------
const procs = [
    { 
        pattern: /https?:\/\/(?:mobile\.)?twitter.com\/.+?\/status\/(\d+)/,
        proc : async function (matchobj) {
            var said = matchobj[1];
            const msgs = await tweetget(said);
            return msgs;
        }
    },
    {
        pattern: /アメダス(.+?)(?:＞|>)はむ/,
        proc: async function (matchobj) {
            var target = matchobj[1];
            const msgs = await amedasget(target);
            return msgs;
        }
    },
    {
        pattern: /(https:\/\/www\.slideshare\.net\/.+?\/[\x1f-\x7f]+)/,
        proc: async function (matchobj) {
            return ["https://sssslide.com/" + matchobj[1]];
        }
    }
];

// --------------------------------------------------
// bot body
// --------------------------------------------------
function ircserve()
{
    const client = new irc.Client(server, nick, {channels: channels, port: port, password: password});
    client.addListener('message', async function (from, to, message) {
        var str = (ServerEncode == ClientEncode) ? message : jconv.convert(message, ServerEncode, ClientEncode);
        if ( DEBUG ) console.log('from:' + from + ' to:' + to + ' :message' + str);
        procs.forEach(async function (element){
            const m = element.pattern.exec( str );
            if ( m ) {
                const msgs = await element.proc(m);
                if ( msgs != null ) {
                    msgs.forEach( m=> {
                        const sendmessage = (ServerEncode == ClientEncode) ? m : jconv.convert(m, ClientEncode, ServerEncode);
                        client.notice(to, sendmessage)
                    })
                }
            }
        });
    });
}

// --------------------------------------------------
// amedas
// --------------------------------------------------
var amedastable = null;

const windDir = [
    '静穏',
    '北北東',
    '北東',
    '東北東',
    '東',
    '東南東',
    '南東',
    '南南東',
    '南',
    '南南西',
    '南西',
    '西南西',
    '西',
    '西北西',
    '北西',
    '北北西',
    '北',
];
const overwritepoint = {
    'うどん': '72086',
};
async function amedasget(posname)
{
    try {
        if ( amedastable == null ) {
            const tableresponse = await axios.get('/const/amedastable.json');
            amedastable = tableresponse.data;
        }
        const targetpoint = posname;
        let point = null;
        if (targetpoint in overwritepoint) {
            point = [overwritepoint[targetpoint]];
        }
        if ( point == null ) {
            for ( key in amedastable ) {
                if ( amedastable[key].kjName == targetpoint ) {
                    if ( point == null ) point = [];
                    point.push(key);
                }
            }
        }
        if ( point == null ) {
            return [`${targetpoint} not found`];
        }
        const cur = new Date();
        // 毎時10分頃に更新され、3時間毎にまとめられる
        cur.setMinutes(cur.getMinutes()-11);
        const curhour = Math.floor(cur.getHours()/3) * 3;
        cur.setHours(curhour);
        const year = cur.getFullYear();
        const month = ('0'+(cur.getMonth()+1)).slice(-2);
        const day = ('0'+cur.getDate()).slice(-2);
        const hour = ('0'+cur.getHours()).slice(-2);
        const targetTime = `${year}${month}${day}_${hour}`;
        // const targetIndex = `${year}${month}${day}${hour}0000`;
        const responses = [];
        for ( key in point ) {
            const pointid = point[key];
            const response = await axios.get(`/data/point/${pointid}/${targetTime}.json`);
            const keys = Object.keys(response.data).sort();
            const targetIndex = keys[keys.length-1];
            // console.log(response.data);
            // 20210312205000
            // YYYYMMDDHHMMSS
            const mm = targetIndex.match(/\d{4}\d{2}\d{2}(\d{2})(\d{2})00/);
            const lasttime = `${mm[1]}:${mm[2]}`;
            const data = response.data[targetIndex];
            const { 
                temp,   // 温度
                precipitation1h, // 1時間降水量
                wind, // 風速
                windDirection, // 風向
                humidity,   // 湿度
                maxTemp,    // 最高気温
                maxTempTime,    // { hour: 時, minute: 分 }
                minTemp,       // 最低気温
                minTempTime,    // { hour: 時, minute: 分 }
                pressure, // 現地気圧
                snow,       // 積雪(cm)
                snow1h,     // 1時間積雪
                sun1h,      // 1時間日照時間
            } = data;
            var res = `${amedastable[pointid].kjName}(${amedastable[pointid].knName}) ${lasttime} `;
            if ( temp != undefined ) res += `気温は${temp[0]}度 `;
            if ( precipitation1h != undefined ) res += `降水量:${precipitation1h[0]}mm/h `;
            if ( windDir != undefined ) res += `風向は${windDir[windDirection[0]]} `;
            if ( wind != undefined ) res += `風速${wind[0]}m/s `;
            if ( sun1h != undefined ) res += `日照時間${sun1h[0]}h `;
            if ( humidity != undefined ) res += `湿度${humidity[0]}% `;
            if ( pressure != undefined ) res += `気圧${pressure[0]}hPa `;
            if ( snow != undefined) res += `積雪${snow[0]}cm `;
            if ( snow1h != undefined ) res += `降雪量:${snow1h[0]} `;
            if ( minTemp != undefined ) res += `最低気温 ${minTemp[0]} (${(minTempTime.hour+9)%24}:${minTempTime.minute}) `;
            if ( maxTemp != undefined ) res += `最高気温 ${maxTemp[0]}(${(maxTempTime.hour+9)%24}:${maxTempTime.minute}) `;
            // console.log(res);
            responses.push(res);
        }
        return responses;
        // console.log(response.data.explanation);
    } catch(error) {
        const { status, statusText } = error.response ? error.response : { status: 0, statusText: error };
        console.log(`Error : ${status} ${statusText}`);
        return 'exception';
    }

}
// --------------------------------------------------
// twitter
// --------------------------------------------------
async function tweetget(id)
{
    const { data } = await twitterClient.get('tweets', { ids: id });
    const msg = [...data[0].text];
    const len = 200;
    const messages = msg.reduce( (acc, c, i) => i % len ? acc : [...acc, msg.slice( i, i + len).join('') ], [] );
    return messages;
}
