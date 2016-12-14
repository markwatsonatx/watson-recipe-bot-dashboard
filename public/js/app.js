var app = new Vue({
    el: '#app',
    data: {
        snsApiUrl: '',
        users: [],
        activeUser: { name: null, state: null, notifications: [], graph: null},
        activeState: null,
        activeGraph: null,
        activeGraphNodes: null,
        activeGraphEdges: null
    },
    methods: {
        loadGraphForCurrentUser: function() {
            loadGraph(app.activeUser, app.activeState);
        },
        switchUser: function(user) {
            for (var i=0; i<app.users.length; i++) {
                if (app.users[i].name == user.name) {
                    app.activeUser = app.users[i];
                    app.activeState = app.activeUser.state;
                    break;
                }
            }
            if (app.activeUser.graph) {
                showGraph(app.activeUser, app.activeState);
            }
            else {
                app.loadGraphForCurrentUser();
            }
        },
        setActiveState: function(state) {
            app.activeState = state;
            updateGraph(app.activeUser, app.activeState);
        }
    }
});

var sns = new SNSClient("demokey", {
    userData: {
        type: 'action',
        name: 'dashboard'
    },
    userQuery: {
        type: 'action'
    }
});

sns.on('connected', function() {
    Vue.http.get(app.snsApiUrl + '/demokey/historical?type=action')
        .then(function(res) {
            if (res.ok && res.data.success) {
                for (var i=res.data.notifications.length-1; i>=0; i--) {
                    var n = res.data.notifications[i];
                    var user = null;
                    for (var j=0; j<app.users.length; j++) {
                        if (app.users[j].name == n.state.user) {
                            user = app.users[j];
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
                }
                if (user) {
                    // on first load use the latest state and then load the graph
                    app.activeState = app.activeUser.state;
                    app.loadGraphForCurrentUser();
                }
            }
        });
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
        app.activeState = app.activeUser.state;
        app.loadGraphForCurrentUser();
    }
});

var loadGraph = function(user, state) {
    console.log('Loading graph...');
    if (user.graph && app.activeGraph) {
        if (updateGraph(user, state)) {
            return;
        }
    }
    console.log('Loading graph data from server...');
    var url = '/graph/' + user.name;
    Vue.http.get(url)
        .then(function(res) {
            if (res.ok && res.data.success) {
                console.log('Graph data retrieved from server.');
                user.graph = res.data.data;
                showGraph(user, state);
            }
        });
};

var showGraph = function(user, state) {
    var rawNodes = [];
    var ignoreNodes = [];
    var rawEdges = [];
    var ignoreEdges = [];
    for (var i=0; i<user.graph.length; i++) {
        var path = user.graph[i].objects;
        for (var j = 0; j<path.length; j++) {
            var obj = path[j];
            if (obj.type == 'vertex') {
                if (ignoreNodes.indexOf(obj.id) < 0) {
                    var nodeObject = {
                        id: obj.id,
                        label: obj.properties.name[0].value,
                        shape: 'circle',
                        metadata: {
                            vertex_label: obj.label,
                            vertex_name: obj.properties.name[0].value
                        }
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
                        nodeObject.color = { background:'#ff3ca0' };
                    }
                    else {
                        nodeObject.color = { background:'#41d6c3' };
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
    app.activeGraphNodes = new vis.DataSet(rawNodes);
    app.activeGraphEdges = new vis.DataSet(rawEdges);
    var container = document.getElementById('graph');
    var data = {
        nodes: app.activeGraphNodes,
        edges: app.activeGraphEdges,
    };
    var options = {};
    app.activeGraph = new vis.Network(container, data, options);
};

var updateGraph = function(user, state) {
    var vertices = [{label: 'person', name: user.name}];
    if (state.ingredient) {
        vertices.push({label: 'ingredient', name: state.ingredient});
    }
    if (state.cuisine) {
        vertices.push({label: 'cuisine', name: state.cuisine});
    }
    if (state.recipe) {
        vertices.push({label: 'recipe', name: state.recipe});
    }
    for (var i=0; i<vertices.length; i++) {
        var vertexFound = false;
        for (var j=0; j<user.graph.length; j++) {
            var path = user.graph[j].objects;
            for (var k=0; k<path.length; k++) {
                var obj = path[k];
                if (obj.type == 'vertex' && obj.label == vertices[i].label && obj.properties.name[0].value == vertices[i].name) {
                    vertexFound = true;
                    break;
                }
            }
            if (vertexFound) {
                break;
            }
        }
        if (! vertexFound) {
            return false;
        }
    }
    console.log('Using local graph data...');
    app.activeGraphNodes.forEach(function(node) {
        var highlight = false;
        for (var i=0; i<vertices.length; i++) {
            if (node.metadata.vertex_label == vertices[i].label && node.metadata.vertex_name == vertices[i].name) {
                highlight = true;
                break;
            }
        }
        var bgcolor = '#41d6c3';
        if (highlight) {
            bgcolor = '#ff3ca0';
        }
        if (node.color.background != bgcolor) {
            app.activeGraphNodes.update([{id:node.id, color:{background:bgcolor}}]);
        }
    });
    return true;
};