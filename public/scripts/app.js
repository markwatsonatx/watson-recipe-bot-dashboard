var app = new Vue({
    el: '#app',
    data: {
        users: [],
        activeUser: { name: null, state: null, notifications: [], graph: null},
        activeGraph: null,
        activeGraphNodes: null,
        activeGraphEdges: null
    },
    methods: {
        loadGraphForCurrentUser: function() {
            loadGraph(app.activeUser);
        },
        switchUser: function(user) {
            for (var i=0; i<app.users.length; i++) {
                if (app.users[i].name == user.name) {
                    app.activeUser = app.users[i];
                    break;
                }
            }
            if (app.activeUser.graph) {
                showGraph(app.activeUser);
            }
            else {
                app.loadGraphForCurrentUser();
            }
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
    Vue.http.get('http://localhost:6016/demokey/historical?type=action')
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
        app.loadGraphForCurrentUser();
    }
});

var loadGraph = function(user) {
    console.log('Loading graph...');
    if (user.graph && app.activeGraph) {
        if (updateGraph(user)) {
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
                showGraph(user);
            }
        });
};

var showGraph = function(user) {
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
                    else if (user.state.ingredient && obj.label == 'ingredient' && obj.properties.name[0].value == user.state.ingredient) {
                        highlight = true;
                    }
                    else if (user.state.cuisine && obj.label == 'cuisine' && obj.properties.name[0].value == user.state.cuisine) {
                        highlight = true;
                    }
                    else if (user.state.recipe && obj.label == 'recipe' && obj.properties.name[0].value == user.state.recipe) {
                        highlight = true;
                    }
                    if (highlight) {
                        nodeObject.color = { background:'#FF0000' };
                    }
                    else {
                        nodeObject.color = { background:'#FFFF00' };
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

var updateGraph = function(user) {
    var vertices = [{label: 'person', name: user.name}];
    if (user.state.ingredient) {
        vertices.push({label: 'ingredient', name: user.state.ingredient});
    }
    if (user.state.cuisine) {
        vertices.push({label: 'cuisine', name: user.state.cuisine});
    }
    if (user.state.recipe) {
        vertices.push({label: 'recipe', name: user.state.recipe});
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
        var bgcolor = '#FFFF00';
        if (highlight) {
            bgcolor = '#FF0000';
        }
        if (node.color.background != bgcolor) {
            app.activeGraphNodes.update([{id:node.id, color:{background:bgcolor}}]);
        }
    });
    return true;
};