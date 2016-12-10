var app = new Vue({
    el: '#app',
    data: {
        users: [],
        activeUser: { name: null, state: null, notifications: []}
    },
    methods: {
        loadGraphForCurrentUser: function() {
            loadGraph(app.activeUser.state);
        },
        switchUser: function(user) {
            for (var i=0; i<app.users.length; i++) {
                if (app.users[i].name == user.name) {
                    app.activeUser = app.users[i];
                    break;
                }
            }
            app.loadGraphForCurrentUser();
        }
    }
});

var sns = new SNSClient("demokey", {
    userData: {
        type: 'dashboard'
    },
    userQuery: {
        type: 'action'
    }
});

sns.on('connected', function() {
});

sns.on('notification', function(n) {
    console.log('Recievied notification.');
    var user = null;
    for (var i=0; i<app.users.length; i++) {
        if (app.users[i].name == n.state.user) {
            user = app.users[i];
            break;
        }
    }
    if (! user) {
        user = {
            name: n.state.user,
            state: n.state,
            notifications: []
        };
        app.users.push(user);
    }
    if (! app.activeUser.name) {
        app.activeUser = user;
    }
    user.notifications.push(n);
    user.state = n.state;
    if (user.name == app.activeUser.name) {
        app.loadGraphForCurrentUser();
    }
});

var loadGraph = function(state) {
    // var data = '[{"labels":[[],[],[],[],[]],"objects":[{"id":454672,"label":"person","type":"vertex","properties":{"name":[{"id":"4v0i-9qts-sl","value":"Kevin Bacon"}],"type":[{"id":"4veq-9qts-1l1","value":"Actor"}]}},{"id":"ho1u-9qts-3yt-kge8","label":"actor","type":"edge","inVLabel":"film","outVLabel":"person","inV":954368,"outV":454672},{"id":954368,"label":"film","type":"vertex","properties":{"name":[{"id":"oo4qo-kge8-sl","value":"Apollo 13"}],"type":[{"id":"oo54w-kge8-1l1","value":"Film"}]}},{"id":"owt8g-kge8-3yt-euag","label":"actor","type":"edge","inVLabel":"person","outVLabel":"film","inV":692440,"outV":954368},{"id":692440,"label":"person","type":"vertex","properties":{"name":[{"id":"7eor-euag-sl","value":"Tom Hanks"}],"type":[{"id":"7f2z-euag-1l1","value":"Actor"}]}}]}]';
    // showGraph(JSON.parse(data));
    console.log('Retrieving graph data...');
    var url = '/graph/' + state.user;
    $.get(url, function(response) {
        if (response.success) {
            console.log('Graph data recieved.'); //= ' + JSON.stringify(response));
            showGraph(state, response.data);
        }
    });
};

var showGraph = function(state, data) {
    //console.log(data);
    var graphVisContainer = $('#the-graph').parent().parent();
    if (graphVisContainer.hasClass('hidden')) {
        graphVisContainer.removeClass('hidden');
    }
    var rawNodes = [];
    var ignoreNodes = [];
    var rawEdges = [];
    var ignoreEdges = [];
    for (var i=0; i<data.length; i++) {
        var path = data[i].objects;
        for (var j = 0; j<path.length; j++) {
            var obj = path[j];
            if (obj.type == 'vertex') {
                if (ignoreNodes.indexOf(obj.id) < 0) {
                    var nodeObject = {
                        id: obj.id,
                        label: obj.properties.name[0].value,
                        shape: 'circle',
                    };
                    var highlight = false;
                    if (obj.label == 'person') {
                        highlight = true;
                    }
                    else if (state.ingredient && obj.label == 'ingredient' && obj.properties.name[0].value == state.ingredient) {
                        highlight = true;
                    }
                    else if (state.cuisine && obj.label == 'cuisine' && obj.properties.name[0].value == state.cuisine) {
                        highlight = true;
                    }
                    else if (state.recipe && obj.label == 'recipe' && obj.properties.name[0].value == state.recipe) {
                        highlight = true;
                    }
                    if (highlight) {
                        nodeObject.color = {
                            color:'#FFFFFF',
                            background:'#FF0000'
                        };
                    }
                    rawNodes.push(nodeObject);
                    ignoreNodes.push(obj.id);
                }
            }
            if (obj.type == 'edge') {
                if (ignoreEdges.indexOf(obj.id) < 0) {
                    rawEdges.push({
                        from: obj.outV,
                        to: obj.inV,
                    });
                    ignoreEdges.push(obj.id);
                }
            }
        }
    }
    console.log(rawNodes);
    // create an array with nodes
    var nodes = new vis.DataSet(rawNodes);
    // create an array with edges
    var edges = new vis.DataSet(rawEdges);
    // create a network
    var container = document.getElementById('the-graph');
    var data = {
        nodes: nodes,
        edges: edges,
    };
    var options = {};
    var network = new vis.Network(container, data, options);
};