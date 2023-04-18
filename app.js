﻿
'use strict';
const defaultConfig = require('./config/defaultConfig.json');
const appLogName = "radarMonitor"
const express = require('express');
const extend = require('extend');
const http = require('http');
const path = require('path');
const favicon = require('serve-favicon');
const ConfigHandler = require("@andrewiski/confighandler");
const LogUtilHelper = require("@andrewiski/logutilhelper");
const cookieParser = require('cookie-parser');
const fs = require('fs');

const RadarStalker2 = require("./modules/radarStalker2.js");
const BatteryMonitor = require("./modules/batteryMonitor.js");
const GpsMonitor = require("./modules/gpsMonitor.js");
const DataDisplay = require("./modules/dataDisplay.js");
const RadarDatabase = require("./modules/radarDatabase.js");
//const FfmpegOverlay = require("./modules/ffmpegOverlay.js");
const FfmpegVideoInput = require("./modules/ffmpegVideoInput.js");
const VideoOverlayParser = require("./modules/videoOverlayParser.js");
const FFplay = require('./modules/ffplay.js');
const { v4: uuidv4 } = require('uuid');

var configFileOptions = {
    "configDirectory": "config",
    "configFileName": "config.json"
}

var localDebug = false;
if (process.env.LOCALDEBUG === "true") {
    localDebug = true;
}
if (process.env.CONFIGDIRECTORY) {
    configFileOptions.configDirectory =process.env.CONFIGDIRECTORY;
}
if (process.env.CONFIGFILENAME) {
    configFileOptions.configFileName =process.env.CONFIGFILENAME;
}
if (process.env.DATADIRECTORY) {
    defaultConfig.dataDirectory =process.env.DATADIRECTORY;
}

if (process.env.LOGDIRECTORY) {
    defaultConfig.logDirectory =process.env.LOGDIRECTORY;
}


if (defaultConfig.deviceId === undefined || defaultConfig.deviceId === '') {
    defaultConfig.deviceId = uuidv4();
}

console.log("configDirectory is " + configFileOptions.configDirectory);
console.log("configFileName is " + configFileOptions.configFileName);

var configHandler = new ConfigHandler(configFileOptions, defaultConfig);

var objOptions = configHandler.config;
console.log("Data Directory is " + objOptions.dataDirectory);
console.log("Log Directory is " + objOptions.logDirectory);

let logUtilHelper = new LogUtilHelper({
    appLogLevels: objOptions.appLogLevels,
    logEventHandler: null,
    logUnfilteredEventHandler: null,
    logFolder: objOptions.logDirectory,
    logName: appLogName,
    debugUtilEnabled: (process.env.DEBUG ? true : undefined) || false,
    debugUtilName:appLogName,
    debugUtilUseUtilName: false,
    debugUtilUseAppName: true,
    debugUtilUseAppSubName: false,
    includeErrorStackTrace: localDebug,
    logToFile: !localDebug,
    logToFileLogLevel: objOptions.logLevel,
    logToMemoryObject: true,
    logToMemoryObjectMaxLogLength: objOptions.maxLogLength,
    logSocketConnectionName: "socketIo",
    logRequestsName: "access"

})

if (configHandler.config.deviceId === undefined || configHandler.config.deviceId === '') {
    configHandler.config.deviceId = uuidv4();
    try {
        configHandler.configFileSave();
        logUtilHelper.log(appLogName, "app", "debug", 'deviceId Setting Saved');
    } catch (ex) {
        logUtilHelper.log(appLogName, "app", "error", 'Error Saving Config DeviceId', ex);
        console.log("Error Saving Config DeviceId " + ex.message);
    }
}
console.log("DeviceId " + configHandler.config.deviceId);

logUtilHelper.log(appLogName, "app", "info", "DeviceId " + configHandler.config.deviceId);
logUtilHelper.log(appLogName, "app", "info", "configDirectory is " + configFileOptions.configDirectory);
logUtilHelper.log(appLogName, "app", "info", "configFileName is " + configFileOptions.configFileName);
logUtilHelper.log(appLogName, "app", "info", "Data Directory is " + objOptions.dataDirectory);
logUtilHelper.log(appLogName, "app", "info", "Log Directory is " + objOptions.logDirectory);


