'use strict';
const appLogName = "ffmpegVideoOutputRtmp";
var util = require('util');
const EventEmitter = require('events').EventEmitter;
//const debug = require('debug')('ffmpegVideoCapture');
const path = require('path');
const extend = require('extend');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const { Stream } = require("stream");
var FfmpegVideoOutputRtmp = function (options, videoOverlayParser, logUtilHelper) {

    var self = this;
    var defaultOptions = {
        "rtmpUrl": "",
        "outputOptions": null, //[ "-c:a copy", "-pix_fmt +", "-c:v h264_nvenc", "-g 25", "-use_wallclock_as_timestamps 1", "-fflags +genpts", "-r 50", "-preset llhq", "-rc vbr_hq", "-f flv" ],
        "overlayFileName": null,
        "videoFilters": null
    }

    if(logUtilHelper === null){
        throw new Error("logUtilHelper Can't be Null");
    }

    self.options = extend({}, defaultOptions, options);
    
    self.videoOverlayParser = videoOverlayParser;

    if (process.platform === 'win32' && (process.env.FFMPEG_PATH === undefined || process.env.FFMPEG_PATH === '')) {
        process.env.FFMPEG_PATH = path.join(__dirname, '..', 'ffmpeg', 'ffmpeg.exe');
    }

    if (process.platform === 'win32' && (process.env.FFPROBE_PATH === undefined || process.env.FFPROBE_PATH === '')) {
        process.env.FFPROBE_PATH = path.join(__dirname, '..', 'ffmpeg', 'ffprobe.exe');
    }

    var commonData = {
           streamStats: {
            incoming: {
                chunkCounter: 0,
                chunkShow: 0,
                status: "disconnected",
                error: null,
                metadata: {},
            }
        }
    };

    var command = null;

    var parseStdOutput = function (stderr) {

        //assumes // Assumes .outputOptions('-loglevel level')  so loglevel proceeds information
        var data = {
            type: "N/A", value: stderr, values: {}
        };

        try {
            var startPosition = 0;
            var name = '';
            var value = '';
            if (stderr[0] === '[') {
                //string
                startPosition = stderr.indexOf(']');
                var type = stderr.slice(1, startPosition);
                //sometimes the message has two [] ie  [mp3 @ 000001ef0c8d9f00] [info] Skipping 33 bytes of junk at 0.  or  [https @ 000001b6622fc0c0] [verbose] Metadata update for StreamTitle: Halsey - New Americana
                startPosition = startPosition + 2;
                stopPosition = stderr.indexOf(']', startPosition);
                if (stopPosition >= 0) {
                    data.postion = type;
                    type = stderr.slice(startPosition + 1, stopPosition);
                    startPosition = stopPosition + 2;
                    data.type = type;
                } else {
                    data.type = type;
                }
                var stopPosition = stderr.indexOf('=', startPosition);

                //there is a = delimited and a : delimited message
                if (stopPosition >= 0) {
                    //this ia an = delimited message
                    //stopPosition = stderr.indexOf('=', startPosition);


                    while (startPosition >= 0) {
                        stopPosition = stderr.indexOf('=', startPosition);
                        name = '';
                        value = '';
                        if (stopPosition > 0) {
                            name = stderr.slice(startPosition, stopPosition);
                            if (name) {
                                name = name.trim().replace(/-/g, '').replace(/ /g, '');
                            }
                            startPosition = stopPosition + 1;
                            //because there can be whitespace between = and value we need to find next = or end of string then backtrack
                            stopPosition = stderr.indexOf('=', startPosition);
                            if (stopPosition >= 0) {
                                stopPosition = stderr.lastIndexOf(' ', stopPosition);
                                value = stderr.slice(startPosition, stopPosition);
                                if (value) {
                                    value = value.trim();
                                }
                            } else {
                                //this is the last value so end of string is
                                value = stderr.slice(startPosition);
                                if (value) {
                                    value = value.trim();
                                }
                            }
                            if (name && value) {
                                data.values[name] = value;
                            }
                        }
                        startPosition = stopPosition;

                    }
                } else {
                    stopPosition = stderr.indexOf(':', startPosition);
                    if (stopPosition >= 0) {

                        while (startPosition >= 0) {
                            stopPosition = stderr.indexOf(':', startPosition);
                            name = '';
                            value = '';
                            if (stopPosition > 0) {
                                name = stderr.slice(startPosition, stopPosition);
                                if (name) {
                                    name = name.trim().replace(/-/g, '').replace(/ /g, '');
                                    if (name === "MetadataupdateforStreamTitle") {
                                        name = "StreamTitle";
                                    }
                                }
                                startPosition = stopPosition + 1;
                                //because there can be whitespace between = and value we need to find next = or end of string then backtrack
                                stopPosition = stderr.indexOf(':', startPosition);
                                //if (stopPosition >= 0) {
                                //    stopPosition = stderr.lastIndexOf(' ', stopPosition);
                                //    value = stderr.slice(startPosition, stopPosition);
                                //    if (value) {
                                //        value = value.trim();
                                //    }
                                //} else {
                                //this is the last value so end of string is
                                value = stderr.slice(startPosition);
                                if (value) {
                                    value = value.trim();
                                }
                                // }
                                if (name && value) {
                                    data.values[name] = value;
                                }
                            }
                            startPosition = stopPosition;

                        }
                    }
                }
            }
        } catch (ex) {
            logUtilHelper.log(appLogName, "app", "error", "error parsing stderror", stderr);
        }
        return data;
    };

    var commandStdError = function (stderr) {

        var stdOut = parseStdOutput(stderr);

        switch (stdOut.type) {
            case 'info':
            case 'verbose':
                if (stdOut.values.size) {
                    commonData.streamStats.info = stdOut.values;
                    logUtilHelper.log(appLogName, "app", 'trace', self.options.rtmpUrl, 'parsed stdErr: ', stdOut);
                } else {
                    logUtilHelper.log(appLogName, "app", 'debug', self.options.rtmpUrl, 'parsed stdErr: ', stdOut);
                }
            
                break;
            default:
                logUtilHelper.log(appLogName, "app", 'debug', self.options.rtmpUrl, 'parsed stderr: ', stdOut);
        }

    
    };

    var commandError = function (err, stdout, stderr) {
        logUtilHelper.log(appLogName, "app", 'error',  self.options.rtmpUrl, 'an error happened: ' + err.message, err, stdout, stderr);
        commonData.streamStats.status = "disconnected";
        commonData.streamStats.error = err;
        commonData.streamStats.stdout = stdout;
        commonData.streamStats.stderr = stderr;
        self.emit('streamStats', commonData.streamStats);
        // if (err && err.message && err.message.startsWith('ffmpeg exited with code') === true) {
        //     setTimeout(restartStream, 30000);
        // }
    };

    var commandProgress = function (progress) {

        if (commonData.streamStats.status === "disconnected") {
            commonData.streamStats.status = "connected";
            self.emit('streamStats', commonData.streamStats);
        
        }
        //proc_count++;
    };

    var commandEnd = function (result) {
        commonData.streamStats.status = "disconnected";
        commonData.streamStats.error = "commandEnd Called";
        self.emit('streamStats', commonData.streamStats);
        logUtilHelper.log(appLogName, "app", 'error',  self.options.rtmpUrl, 'Source Stream Closed');
    };

    

    var incomingTransStream = null;
    var incomingTransStreamChunkCounter = 0;
    var incomingTransStreamChunkShow = 0;
    incomingTransStream = new Stream.Transform({highWaterMark: 1638400});
    incomingTransStream._transform = function (chunk, encoding, done) {
        try {
            if(incomingTransStreamChunkCounter >= incomingTransStreamChunkShow ){
                logUtilHelper.log(appLogName, "app", 'debug', self.options.rtmpUrl, '[' + incomingTransStreamChunkCounter + '] transform stream chunk length: ' + chunk.length + ', highwater: ' + this.readableHighWaterMark);
                incomingTransStreamChunkShow = incomingTransStreamChunkShow + 50;
            }
            incomingTransStreamChunkCounter++;
            this.push(chunk);
            return done();
        } catch (ex) {
            logUtilHelper.log(appLogName, "app", "error", self.options.rtmpUrl, ex);
        }
    };

    // // Start incomingMonitor Stream 
    // // Read from the source stream, to keeps it alive and flowing
    // var incomingMonitorStream = new Stream.Writable({});
    // // Consume the stream
    // incomingMonitorStream._write = (chunk, encoding, next) => {
        
    //     commonData.streamStats.incoming.chunkCounter++;
    //     if (commonData.streamStats.incoming.chunkCounter >= commonData.streamStats.incoming.chunkShow) {
    //         logUtilHelper.log(appLogName, "app", 'trace', "incomingMonitorStream", "chunks processed: " + commonData.streamStats.incoming.chunkCounter);
    //         commonData.streamStats.incoming.chunkShow = commonData.streamStats.incoming.chunkShow + 50;
    //         self.emit('streamStats', commonData.streamStats, false);
    //     }
        
    //     next();
    // };

    // incomingTransStream.pipe(incomingMonitorStream);


    var startIncomingStream = function (sourceStream) {
    
        if (!(command === null || command === undefined)) {
            command.kill();
        }
        commonData.streamStats.status = "connected"; 
        self.emit('streamStats', commonData.streamStats);
        logUtilHelper.log(appLogName, "app", "info", "RTMP destination", self.options.rtmpUrl)
        command = ffmpeg({ source: incomingTransStream });    
        //command = ffmpeg({ source: sourceStream });    
        command.inputOptions(self.options.inputOptions)
        
        command.addOption('-loglevel level+info')       //added by Andy so we can parse out stream info            
        command.on('error', commandError)
        command.on('progress', commandProgress)
        command.on('stderr', commandStdError)
        command.on('end', commandEnd);
        
        if (self.options.videoFilters) {
            command.videoFilters(self.options.videoFilters);
        }
        command.output(self.options.rtmpUrl)
        command.outputOptions(self.options.outputOptions)
        if(self.options.rtmpUrl2){
            command.output(self.options.rtmpUrl2)
            if(self.options.outputOptions2){
                command.outputOptions(self.options.outputOptions2)
            }
        }
        command.run();
        
        logUtilHelper.log(appLogName, "app", "info", self.options.rtmpUrl, "ffmpeg Started");
    };

    var streamStart = function (sourceStream,throwError) {
        logUtilHelper.log(appLogName, "app", 'info', self.options.rtmpUrl, 'streamStart Command');
    try {
        sourceStream.unpipe(incomingTransStream);
        sourceStream.pipe(incomingTransStream);
        startIncomingStream(sourceStream);
    } catch (ex) {
        logUtilHelper.log(appLogName, "app", 'error',  self.options.rtmpUrl, 'Error Starting Video Stream ', ex);
        if (throwError === true) {
            throw ex;
        }
    }
};



    var streamKill = function (sourceStream,throwError) {
        commonData.shouldAutoRestart = false;
            
        logUtilHelper.log(appLogName, "app", 'warning', self.options.rtmpUrl, 'streamKill command');
        try {
            sourceStream.unpipe(incomingTransStream);
            commonData.streamStats.status = "disconnected";
            commonData.streamStats.error = "commandEnd Called";
            if (!(command === null || command === undefined)) {
                command.kill();
            }
            self.emit("streamStats", commonData.streamStats);
        } catch (ex) {
            logUtilHelper.log(appLogName, "app", 'error', 'Error Killing Video Stream ', ex);
            if (throwError === true) {
                throw ex;
            }
        }
    };


    var streamStop = function (sourceStream,throwError) {
        commonData.shouldAutoRestart = false;
        logUtilHelper.log(appLogName, "app", 'warning', self.options.rtmpUrl, 'streamStop command');
        try {
            sourceStream.unpipe(incomingTransStream);
            commonData.streamStats.status = "disconnected";
            commonData.streamStats.error = "commandEnd Called";
            if (!(command === null || command === undefined || command.ffmpegProc === null || command.ffmpegProc === undefined || command.ffmpegProc.stdin === null || command.ffmpegProc.stdin === undefined)) {
                command.ffmpegProc.stdin.write('q');
            }else{
                streamKill(sourceStream,throwError);
            }
            self.emit("streamStats", commonData.streamStats);
        } catch (ex) {
            logUtilHelper.log(appLogName, "app", 'error',  self.options.rtmpUrl, 'Error Stopping Video Stream ', ex);
            if (throwError === true) {
                throw ex;
            }
        }
    };

    var updateOverlay = function (options) {
        try {
            if(self.videoOverlayParser){
                var overlayText = self.videoOverlayParser.getOverlayText(options)
                if(self.options.overlayFileName != null ){
                    var overlayFilePath = path.join(__dirname, '..', self.options.overlayFileName);
                    try {
                        fs.writeFileSync(overlayFilePath, overlayText);

                    } catch (ex) {
                        logUtilHelper.log(appLogName, "app", "error", self.options.rtmpUrl, "Error Writing OverlayText File", ex);
                    }
                }   
            }else{
                logUtilHelper.log(appLogName, "app", "warning", self.options.rtmpUrl, "videoOverlayParser is not set", ex);    
            }
        } catch (ex) {
            logUtilHelper.log(appLogName, "app", "error", self.options.rtmpUrl, "Error updating Overlay", ex);
        }
    }

    self.streamStart = streamStart;
    self.streamStop = streamStop;
    self.streamKill = streamKill;
    self.updateOverlay = updateOverlay;
    self.commonData = function () {
        return commonData;
    }

}
// extend the EventEmitter class using our RadarMonitor class
util.inherits(FfmpegVideoOutputRtmp, EventEmitter);

module.exports = FfmpegVideoOutputRtmp;

