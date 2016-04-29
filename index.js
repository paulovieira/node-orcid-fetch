/*
todo:
    -add colors
    -add node-spinner
    -parse xml to a js object
    -create the command line utility (with commands)
    -parse bibtex:

*/

var Promise = require('bluebird');
var Chalk = require("chalk");
var Ora = require('ora');
var Wreck = Promise.promisifyAll(require('wreck'), {multiArgs: true});
var Fs = Promise.promisifyAll(require('fs'));
var XmlToJs = require("xml2js");
var CsvParseAsync = Promise.promisify(require("csv-parse"));

var internals = {};

internals.baseUrl = 'https://pub.orcid.org/'

//internals.bearer = readBearerToken();
//console.log("internals.bearer", internals.bearer)
// var orcIds = [
//     '0000-0002-1663-6594',  // pedro garret
//     '0000-0001-6897-2074',  // paulo vieira
// ];

//var orcIds = [];

// process.on("SIGINT", function(){
//     console.log("\nAborting operation. Goodbye!");
// })

//var csvData = Fs.readFileSync('./ORCID CCIAM - Folha1.csv', 'utf8');


var p1 = Promise.resolve();

p1 = p1.then(function(){

    return Fs.readFileAsync('./ORCID CCIAM - Folha1.csv', 'utf8');
})

p1 = p1.then(function(csvData){

    return CsvParseAsync(csvData);
})

p1 = p1.then(function(orcIds){

    var p2 = Promise.resolve();

    // we don't care about the first element of the array (header)
    orcIds.shift();
    orcIds.forEach(function(orcId, i){

        console.log(orcId)
        //return;
        // todo: format (json/xml)
        p2 = p2.then(function(){

                return fetch(orcId[0], orcId[1], 'json');        
            })
            .then(function(obj){

                //console.log("fetched data for " + obj.orcId + " (" +  obj.name + ")")

                // todo: create option + directory for the output
                return Fs.writeFileAsync(orcId + '.' + obj.format, obj.payload);
            })
            // todo: separate catch for some error related to writeFileAsync
            .catch(function(err){

                // todo: red
                console.log(Chalk.red(`  ERROR: profile with orcid ${ err.orcId } (${ err.csvName}) was not retrieved - "Status: ${ err.statusCode } ${ err.message }"`));

            });
    })

    return p2;
    
})

p1 = p1.then(function(){

    console.log("All done. Goobye!")
})

p1 = p1.catch(function(err){

    throw err;
})



function fetch(orcId, csvName, format){

    //var uri = `/v1.2/${ orcId }/orcid-profile/`;
    var uri = '/v1.2/' + orcId + '/orcid-profile/';

    // TODO: read bearer from the file
    var options = {
        baseUrl: internals.baseUrl,
        headers: {
            'Authorization': "Bearer a23c0852-5d99-4595-b801-101d761867de",
            //'Authorization': "Bearer " + internals.bearer,
            'Accept': 'SEE BELOW'
        }
    };

    if(format === 'json'){
        options.headers['Accept'] = 'application/orcid+json';
    }
    else if(format === 'xml'){
        options.headers['Accept'] = 'application/orcid+xml';
    }
    else{
        throw new Error('The "format" option should be "json" or "xml"');
    }

    var cliText = "Fetching data for orcid " + orcId + "...";
    var spinner = Ora({
        text: cliText,
        interval: 70
    });
    spinner.start();

    var promise = Wreck.getAsync(uri, options)
                    .then(function (data) {

                        debugger;
                        var res = data[0], payload = data[1];

                        spinner.stop();

                        if(res.statusCode>=400){
                            debugger;
                            var err = new Error(res.statusMessage);
                            err.statusCode = res.statusCode;
                            err.orcId = orcId;
                            err.csvName = csvName;
                            throw err;
                        }
                        
                        var parsed = parse(payload, format);
                        var name = getName(parsed);

                        console.log('  ' + cliText + ' done (' + name + ')');

                        return {
                            payload: payload,
                            orcId: orcId,
                            name: name
                        };
                    });

    return promise;


};

/*
var spinner = Ora({
    text: 'Loading unicorns',
    interval: 70
});
spinner.start();
var count = 0;
var id = setInterval(() => {
    if(count===3){
        spinner.stop();
        console.log("→ done")
        clearInterval(id);
    }
    spinner.color = count % 2 ? 'yellow' : 'red';
    spinner.text = 'Loading rainbows ' + count;
    count++;
}, 1000);
*/