var audioFileDirectory = path.join(objOptions.dataDirectory, "audioFiles");
var walkupAudioDirectory = path.join(audioFileDirectory, "walkup");

var app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: false }));

// all environments

var radarStalker2 = new RadarStalker2(objOptions.radarStalker2, logUtilHelper);
var batteryMonitor = new BatteryMonitor(objOptions.batteryMonitor, logUtilHelper);
var gpsMonitor = new GpsMonitor(objOptions.gpsMonitor, logUtilHelper);
var dataDisplay = new DataDisplay(objOptions.dataDisplay, logUtilHelper);
//var ffmpegOverlay = new FfmpegOverlay(objOptions.ffmpegOverlay, logUtilHelper);
var videoOverlayParser = new VideoOverlayParser(objOptions.videoOverlayParser, logUtilHelper);
var ffmpegVideoInput = new FfmpegVideoInput(objOptions.ffmpegVideoInput, videoOverlayParser, logUtilHelper);

var radarDatabase = new RadarDatabase(objOptions.radarDatabase, logUtilHelper, objOptions.dataDirectory);

var commonData = {
    game: null,
    currentRadarSpeedData: null,
    radar: {log:[]}
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
app.use('/javascript/fontawesome', express.static(path.join(__dirname, 'node_modules', '@fortawesome','fontawesome-free')));
app.use('/javascript/bootstrap', express.static(path.join(__dirname, 'node_modules', 'bootstrap', 'dist')));
app.use('/javascript/jquery', express.static(path.join(__dirname, 'node_modules', 'jquery', 'dist')));
app.use('/javascript/moment', express.static(path.join(__dirname, 'node_modules', 'moment', 'min')));
app.use('/javascript/jsoneditor', express.static(path.join(__dirname, 'node_modules', 'jsoneditor', 'dist')));
//app.use('/javascript/bootstrap-table', express.static(path.join(__dirname, 'node_modules', 'bootstrap-table', 'dist')));
//app.use('/javascript/dragtable', express.static(path.join(__dirname, 'node_modules', 'dragtable')));
//app.use('/javascript/jquery-ui', express.static(path.join(__dirname, 'node_modules', 'jquery-ui', 'ui')));
// development only

app.set('port', objOptions.webserverPort);

app.use(favicon(__dirname + '/public/favicon.ico'));
//app.use(logger('dev'));

//app.use(logger.express);
//app.use(express.json());
//app.use(express.urlencoded({ extended: false }));
app.use(function (req, res, next) {
    var connInfo = logUtilHelper.getRequestConnectionInfo(req);
    logUtilHelper.logRequestConnectionInfo(appLogName, "browser", "debug", req);
    //logUtilHelper.log(appLogName, "browser", 'debug',  "url:" + req.originalUrl + ", ip:" + connInfo.ip + ", port:" + connInfo.port + ", ua:" + connInfo.ua);
    next();
    return;
})

app.use(cookieParser());



var routes = express.Router();


/* GET home page. */
routes.get('/', function (req, res) {
    res.sendFile(path.join(__dirname, 'public/index.htm'));
});

routes.get('/data/teams', function (req, res) {
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

routes.put('/data/uuidv4', function (req, res) {
    
    res.json({ id: uuidv4()});
    
    
});


routes.put('/data/scoregame', function (req, res) {
    var game = req.body;

    //radarDatabase.game_upsert(game, function (err, response) {
    //    if (err) {
    //        res.json(500, { err: err })
    //    } else {
            
    //        res.json(response);
    //    }
    //})
    commonData.game = game;
    if(ffmpegVideoInput != null){
       ffmpegVideoInput.updateOverlay({gameData:commonData.game, radarData:commonData.currentRadarSpeedData});
    }
    io.emit("gameChanged", { cmd: "scoreGame", data: { game: commonData.game } });
    res.json({ game: commonData.game });
    
});

routes.get('/data/games', function (req, res) {
    radarDatabase.game_getAll(function (err, response) {
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

routes.get('/data/audioFiles/walkup', function (req, res) {
    let walkupFiles = [];
    fs.readdir(walkupAudioDirectory, function (err, files) {
        if (err) {
            logUtilHelper.log(appLogName, "browser", "error", "Error getting walkup directory information.", walkupAudioDirectory);
        } else {
            files.forEach(function (file) {
                //console.log(file);
                if (path.extname(file) !== ".txt") {
                    walkupFiles.push({ fileName: file });
                }
            })
            res.json(walkupFiles);
        }
    })
});

routes.get('/data/audioFiles', function (req, res) {
    let audioFiles = [];
    fs.readdir(audioFileDirectory, function (err, files) {
        if (err) {
            logUtilHelper.log(appLogName, "browser", "error", "Error getting audio directory information.", audioFileDirectory);
        } else {
            files.forEach(function (file) {
                //console.log(file);
                if (path.extname(file) !== ".txt") {
                    audioFiles.push({ fileName: file });
                }
            })
            res.json(audioFiles);
        }
    })    
});

routes.get('/data/game/:id', function (req, res) {
    //res.json(commonData.game);
    radarDatabase.game_get(req.params.id, function (err, response) {
        if (err) {
            res.json(500, { err: err })
        } else {
            res.json(response);
        }
    })
});

routes.put('/data/game', function (req, res) {
    radarDatabase.game_upsert(req.body, function (err, response) {
        if (err) {
            res.json(500, { err: err })
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




app.use('/', routes);


var server = http.createServer(app).listen(app.get('port'), function(){
    logUtilHelper.log(appLogName, "app", "info", 'Express server listening on port ' + app.get('port'));
}); 


let periodicTimer = null;
const periodicTimerInterval = 60000;

var periodicTimerEvent = function () {
    if (commonData.gameIsDirty) {
        radarDatabase.game_upsert(commonData.game);
        commonData.gameIsDirty = false;
    }
}

var StartPeriodicTimerEvent = function () {
    if (periodicTimer !== null) {
        clearTimeout(periodicTimer);
        periodicTimer = null
    }
    setTimeout(periodicTimerEvent, periodicTimerInterval )
}

var StopPeriodicTimerEvent = function () {
    if (periodicTimer !== null) {
        clearTimeout(periodicTimer);
        periodicTimer = null
    }
}

var audioFilePlayer = null;

var playAudioFileComplete = function (audioFile) {
    io.emit("audio", { cmd: "audioPlayComplete", data: { audioFile: audioFile } });
}

var audioFilePlay = function (audioFolder, audioFile, options) {

    if (audioFilePlayer !== null) {
        audioFilePlayer.stop();
        audioFilePlayer = null;
    }
    
    audioFilePlayer = new FFplay(audioFolder, audioFile.fileName, options, logUtilHelper);

    audioFilePlayer.on("stopped", playAudioFileComplete);

}
var audioFileStop = function () {
    if (audioFilePlayer !== null) {
        audioFilePlayer.stop();
        audioFilePlayer = null;
    }
}

var io = require('socket.io')(server, {allowEIO3: true});



var sendToSocketClients = function (cmd, message, includeArduino){
    if (io) {

    }
}




io.on('connection', function(socket) {
    //logUtilHelper.log(appLogName, "socketio", "info", "socket.io client Connection");
    logUtilHelper.logSocketConnection (appLogName, "socketio", "info",  socket, "socket.io client Connection" );
    socket.on('radarConfigCommand', function(data) {
        logUtilHelper.log(appLogName, "socketio", "debug",'radarConfigCommand:' + data.cmd + ', value:' + data.data + ', client id:' + socket.id);
        radarStalker2.radarConfigCommand({ data: data, socket: socket });
    });
    socket.on('radarEmulatorCommand', function(data) {
        logUtilHelper.log(appLogName, "socketio", "debug",'radarEmulatorCommand:' + data.cmd + ', value:' + data.data + ', client id:' + socket.id);
        radarStalker2.radarEmulatorCommand({ data: data, socket: socket });
    });


    socket.on('videoStream', function (message) {
        logUtilHelper.log(appLogName, "socketio", "debug",'videoStream:' + message.cmd + ', client id:' + socket.id);
        switch (message.cmd) {
            case "start":
                ffmpegVideoInput.streamStart();
                break;
            case "stop":
                ffmpegVideoInput.streamStop();
                break;
            case "youtubeStart":
                ffmpegVideoInput.streamStartRtmp();
                break;
            case "youtubeStop":
                ffmpegVideoInput.streamStopRtmp();
                break;
            
            case "gamechangerStart":
                ffmpegVideoInput.streamStartRtmp2();
                break;
            case "gamechangerStop":
                ffmpegVideoInput.streamStopRtmp2();
                break;
            case "fileStart":
                ffmpegVideoInput.streamStartFile();
                break;
            case "fileStop":
                ffmpegVideoInput.streamStopFile();
                break;
            //Was used in cases where local CPU power not enough to encode so started encoding server side encoded and sent rtmp to distination
            // case "startRemote":
            //     io.emit('stream', message);
            //     break;
            // case "stopRemote":
            //     io.emit('stream', message);
            //     break;
        }

    });

    

    socket.on("audio", function (message) {
        //audioFile: audioFile

        logUtilHelper.log(appLogName, "socketio", "debug", 'audio:' + ', message:' + message + ', client id:' + socket.id);
        try {
            switch (message.cmd) {
                case "audioFilePlay":
                    audioFilePlay(audioFileDirectory, message.data.audioFile, ['-nodisp', '-autoexit', '-af', 'afade=t=in:st=0:d=5']);
                    break;
                case "audioFilePlayWalkup":
                    audioFilePlay(walkupAudioDirectory, message.data.audioFile, ['-nodisp', '-autoexit', '-af', 'afade=t=in:st=0:d=5,afade=t=out:st=10:d=5'])
                    break;
                case "audioFileStop":
                    audioFileStop();
                    break;
            }
        } catch (ex) {
            logUtilHelper.log(appLogName, "socketio", 'error', 'audio', ex);
        }

    });

    socket.on("resetRadarSettings", function (message) {
        logUtilHelper.log(appLogName, "socketio", "debug", 'resetRadarSettings:' + ', message:' + message + ', client id:' + socket.id);
        radarStalker2.resetRadarSettings();

    })

    socket.on("gameChange", function (message) {
        logUtilHelper.log(appLogName, "socketio", "debug", 'gameChange:' + ', message:' + message + ', client id:' + socket.id);
        if (commonData.game === null) {
            commonData.game = {};
        }
        switch (message.cmd) {

            case "gameChange":
                if (message.data.inning !== undefined) {
                    commonData.game.inning = message.data.inning;
                }
                if (message.data.inningPosition !== undefined) {
                    commonData.game.inningPosition = message.data.inningPosition;
                }

                if (message.data.score !== undefined) {
                    if (commonData.game.score === undefined) {
                        commonData.game.score = {};
                    }
                    if (message.data.score.guest !== undefined) {
                        commonData.game.score.guest = message.data.score.guest;
                    }
                    if (message.data.score.home !== undefined) {
                        commonData.game.score.home = message.data.score.home;
                    }

                }


                if (message.data.guest !== undefined) {
                    if (commonData.game.guest === undefined) {
                        commonData.game.guest = {};
                    }
                    if (message.data.guest.team !== undefined) {
                        commonData.game.guest.team = message.data.guest.team;
                    }
                    if (message.data.guest.lineup !== undefined) {
                        commonData.game.guest.lineup = message.data.guest.lineup;
                    }
                    if (message.data.guest.batterIndex !== undefined) {
                        commonData.game.guest.batterIndex = message.data.guest.batterIndex;
                    }

                }

                if (message.data.home !== undefined) {
                    if (commonData.game.home === undefined) {
                        commonData.game.home = {};
                    }
                    if (message.data.home.team !== undefined) {
                        commonData.game.home.team = message.data.home.team;
                    }
                    if (message.data.home.lineup !== undefined) {
                        commonData.game.home.lineup = message.data.home.lineup;
                    }
                    if (message.data.home.batterIndex !== undefined) {
                        commonData.game.home.batterIndex = message.data.home.batterIndex;
                    }

                }


                if (message.data.outs !== undefined) {
                    commonData.game.outs = message.data.outs;
                }
                if (message.data.strikes !== undefined) {
                    commonData.game.strikes = message.data.strikes;
                }
                if (message.data.balls !== undefined) {
                    commonData.game.balls = message.data.balls;
                }
                if (message.data.pitcher !== undefined) {
                    commonData.game.pitcher = message.data.pitcher;
                }
                if (message.data.batter !== undefined) {
                    commonData.game.batter = message.data.batter;
                }
                commonData.gameIsDirty = true;
                io.emit("gameChanged", { cmd: "gameChanged", data: message.data });      //use io to send it to everyone
                if(ffmpegVideoInput !== null){
                    ffmpegVideoInput.updateOverlay({gameData: commonData.game, radarData: commonData.currentRadarSpeedData});
                }
                break;
        }
        
    })

    //socket.on("pitcher", function (data) {
    //    debug('pitcher:'  + ', value:' + data.data + ', client id:' + socket.id);
    //    radarStalker2.pitcher({ data: data, socket: socket });
    //})

    //socket.on("batter", function (data) {
    //    debug('batter:' + data.cmd + ', value:' + data.data + ', client id:' + socket.id);
    //    radarStalker2.batter({ data: data, socket: socket });
    //})

    socket.on("pitch", function (message) {
        logUtilHelper.log(appLogName, "socketio", "debug", 'pitch:' + message.cmd + ', value:' + message.data + ', client id:' + socket.id);
        radarStalker2.pitch({ data: message, socket: socket });
    })

    socket.on('ping', function(data) {
        logUtilHelper.log(appLogName, "socketio", "debug", 'ping: client id:' + socket.id);
    });


    socket.on('config', function(message) {
        logUtilHelper.log(appLogName, "socketio", "debug", 'config:' + message.cmd + ' client id:' + socket.id);
        switch(message.cmd){
            case "get":
                break;

        }
    });

    socket.on('serverLogs', function(message) {
        logUtilHelper.log(appLogName, "socketio", "debug", 'serverLogs:' + message.cmd + ' client id:' + socket.id);
        switch(message.cmd){
            case "getServerLogs":
                socket.emit("serverLogs", {cmd:message.cmd, data: logUtilHelper.memoryData} )
                break;
            case "getAppLogLevels":
               socket.emit("serverLogs", {cmd:message.cmd, data: logUtilHelper.getLogLevelAppLogLevels} );
               break;
        }
        
        
    });


    

    


    if (socket.client.request.headers["origin"] !== "ArduinoSocketIo") {
        //send the current Config to the new client Connections
        socket.emit('radarConfig', radarStalker2.getRadarConfig());
        socket.emit('softwareConfig', radarStalker2.getSoftwareConfig());
        socket.emit('radarSpeedDataHistory', radarStalker2.getradarSpeedDataHistory());
        socket.emit('gameChanged', {cmd:"gameChanged", data:commonData.game});
    }
    //send the current Battery Voltage
    socket.emit('batteryVoltage', batteryMonitor.getBatteryVoltage());
    //console.log("gpsState", gpsMonitor.getGpsState())

    
});

radarStalker2.on('radarSpeed', function (data) {
    if (commonData.game) {
        data.pitcher = commonData.game.pitcher;
        data.batter = commonData.game.batter;
        if (commonData.game.log === undefined) {
            commonData.game.log = [];
        }
        commonData.game.log.push(JSON.parse(JSON.stringify(data)));
        commonData.gameIsDirty = true;
    }   
    commonData.radar.log.push(JSON.parse(JSON.stringify(data)));
    if(commonData.radar.log.length>objOptions.maxRadarLogLength){
        commonData.radar.log.shift()
    } 
    dataDisplay.updateSpeedData(data);
    io.emit('radarSpeed', data);
    commonData.currentRadarSpeedData = data;
    if(ffmpegVideoInput !== null){
        ffmpegVideoInput.updateOverlay({gameData: commonData.game, radarData: commonData.currentRadarSpeedData});
    }
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
//    logUtilHelper.log(appLogName, "socketio", "debug",'radarSpeed Connection');
//    req.io.emit('connected', {
//        message: 'Connected to Server'
//    })
//})

// command is the Comm
    

   

