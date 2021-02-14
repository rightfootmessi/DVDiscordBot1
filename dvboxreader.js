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
            
            setImmediate(() => {
                console.log("Ready to read results");
                const $ = cheerio.load(dom.serialize());
                var timerList = {};
                $('#results').children().each((i, elem) => {
                    timerList[$(elem).attr('id')] = $(elem).contents().filter(function() {return this.nodeType === 3; }).first().text();
                });                  
                parentPort.postMessage(timerList);
            });    
                
        });
    });
});