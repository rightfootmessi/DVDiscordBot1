const { parentPort } = require('worker_threads');
const fs = require('fs');

var data = {};
var nextTimeout = null;

parentPort.on('message', order => {
    if (order.cmd == 'restart') {
        clearTimeout(nextTimeout);
        console.log("QOTD worker loaded");
        data = JSON.parse(fs.readFileSync('qotdlist.json'));

        if (data.hasOwnProperty('local')) return; // disables QOTD when I'm running locally
    
        var now = new Date();
        var millisTill10 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 16, 0, 0, 0) - now; // GMT on Oracle Cloud but EST on my laptop!
        if (millisTill10 < 0) {
            millisTill10 += 86400000; // it's after 10am, try 10am tomorrow.
        }
        console.log(`Now: ${now}; millisTil10: ${millisTill10}`);
        nextTimeout = setTimeout(post, millisTill10);
    } else if (order.cmd == 'loadfile') {
        data = JSON.parse(fs.readFileSync('qotdlist.json'));
        console.log("QOTD worker reloaded json file!");
    } else {
        console.log("QOTD worker received invalid order");
    }
});

function post() {
    nextTimeout = setTimeout(post, 24*60*60*1000);
    console.log('function call worked');
    next_q = {
        "num": data.num,
        "q": data.queue.shift() // TODO change to queue.shift()
    };
    parentPort.postMessage(next_q);
    data.num++;
    fs.writeFile('qotdlist.json', JSON.stringify(data, null, 4), (err) => {if (err) console.log("Error - qotdlist.json couldn't be updated after posting!")});
}