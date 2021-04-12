const { parentPort } = require('worker_threads');
const https = require('https');
const vm = require('vm');
const concat = require('concat-stream');
const sprintf = require('sprintf-js').sprintf;

var dragons_ = {};

https.get('https://dvboxcdn.com/data/dragons.js', (res) => {
    res.setEncoding('utf8');
    res.pipe(concat({ encoding: 'string' }, function (remoteSrc) {
        vm.runInThisContext(remoteSrc);
        dragons_ = dragons;
    }));
});

parentPort.on('message', data => {
    const d1 = data.split("|")[0];
    const d2 = data.split("|")[1];
    const link = data.split("|")[2];
    const fast = link.search('fast') != -1 ? true : false;

    var timerList = {};
    var list = sort_by_time(breed_calc(d1, d2, true));
    for (let i in list) {
        var dragon = dragons_[list[i]];
        timerList[dragon.name + " Dragon"] = fmt_dhms(fast ? 0.8 * dragon.time : dragon.time);
    }
    parentPort.postMessage(timerList);
});

/*****************************************************************
 *** THE FOLLOWING CODE HAS BEEN SHAMELESSLY RIPPED FROM DVBOX ***
 *****************************************************************/

var element_list = [
    'plant', 'fire', 'earth', 'cold', 'lightning',
    'water', 'air', 'metal', 'light', 'dark'
];
var epic_list = [
    'apocalypse', 'aura', 'chrysalis', 'dream', 'galaxy', 'hidden',
    'monolith', 'moon', 'olympus', 'ornamental', 'rainbow', 'seasonal',
    'snowflake', 'sun', 'surface', 'treasure'
];
var rift_list = ['rift'];
var gem_list = ['gemstone', 'crystalline'];

var breed_list = element_list.concat(epic_list, rift_list);
var concat_list = breed_list.concat(gem_list);

function is_base_element(tag) {
    return (element_list.indexOf(tag) > -1);
}
function is_breed_element(tag) {
    return (breed_list.indexOf(tag) > -1);
}
function def_and_eq(a, b) {
    return (a && b && (a == b));
}

function breed_calc(d1, d2, beb) {
    var query = breed_query(d1, d2, beb);
    var list = [];

    if (opposite_primary(query)) {
        // opposite primaries cannot be bred directly
    } else if (same_primary(query)) {
        list = primary_dragons(query['elements']);
    } else {
        if (opposite_elements(query)) {
            list = primary_dragons(query['elements']);
        }
        Object.keys(dragons_).forEach(function (dkey) {
            if (breedable(dragons_[dkey], query)) { list.push(dkey); }
        });
    }
    if (list.length > 0) {
        return [...new Set(list)];
    } else {
        return false;
    }
}

function breed_query(d1, d2, beb) {
    var query = {
        'd1': dragons_[d1],
        'd2': dragons_[d2],
        'beb': beb,
        'tags': { 'any dragons': 1 }
    };
    ['d1', 'd2'].forEach(function (key) {
        var tags;
        if (query[key]['tags']) {
            tags = query[key]['tags'];
        } else {
            tags = dragon_tags(query[key]);
            query[key]['tags'] = tags;
        }
        Object.keys(tags).forEach(function (tag) {
            query['tags'][tag] = 1;
            query['tags'][key + '.' + tag] = 1;
        });
    });
    var list; if (list = breed_elements(query)) {
        var elements = Object.keys(list['any']);
        var n = elements.length;
        var d = Object.keys(list['dream']).length;

        query['elements'] = elements;
        query['n_elements'] = n;

        if (n >= 4) { query['tags']['four elements'] = 1; }
        if (d >= 2) { query['tags']['dream elements'] = 1; }
    }
    return query;
}

function dragon_tags(dragon) {
    var tags = {};

    tags[dragon['name']] = 1;
    tags[dragon['type']] = 1;

    var list;
    if (list = dragon['elements']) {
        list.forEach(function (e) { tags[e] = 1; });
    }
    var latent;
    if (latent = dragon['latent']) {
        latent.forEach(function (e) { tags[e] = 1; });
    }
    if (dragon['rifty']) {
        tags['rifty'] = 1;
    }
    return tags;
}

