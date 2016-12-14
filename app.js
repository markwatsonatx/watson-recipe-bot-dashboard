var express = require('express');
var cfenv = require('cfenv');
var dotenv = require('dotenv');
var GDS = require('ibm-graph-client');

// load from .env
dotenv.config();

var snsApiUrl = process.env.SNS_API_URL;
var snsApiKey = process.env.SNS_API_KEY;

// create graph client
if (process.env.VCAP_SERVICES) {
    var vcapServices = JSON.parse(process.env.VCAP_SERVICES);
    var graphService = 'IBM Graph';
    if (vcapServices[graphService] && vcapServices[graphService].length > 0) {
        var config = vcapServices[graphService][0];
    }
}

var graphClient = new GDS({
    url: process.env.GRAPH_API_URL || config.credentials.apiURL,
    username: process.env.GRAPH_USERNAME || config.credentials.username,
    password: process.env.GRAPH_PASSWORD || config.credentials.password,
});
graphClient.session((error, token) => {
    graphClient.config.session = token;
});

// create a new express server
var app = express();

app.get('/graph/:user', function(req, res) {
    var user = req.params.user;
    var query = `g.V().hasLabel("person").has("name", "${user}").union(outE().inV().hasLabel("ingredient"), outE().inV().hasLabel("cuisine"), outE().inV().outE().inV()).path()`;
    console.log('Querying graph: ' + query);
    graphClient.gremlin(`def g = graph.traversal(); ${query}`, (error, response) => {
        if (error) {
            res.send({success: false, error: error, data:[]});
        }
        else if (response.result && response.result.data && response.result.data.length > 0) {
            res.send({success: true, data:response.result.data});
        }
        else {
            res.send({success: true, data:[]});
        }
    });
});

// serve the files out of ./public as our main files
app.use(express.static(__dirname + '/public'));

// set view engine and map views directory
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

// map requests
app.get('/', function(req, res) {
    res.render('index.ejs', {snsApiUrl: snsApiUrl});
});

// get the app environment from Cloud Foundry
var appEnv = cfenv.getAppEnv();

// start server on the specified port and binding host
app.listen(appEnv.port, '0.0.0.0', function() {
  // print a message when the server starts listening
  console.log("server starting on " + appEnv.url);
});
