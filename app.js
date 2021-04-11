﻿
/**
 * Module dependencies.
 */

var express = require('express');
var extend = require('extend');
var http = require('http');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
//var bodyParser = require('body-parser');
var nconf = require('nconf');

var debug = require('debug')('app');
var RadarStalker2 = require("./modules/radarStalker2.js");
var BatteryMonitor = require("./modules/batteryMonitor.js");
var GpsMonitor = require("./modules/gpsMonitor.js");
var DataDisplay = require("./modules/dataDisplay.js");
var RadarDatabase = require("./modules/radarDatabase.js");
var FfmpegOverlay = require("./modules/ffmpegOverlay.js");
nconf.file('./configs/radarGunMonitorConfig.json');
var configFileSettings = nconf.get();
var defaultOptions = {
    //loaded from the config file
};
//var bonescript;
var objOptions = extend({}, defaultOptions, configFileSettings);
var app = express();
// all environments

var radarStalker2 = new RadarStalker2({});
var batteryMonitor = new BatteryMonitor({});
var gpsMonitor = new GpsMonitor({});
var dataDisplay = new DataDisplay({});
var ffmpegOverlay = new FfmpegOverlay({});
var radarDatabase = new RadarDatabase({});;


var commonData = {
    game: {
        id: null,
        startTime: null,
        status: 1,
        inning: 1,
        inningPosition: "top",
        outs: 0,
        balls: 0,
        strikes: 0,
        score: {
            home: 0,
            guest: 0
        },
        home: {
            team: {}
        },
        guest: {
            team: {}
        }
    }

}

//app.set('views', path.join(__dirname, 'views'));
//app.set('view engine', 'jade');
  
//app.use(require('stylus').middleware(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/javascript/angular', express.static(path.join(__dirname, 'node_modules', 'angular')));
app.use('/javascript/angular-route', express.static(path.join(__dirname, 'node_modules', 'angular-route')));
app.use('/javascript/angular-animate', express.static(path.join(__dirname, 'node_modules', 'angular-animate')));
app.use('/javascript/angular-ui-bootstrap', express.static(path.join(__dirname, 'node_modules', 'angular-ui-bootstrap', 'dist')));
app.use('/javascript/angular-ui-router', express.static(path.join(__dirname, 'node_modules', '@uirouter', 'angularjs', 'release')));
app.use('/javascript/angular-ui-switch', express.static(path.join(__dirname, 'node_modules', 'angular-ui-switch')));
app.use('/javascript/angular-ui-utils', express.static(path.join(__dirname, 'node_modules', 'angular-ui-utils', 'modules')));
app.use('/javascript/angular-sanitize', express.static(path.join(__dirname, 'node_modules', 'angular-sanitize')));
app.use('/javascript/angular-ui-event', express.static(path.join(__dirname, 'node_modules', 'angular-ui-event', 'dist')));
app.use('/javascript/angular-ui-date', express.static(path.join(__dirname, 'node_modules', 'angular-ui-date', 'dist')));
app.use('/javascript/angular-ui-select', express.static(path.join(__dirname, 'node_modules', 'ui-select', 'dist')));
// not needed already served up by io app.use('/javascript/socket.io', express.static(path.join(__dirname, 'node_modules', 'socket.io', 'node_modules', 'socket.io-client', 'dist')));
app.use('/javascript/fontawesome', express.static(path.join(__dirname, 'node_modules', 'font-awesome')));
app.use('/javascript/bootstrap', express.static(path.join(__dirname, 'node_modules', 'bootstrap', 'dist')));
app.use('/javascript/jquery', express.static(path.join(__dirname, 'node_modules', 'jquery', 'dist')));
app.use('/javascript/bootstrap-table', express.static(path.join(__dirname, 'node_modules', 'bootstrap-table', 'dist')));
app.use('/javascript/dragtable', express.static(path.join(__dirname, 'node_modules', 'dragtable')));
app.use('/javascript/jquery-ui', express.static(path.join(__dirname, 'node_modules', 'jquery-ui', 'ui')));
// development only
if (process.platform === 'win32') {
    app.set('port', objOptions.win32WebserverPort);
    //app.use(express.favicon());
   // app.use(express.logger('dev'));
    //app.use(express.json());
    //app.use(express.urlencoded());
    //app.use(express.methodOverride());
    //app.use(app.router);
    //app.use(express.errorHandler());
} else {
    app.set('port', objOptions.webserverPort);
    //boneScript = require('bonescript');
    //boneScript.getPlatform(function (x) {
    //    console.log('bonescript getPlatform');
    //    console.log('name = ' + x.name);
    //    console.log('bonescript = ' + x.bonescript);
    //    console.log('serialNumber = ' + x.serialNumber);
    //    console.log('dogtag = ' + x.dogtag);
    //    console.log('os = ', x.os);
    //});
}
app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

var routes = express.Router();


/* GET home page. */
routes.get('/', function (req, res) {
    req.sendfile(path.join(__dirname, 'public/index.htm'));
});

routes.get('/data/team', function (req, res) {
    radarDatabase.team_getAll(function (err, response) {
        if (err) {
            res.json(500, {err:err})
        } else {
            res.json(response);
        }
    })  
});

routes.put('/data/team', function (req, res) {
    radarDatabase.team_upsert(req.body, function (err, response) {
        if (err) {
            res.json(500, { err: err })
        } else {
            res.json(response);
        }
    })
});

