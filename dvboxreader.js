const { parentPort } = require('worker_threads');
const https = require('https');
const cheerio = require('cheerio');
const jsdom = require('jsdom');

parentPort.on('message', link => {
    console.log("Querying dvbox...");
    jsdom.JSDOM.fromURL(link, {resources: "usable", runScripts: "dangerously"}).then(dom => {
        console.log("dvbox queried successfully");
        dom.window.document.addEventListener('DOMContentLoaded', () => {
            console.log("Event listener set");
            let startTime = new Date();
            
            setImmediate(() => {
                let midTime = new Date();
                var count = 0;
                console.log("Ready to read results after " + (midTime - startTime) + " ms");
                const $ = cheerio.load(dom.serialize());
                var timerList = {};
                $('#results').children().each((i, elem) => {
                    timerList[$(elem).attr('id')] = $(elem).contents().filter(function() {return this.nodeType === 3; }).first().text();
                    count++;
                });
                let endTime = new Date();
                console.log("Found " + count + " results for this query after " + (endTime - midTime) + " ms");
                parentPort.postMessage(timerList);
            });    
                
        });
    });
});