/*
var p = Promise.resolve();

orcIds.forEach(function(orcId, i){
    return;
    // todo: format (json/xml)
    p = p.then(function(){

            console.log("will call fetch")
            return fetch(orcId, 'json');        
        })
        .then(function(obj){

            //console.log("fetched data for " + obj.orcId + " (" +  obj.name + ")")

            // todo: create option + directory for the output
            return Fs.writeFileAsync(orcId + '.' + obj.format, obj.payload);
        })
        // todo: separate catch for some error related to writeFileAsync
        .catch(function(err){

            // todo: red
            console.log(Chalk.red('ERROR: profile with id ' + err.orcId + ' was not retrieved ("' + err.statusCode + ': ' +  err.message + '")'));

        });
    
})
*/

/*
    return;
    //delay
    Promise
        .delay(i*1000)
        .then(function(){

            return fetch(orcId, 'json');        
        })
        .then(function(obj){

            //console.log("fetched data for " + obj.orcId + " (" +  obj.name + ")")

            // todo: create option + directory for the output
            return Fs.writeFileAsync(orcId + '.' + obj.format, obj.payload);
        })
        // todo: separate catch for some error related to writeFileAsync
        .catch(function(err){

            // todo: red
            console.log(Chalk.red('ERROR: profile with id ' + err.orcId + ' was not retrieved ("' + err.statusCode + ': ' +  err.message + '")'));

        })
*/

function parse(payload, format){

    var parsed;
    if(format === 'json'){
        // todo: try catch (because the json might be malformed)
        
        try{
            parsed = JSON.parse(payload)
        }
        catch(e){
            throw err;
        }

        return parsed;
    }

    if(format === 'xml'){
        throw new Error("xml - to be done")
    }
}

function getName(obj){

    var firstName = obj['orcid-profile']['orcid-bio']['personal-details']['given-names']['value'];
    var lastName = obj['orcid-profile']['orcid-bio']['personal-details']['family-name']['value'];

    return firstName + " " + lastName;
}

function readBearerToken(){

    var bearer = Fs.readFileSync("bearer.txt");
    return bearer.toString();
}

/*
var id = 0;
function asyncTask(delay){

    id++;
    var taskId = id;
    console.log(`will start async task (id: ${ taskId }, will finish in ${ delay } ms)`)
    return Promise
        .delay(delay)
        .then( ()=> console.log(`finished task ${ taskId }`));
}

// asyncTask(2000)
// asyncTask(1000)


var delays = [2000, 1000, 2000];
var p = Promise.resolve();
delays.forEach(function(delay, i){

    console.log("i: ", i)
    p = p.then(function(){

        return asyncTask(2000);
    })
    .then(function(){

        console.log("something sync")
        if(i%2!==0){
            throw new Error("error at " + i)
        }
    })
    .catch(function(err){
        console.log(err.message)
    })
});
*/

/*
console.log("before the code")
Promise.resolve()
    .then(function(){

        var p1 = asyncTask(2000);
        return p1;
    })
    .then(function(){

        var p2 = asyncTask(1000);
        return p2;
    })
console.log("after the code")
*/
/*
*/
//fetch(orcIds[0], 'json')

/*
var promise =Promise.resolve();
orcIds.forEach(function(orcId, i){
    //delay
    promise = promise.then(fetch(orcIds[i], 'json'));
//    promise = promise.delay(5000)
})
promise = promise.catch(function(err){
    console.log(err)
});
*/

/*
Promise.resolve()
    .then(function(){
        return orcIds.map(function(orcId, i){
            return fetch(orcId, 'json');
        })
    })
    .each(function(data){
        console.log("data: " + data)
    })
*/

/*

var delays = ["x", "y"];

delays.forEach(function(n, i){ 
    
    Promise.resolve()
    .delay(i*1000)
    .then(function(){
        console.log(n)
    })

});

*/

/*
var array = Promise.resolve()
            .then(function(){

                return delays.map(function(n){ 
                    
                    return Promise.resolve()
                    .delay(n)
                    .then(function(){
                        console.log(n)
                    })


                });
            });

console.log(array)
*/
/*

array
  // .each(function(p){

  // })       // logs: 500, 100, 400, 200
  .then(console.log)    // logs: [ [Function], [Function], [Function], [Function] ]

delays
  .mapSeries(iterator)  // logs: 500, 100, 400, 200
  .then(console.log)    // logs: [500, 100, 400, 200]

delays
  .map(iterator)        // logs: 100, 200, 400, 500
  .then(console.log)    // logs: [500, 100, 400, 200]

function iterator(f) {
  return f()
}
*/

/*
options: 
json or xml
explicit orcId or file with array of orcid's
delay between each fetch

*/
/*
curl -H "Content-Type: application/orcid+json" -H "Authorization: Bearer a23c0852-5d99-4595-b801-101d761867de" "https://pub.orcid.org/v1.2/0000-0002-1663-6594/orcid-profile/"  > 0000-0002-1663-6594.json
*/