routes.get('/data/game', function (req, res) {
    res.json(commonData.game);
});


routes.put('/data/team', function (req, res) {
    radarDatabase.team_upsert(req.body, function (err, response) {
        if (err) {
            res.json(500, { err: err })
        } else {
            res.json(response);
        }
    })
});



app.use('/', routes);


var server = http.createServer(app).listen(app.get('port'), function(){
    console.log('Express server listening on port ' + app.get('port'));
    debug('Express server listening on port ' + app.get('port'));
}); 



var io = require('socket.io')(server);
io.on('connection', function(socket) {
    debug('socket.io client Connection');
    socket.on('radarConfigCommand', function(data) {
        debug('radarConfigCommand:' + data.cmd + ', value:' + data.data + ', client id:' + socket.id);
        radarStalker2.radarConfigCommand({ data: data, socket: socket });
    });
    socket.on('radarEmulatorCommand', function(data) {
        debug('radarEmulatorCommand:' + data.cmd + ', value:' + data.data + ', client id:' + socket.id);
        radarStalker2.radarEmulatorCommand({ data: data, socket: socket });
    });

    socket.on("gameChange", function (message) {
        debug('gameChange:' + ', message:' + message + ', client id:' + socket.id);

        switch (message.cmd) {
            case "inningChange":
                commonData.game.inning = message.data.inning;
                io.emit("gameChanged", { cmd: "inningChanged", data: { inning: commonData.game.inning}});      //use io to send it to everyone
                break;
            case "inningPositionChange":
                commonData.game.inningPosition = message.data.inningPosition;
                io.emit("gameChanged", { cmd: "inningPositionChanged", data: { inningPosition: commonData.game.inningPosition } });      //use io to send it to everyone
                break;
            case "homeScoreChange":
                commonData.game.score.home = message.data.score.home;
                io.emit("gameChanged", { cmd: "homeScoreChanged", data: { score: { home: commonData.game.score.home } } });      //use io to send it to everyone
                break;
            case "guestScoreChange":
                commonData.game.score.guest = message.data.score.guest;
                io.emit("gameChanged", { cmd: "guestScoreChanged", data: { score: { guest: commonData.game.score.guest } }});      //use io to send it to everyone
                break;
            case "outsChange":
                commonData.game.outs = message.data.outs;
                io.emit("gameChanged", { cmd: "outsChanged", data: { outs: commonData.game.outs } });      //use io to send it to everyone
                break;
            case "strikesChange":
                commonData.game.strikes = message.data.strikes;
                io.emit("gameChanged", { cmd: "strikesChanged", data: { strikes: commonData.game.strikes } });      //use io to send it to everyone
                break;
            case "ballsChange":
                commonData.game.balls = message.data.balls;
                io.emit("gameChanged", { cmd: "ballsChanged", data: { balls: commonData.game.balls } });      //use io to send it to everyone
                break;
        }

        
    })

    socket.on("pitcher", function (data) {
        debug('pitcher:'  + ', value:' + data.data + ', client id:' + socket.id);
        radarStalker2.pitcher({ data: data, socket: socket });
    })

    socket.on("batter", function (data) {
        debug('batter:' + data.cmd + ', value:' + data.data + ', client id:' + socket.id);
        radarStalker2.batter({ data: data, socket: socket });
    })

    socket.on("pitch", function (data) {
        debug('pitch:' + data.cmd + ', value:' + data.data + ', client id:' + socket.id);
        radarStalker2.pitch({ data: data, socket: socket });
    })

    socket.on('ping', function(data) {
        debug('ping: client id:' + socket.id);
    });

    socket.on("startStream", function (data) {
        ffmpegOverlay.startStream();
    })
    socket.on("stopStream", function (data) {
        ffmpegOverlay.stopStream();
    })

    if (socket.client.request.headers["origin"] != "ArduinoSocketIo") {
        //send the current Config to the new client Connections
        io.emit('radarConfig', radarStalker2.getRadarConfig());
        io.emit('softwareConfig', radarStalker2.getSoftwareConfig());
        io.emit('radarSpeedDataHistory', radarStalker2.getradarSpeedDataHistory());
    }
    //send the current Battery Voltage
    io.emit('batteryVoltage', batteryMonitor.getBatteryVoltage());
    //console.log("gpsState", gpsMonitor.getGpsState())

    
});

radarStalker2.on('radarSpeed', function(data){
    dataDisplay.updateSpeedData(data);
    io.emit('radarSpeed', data);
    
});
radarStalker2.on('radarTimeout', function (data) {
    io.emit('radarTimeout', data);
});
radarStalker2.on('radarCommand',function(data){
    io.emit('radarCommand', data);
});

radarStalker2.on('softwareCommand', function (data) {
    io.emit('softwareCommand', data);
});

radarStalker2.on('radarConfigProperty', function (data) {
    io.emit('radarConfigProperty', data);
});
radarStalker2.on('softwareConfigProperty', function (data) {
    io.emit('softwareConfigProperty', data);
});

batteryMonitor.on("batteryVoltage",function(data){
    io.emit("batteryVoltage", data)
})


//io.route('radarSpeed', function(req) {
//    debug('radarSpeed Connection');
//    req.io.emit('connected', {
//        message: 'Connected to Server'
//    })
//})

// command is the Comm
    

   

