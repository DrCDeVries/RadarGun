﻿//GpsMonitor.js
//This Module will open uart and connect to a nmea gps sensor using a serial port
//it then raises events based on events

var util = require('util');
var extend = require('extend');
var EventEmitter = require('events').EventEmitter;
var debug = require('debug')('gpsMonitor');
var nconf = require('nconf');
var exec = require('child_process').exec;

var GpsMonitor = function (options) {
    var self = this;
    var defaultOptions = {
        //loaded from the config file
    };
    nconf.file('./configs/gpsMonitorConfig.json');
    var configFileSettings = nconf.get();
    var objOptions = extend({}, defaultOptions, configFileSettings, options);


    // EventEmitters inherit a single event listener, see it in action
    this.on('newListener', function (listener) {
        debug('gpsMonitor Event Listener: ' + listener);
    });

    var commonData = {
        needToUpdateHostDateTime: objOptions.updateHostDateTime
    }
    var isBeagleBone = false
    //var boneScript;
    var isEnabled = false;

    //var SerialPort = require("serialport");   v4 syntax
    var SerialPort = require("serialport").SerialPort
    //use Global so we can access our instance of Serial Port from RadarCommandFiles

    var gpsSerialPortName = '';

    var gpsSerialPort;
    try{
        if (process.platform === 'win32') {
            gpsSerialPortName = objOptions.win32.portName;
            if (gpsSerialPortName) {
                gpsSerialPort = new SerialPort(gpsSerialPortName, {
                    baudrate: objOptions.win32.baudrate,
                    parser: SerialPort.parsers.readline('\r\n')
                }, false); // this is the openImmediately flag [default is true]
                isEnabled = true;
            } 
            //
        } else {
            gpsSerialPortName = objOptions.portName;
            //var b = require('bonescript');
            isBeagleBone == true;
            if (gpsSerialPortName) {
                //gpsSerialPort = b.serialOpen(gpsSerialPortName, {
                //    baudrate: objOptions.baudrate,
                //    parser: SerialPort.parsers.readline('\r\n') //SerialPort.parsers.readline('\n')
                //}, function () {
                //    debug('bonescript serial device activated');
                //});
                gpsSerialPort = new SerialPort(gpsSerialPortName, {
                    baudrate: objOptions.baudrate,
                    parser: SerialPort.parsers.readline('\r\n')
                }, false); // this is the openImmediately flag [default is true]
                isEnabled = true;
            }

        }
    } catch (ex) {
        debug('error  ' + gpsSerialPortName, ex);
    }


    debug('started gpsMonitor on port ' + gpsSerialPortName);
    var GPS = require('gps');
    var gps = new GPS;
    gps.on('data', function (data) {
        //debug(data, gps.state);
        
        if (isBeagleBone && commonData.needToUpdateHostDateTime == true && !data.time) {

            exec('date -s "' + data.time.toString() + '"', function (error, stdout, stderr) {
                if (error) {
                    //throw error
                    debug("error setting host time to " + data.time.toString(), error);
                } else {
                    // Clock should be set now
                    commonData.needToUpdateHostDateTime == true
                    debug("Set host time to " + data.time.toString());
                }
            });
        }
    });

    var handleGpsSerialData =  function (data) {
        debug("Gps Data" + data.toString());
        gps.update(data);
    }

    // Call the update routine directly with a NMEA sentence, which would
    // come from the serial port or stream-reader normally
    if (gpsSerialPort) {
        gpsSerialPort.on('data', handleGpsSerialData);
        gpsSerialPort.open(function (err) {
            if (err) {
                debug('open Error' + err);
            }
        });
    }

    this.getGpsState = function () {
        if (isEnabled == true) {
            return gps.state;
        }
    }
};
// extend the EventEmitter class using our RadarMonitor class
util.inherits(GpsMonitor, EventEmitter);

module.exports = GpsMonitor;