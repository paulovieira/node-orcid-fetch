#!/usr/bin/env node

/*
Using the API with curl

export ORCID_TOKEN=token

curl https://pub.orcid.org/v1.2/0000-0002-1663-6594/orcid-profile  \
    -H "Content-Type: application/orcid+json"  \
    -H "Authorization: Bearer $ORCID_TOKEN"  \
    -o 0000-0002-1663-6594.json

*/


var Fs = require('fs');
var Shell = require("shelljs");
var Promise = require('bluebird');
var Chalk = require("chalk");
var Ora = require('ora');
var Wreck = require('wreck');
var XmlToJs = require("xml2js");
var CsvParse = require("csv-parse");
var Program = require("commander");

Promise.promisifyAll(Wreck, {multiArgs: true});
Promise.promisifyAll(require('fs'));
var CsvParseAsync = Promise.promisify(CsvParse);

var internals = {};

internals.apiBaseUrl = 'https://pub.orcid.org/';
internals.token = '';

process.on('SIGINT', function(){
    console.log(Chalk.red('\n\nAborting operation. Goodbye!'));
});


internals.main = function(){

    var p0A = Promise.resolve();

    var p1A = p0A.then(function(){

        return Fs.readFileAsync(internals.opts.csv, 'utf8');
    });

    var p2A = p1A.then(function(csvData){

        return CsvParseAsync(csvData);
    });

    var p3A = p2A.then(function(orcIds){

        // the first element of the array is the header
        orcIds.shift();

        var p0B = Promise.resolve();

        orcIds.forEach(function(orcId, i){
            
            p0B = p0B.then(function(){

                    return internals.fetch(orcId[0], orcId[1]);
                })
                .then(function(obj){

                    var path = internals.opts.outputDir + "/" + orcId[0] + '.' + internals.opts.format;
                    return Fs.writeFileAsync(path, obj.payload);
                })
                
                // todo: separate catch for some error related to writeFileAsync
                .catch(function(err){

                    console.log(Chalk.red(`  ERROR: profile with orcid ${ err.orcId } (${ err.researcherName}) was not retrieved - "Status: ${ err.statusCode } ${ err.message }"`));

                });
        });

        return p0B;
    });

    var p4A = p3A.then(function(){

        console.log(Chalk.green('\nAll done. Goodbye!'));
    });

    p4A.catch(function(err){

        throw err;
    });

};


internals.fetch = function(orcId, researcherName){

    var uri = '/v1.2/' + orcId + '/orcid-profile/';

    var options = {
        baseUrl: internals.apiBaseUrl,
        headers: {
            'Authorization': 'Bearer ' + internals.token,
            'Accept': 'SEE BELOW'
        }
    };

    if(internals.opts.format === 'json'){
        options.headers['Accept'] = 'application/orcid+json';
    }
    else if(internals.opts.format === 'xml'){
        options.headers['Accept'] = 'application/orcid+xml';
    }
    else{
        throw new Error('Invalid "format" option');
    }

    var cliText = 'Fetching data for orcid ' + orcId + '...';
    var spinner = Ora({
        text: cliText,
        interval: 70
    });
    spinner.start();

    var p0 = Wreck.getAsync(uri, options);

    var p1 = p0.spread(function (resp, payload) {

                spinner.stop();

                if(resp.statusCode >= 400){

                    var err = new Error(resp.statusMessage);
                    err.statusCode = resp.statusCode;
                    err.orcId = orcId;
                    err.researcherName = researcherName;

                    throw err;
                }

                var name = internals.getName(payload.toString());
                console.log('  ' + cliText + ' done (' + name + ')');

                return {
                    payload: payload,
                    orcId: orcId,
                    name: name
                };
            });

    return p1;

};


internals.getName = function(payload){

    var firstName, lastName;
    
    if(internals.opts.format === 'json'){

        // make sure the json is well formed
        var parsedObj;    
        try{
            parsedObj = JSON.parse(payload)
        }
        catch(err){
            throw err;
        }

        firstName = parsedObj['orcid-profile']['orcid-bio']['personal-details']['given-names']['value'];
        lastName = parsedObj['orcid-profile']['orcid-bio']['personal-details']['family-name']['value'];

    }
    else if(internals.opts.format === 'xml'){

        // the method takes a callback, but it is syncronous (? - to be confirmed)
        XmlToJs.parseString(payload, function(err, parsedObj){

            if(err){
                throw err;
            }

            firstName = parsedObj['orcid-message']['orcid-profile'][0]['orcid-bio'][0]['personal-details'][0]['given-names'][0];
            lastName = parsedObj['orcid-message']['orcid-profile'][0]['orcid-bio'][0]['personal-details'][0]['family-name'][0];
        });

    }
    else{
        throw new Error('Invalid "format" option');
    }

    return firstName + ' ' + lastName;
};


internals.readToken = function(){

    var token = Fs.readFileSync(internals.opts.tokenFile, 'utf8');
    internals.token = token.trim();
};


internals.parseOptions = function(){

    Program
        .version('1.0')
        .option('-c, --csv <file.csv>', 'Text file in comma-separated values format. The ORCID must be in the first column.')
        .option('-o --output-dir <directory>', 'Directory where the xml/json will be saved. Default: the current working directory.', process.cwd())
        .option('-t, --token-file <token_file.txt>', 'Text file with the API token. Default: "token.txt".', 'token.txt')
        .option('-f, --format <format>', 'Format of the output ("xml" or "json"). Default: "xml".', 'xml');

    Program.on('--help', function(){

        console.log(`
Description: this utility uses the ORCID web API to retrieve the available data for a given 
researcher registered at orcid.org. 

The ORCID ids (example: "0000-0001-6897-2074") must be stored in a CSV file and given as the 
"--csv" option.

To access the API you must a client with the public API. For more details google for 
"Register a client with the public API".
        `);

    });


    Program.parse(process.argv);
    var opts = Program.opts();
    // verify if all the required arguments have been provided

    var requiredArgs = ["csv"];

    requiredArgs.forEach(function(arg){
        if(!opts[arg]){
            console.error(Chalk.red(`\n  Error: argument '${ arg }' is required\n`));
            process.exit(1);
        }
    });

    // verify if the csv argument actually corresponds to a file

    var arg = "csv";
    if(!Shell.test("-f", opts[arg])){
        console.error(Chalk.red(`\n Error: file ${ opts[arg] } does not exist\n`));
        process.exit(1);
    }

    // verify if the token argument actually corresponds to a file

    arg = "tokenFile";
    if(!Shell.test("-f", opts[arg])){
        console.error(Chalk.red(`\n Error: file ${ opts[arg] } does not exist\n`));
        process.exit(1);
    }

    // verify if the format argument has a valid value

    arg = "format";
    opts[arg] = opts[arg].toLowerCase();
    if(opts[arg] !== "json" && opts[arg] !== "xml"){
        console.error(Chalk.red(`\n Error: argument '${ arg }' should be either 'xml' or 'json'\n`));
        process.exit(1);
    }

    // create the output dir (if it doesn't exist already)

    arg = "outputDir";
    Shell.mkdir("-p", opts[arg]);

    internals.opts = opts;
};

internals.parseOptions();
internals.readToken();
internals.main();