function breed_elements(query) {
    var list = { 'any': {}, 'dream': {} };

    ['d1', 'd2'].forEach(function (key) {
        var tags;
        if (tags = query[key]['tags']) {
            Object.keys(tags).forEach(function (tag) {
                if (is_breed_element(tag)) {
                    list['any'][tag] = tag;

                    if (tag != 'light' && tag != 'dark') {
                        list['dream'][tag] = tag;
                    }
                }
            });
        }
    });
    return list;
}

function opposite_primary(query) {
    return def_and_eq(query['d1']['primary'], query['d2']['opposite']);
}

function same_primary(query) {
    return def_and_eq(query['d1']['primary'], query['d2']['primary']);
}

function opposite_elements(query) {
    var list = query['elements'].filter(function (elem) {
        return is_base_element(elem);
    });
    return (list.length == 2 && is_opposite(list[0], list[1]));
}

function primary_dragons(elements) {
    var want = {};
    elements.forEach(function (e) { want[e] = true; });
    var list = [];

    Object.keys(dragons_).forEach(function (dkey) {
        if (dragons_[dkey]['type'] == 'primary'
            && want[dragons_[dkey]['primary']]
        ) {
            list.push(dkey);
        }
    });
    return list;
}

function breedable(dragon, query) {
    if (check_available(dragon, query)) {
        var reqs; if (dragon['reqs_compiled']) {
            reqs = dragon['reqs_compiled'];
        } else {
            reqs = compile_reqs(dragon);
            dragon['reqs_compiled'] = reqs;
        }
        var yn = false; reqs.forEach(function (req) {
            if (!yn) {
                var need = Object.keys(req);
                var have = query['tags'];
                var miss = false;

                need.forEach(function (tag) {
                    if (!have[tag]) { miss = true; }
                });
                if (!miss) { yn = true; }
            }
        });
        return yn;
    }
    return false;
}

function check_available(dragon, query) {
    if (dragon['available'] == 'never') { return false; }
    if (query['beb']) { return true; }
    if (dragon['available'] == 'permanent') { return true; }
    if (/^yes/.test(dragon['available'])) { return true; }

    var d1; if (d1 = query['d1']) {
        if (dragon['name'] == d1['name']) { return true; }
    }
    var d2; if (d2 = query['d2']) {
        if (dragon['name'] == d2['name']) { return true; }
    }
    return false;
}

function compile_reqs(dragon) {
    var list; if (dragon['evolved'] == 'yes') {
        var clone = ['d1.' + dragon['name'], 'd2.' + dragon['name']];
        list = [clone].concat(dragon['reqs']);
    } else {
        var clone = [dragon['name']];
        list = [clone].concat(dragon['reqs']);
    }
    var reqs = [];

    list.forEach(function (set) {
        var req = {}; set.forEach(function (tag) {
            req[tag] = 1;
        });
        if (dragon['type'] == 'rift') {
            req['d1.rifty'] = 1;
            req['d2.rifty'] = 1;
        }
        reqs.push(req);
    });
    return reqs;
}

function sort_by_time(list) {
    return list.sort(function (a, b) {
        if (dragons[a]['time'] < dragons[b]['time']) { return -1; }
        else if (dragons[a]['time'] > dragons[b]['time']) { return 1; }
        else if (dragons[a]['name'] < dragons[b]['name']) { return -1; }
        else if (dragons[a]['name'] > dragons[b]['name']) { return 1; }
        return 0;
    });
}

function fmt_dhms(t) {
    if (t > 0 && t < 60) {
        var text = sprintf('%d sec', Math.floor(t + 0.5));
        
        return text;
    } else {
        var d; if (t > 86400) {
            d = Math.floor(t / 86400); t = (t % 86400);
        }
        var h = Math.floor(t / 3600); t = (t % 3600);
        var m = Math.floor(t / 60); t = (t % 60);
        var s = Math.floor(t);

        if (d) {
            return sprintf('%d:%02d:%02d:%02d', d, h, m, s);
        } else if (h) {
            return sprintf('%d:%02d:%02d', h, m, s);
        } else {
            return sprintf('%d:%02d', m, s);
        }
    }
}