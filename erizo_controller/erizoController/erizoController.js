/*global require, setInterval, clearInterval, exports*/
'use strict';
var rpcPublic = require('./rpc/rpcPublic');
var config = require('./../../licode_config');
var Getopt = require('node-getopt');

// Configuration default values
global.config = config || {};
global.config.erizoController = global.config.erizoController || {};
global.config.erizoController.iceServers =
  global.config.erizoController.iceServers || [{'url': 'stun:stun.l.google.com:19302'}];
global.config.erizoController.defaultVideoBW = global.config.erizoController.defaultVideoBW || 300;
global.config.erizoController.maxVideoBW = global.config.erizoController.maxVideoBW || 300;
global.config.erizoController.publicIP = global.config.erizoController.publicIP || '';
global.config.erizoController.hostname = global.config.erizoController.hostname|| '';
global.config.erizoController.port = global.config.erizoController.port || 8080;
global.config.erizoController.ssl = global.config.erizoController.ssl || false;
// jshint ignore:start
global.config.erizoController.ssl_key =
  global.config.erizoController.ssl_key || '../../cert/key.pem';
global.config.erizoController.ssl_cert =
  global.config.erizoController.ssl_cert || '../../cert/cert.pem';
global.config.erizoController.sslCaCerts =
  global.config.erizoController.sslCaCerts || undefined;
global.config.erizoController.listen_port = global.config.erizoController.listen_port || 8080;
global.config.erizoController.listen_ssl = global.config.erizoController.listen_ssl || false;
global.config.erizoController.turnServer = global.config.erizoController.turnServer || undefined;
global.config.erizoController.warning_n_rooms = global.config.erizoController.warning_n_rooms || 15;
global.config.erizoController.limit_n_rooms = global.config.erizoController.limit_n_rooms || 20;
global.config.erizoController.interval_time_keepAlive =
  global.config.erizoController.interval_time_keepAlive || 1000;
global.config.erizoController.report.session_events =
  global.config.erizoController.report.session_events || false;
global.config.erizoController.recording_path =
  global.config.erizoController.recording_path || undefined;
global.config.erizoController.exitOnNuveCheckFail = global.config.erizoController.exitOnNuveCheckFail || false;
global.config.erizoController.allowSinglePC = global.config.erizoController.allowSinglePC || '';
global.config.erizoController.maxErizosUsedByRoom = global.config.erizoController.maxErizosUsedByRoom || 100;

// jshint ignore:end
global.config.erizoController.roles = global.config.erizoController.roles ||
                  {'presenter': {'publish': true, 'subscribe': true, 'record': true},
                  'viewer': {'subscribe': true},
                  'viewerWithData':{'subscribe': true,
                                    'publish':{'audio':  false,
                                               'video':  false,
                                               'screen': false,
                                               'data':   true}}};

// Parse command line arguments
var getopt = new Getopt([
  ['r' , 'rabbit-host=ARG'         , 'RabbitMQ Host'],
  ['g' , 'rabbit-port=ARG'         , 'RabbitMQ Port'],
  ['b' , 'rabbit-heartbeat=ARG'    , 'RabbitMQ AMQP Heartbeat Timeout'],
  ['l' , 'logging-config-file=ARG' , 'Logging Config File'],
  ['t' , 'iceServers=ARG'          , 'Ice Servers URLs Array'],
  ['b' , 'defaultVideoBW=ARG'      , 'Default video Bandwidth'],
  ['M' , 'maxVideoBW=ARG'          , 'Max video bandwidth'],
  ['i' , 'publicIP=ARG'            , 'Erizo Controller\'s public IP'],
  ['H' , 'hostname=ARG'            , 'Erizo Controller\'s hostname'],
  ['p' , 'port'                    , 'Port used by clients to reach Erizo Controller'],
  ['S' , 'ssl'                     , 'Enable SSL for clients'],
  ['L' , 'listen_port'             , 'Port where Erizo Controller will listen to new connections.'],
  ['s' , 'listen_ssl'              , 'Enable HTTPS in server'],
  ['R' , 'recording_path'          , 'Recording path.'],
  ['h' , 'help'                    , 'display this help']
]);

var opt = getopt.parse(process.argv.slice(2));

for (var prop in opt.options) {
    if (opt.options.hasOwnProperty(prop)) {
        var value = opt.options[prop];
        switch (prop) {
            case 'help':
                getopt.showHelp();
                process.exit(0);
                break;
            case 'rabbit-host':
                global.config.rabbit = global.config.rabbit || {};
                global.config.rabbit.host = value;
                break;
            case 'rabbit-port':
                global.config.rabbit = global.config.rabbit || {};
                global.config.rabbit.port = value;
                break;
            case 'rabbit-heartbeat':
                global.config.rabbit = global.config.rabbit || {};
                global.config.rabbit.heartbeat = value;
                break;
            case 'logging-config-file':
                global.config.logger = global.config.logger || {};
                global.config.logger.configFile = value;
                break;
            default:
                global.config.erizoController[prop] = value;
                break;
        }
    }
}

// Load submodules with updated config
var logger = require('./../common/logger').logger;
var amqper = require('./../common/amqper');
var ecch = require('./ecCloudHandler').EcCloudHandler({amqper: amqper});
var nuve = require('./nuveProxy').NuveProxy({amqper: amqper});
var Rooms = require('./models/Room').Rooms;
var Channel = require('./models/Channel').Channel;

// Logger
var log = logger.getLogger('ErizoController');

var server;

if (global.config.erizoController.listen_ssl) {  // jshint ignore:line
    var https = require('https');
    var fs = require('fs');
    var options = {
        key: fs.readFileSync(config.erizoController.ssl_key).toString(), // jshint ignore:line
        cert: fs.readFileSync(config.erizoController.ssl_cert).toString() // jshint ignore:line
    };
    if (config.erizoController.sslCaCerts) {
        options.ca = [];
        for (var ca in config.erizoController.sslCaCerts) {
            options.ca.push(fs.readFileSync(config.erizoController.sslCaCerts[ca]).toString());
        }
    }
    server = https.createServer(options);
} else {
    var http = require('http');
    server = http.createServer();
}

server.listen(global.config.erizoController.listen_port); // jshint ignore:line
var io = require('socket.io').listen(server, {log:false});

io.set('transports', ['websocket']);

var EXIT_ON_NUVE_CHECK_FAIL = global.config.erizoController.exitOnNuveCheckFail;
var WARNING_N_ROOMS = global.config.erizoController.warning_n_rooms; // jshint ignore:line
var LIMIT_N_ROOMS = global.config.erizoController.limit_n_rooms; // jshint ignore:line

var INTERVAL_TIME_KEEPALIVE = global.config.erizoController.interval_time_keepAlive; // jshint ignore:line

var BINDED_INTERFACE_NAME = global.config.erizoController.networkInterface;

var myId;
var rooms = new Rooms(amqper, ecch);

var myState;

var privateRegexp;
var publicIP;

var addToCloudHandler = function (callback) {
    var interfaces = require('os').networkInterfaces(),
        addresses = [],
        k,
        k2,
        address;

    for (k in interfaces) {
        if (!global.config.erizoController.networkinterface ||
            global.config.erizoController.networkinterface === k) {
          if (interfaces.hasOwnProperty(k)) {
              for (k2 in interfaces[k]) {
                  if (interfaces[k].hasOwnProperty(k2)) {
                      address = interfaces[k][k2];
                      if (address.family === 'IPv4' && !address.internal) {
                          if (k === BINDED_INTERFACE_NAME || !BINDED_INTERFACE_NAME) {
                              addresses.push(address.address);
                          }
                      }
                  }
              }
          }
        }
    }

    privateRegexp = new RegExp(addresses[0], 'g');

    if (global.config.erizoController.publicIP === '' ||
        global.config.erizoController.publicIP === undefined){
        publicIP = addresses[0];
    } else {
        publicIP = global.config.erizoController.publicIP;
    }

    var startKeepAlives = (erizoControllerId, publicIP) => {
      var intervalId = setInterval(function () {
        nuve.keepAlive(erizoControllerId)
        .then(() => true)
        .catch(result => {
          if (result === 'whoareyou') {
              // TODO: It should try to register again in Cloud Handler.
              // But taking into account current rooms, users, ...
              log.error('message: This ErizoController does not exist in cloudHandler ' +
                        'to avoid unexpected behavior this ErizoController will die');
              clearInterval(intervalId);
              return false;
          }
          return true;
        }).then((result) => {
          if (!result) {
              nuve.killMe(publicIP);
              if (EXIT_ON_NUVE_CHECK_FAIL) {
                  log.error('message: Closing ErizoController ' +
                   '- does not exist in Nuve CloudHandler');
                  process.exit(-1);
              }
          }

        });
      }, INTERVAL_TIME_KEEPALIVE);
    };

    var addECToCloudHandler = function(attempt) {
        if (attempt <= 0) {
            log.error('message: addECtoCloudHandler cloudHandler does not respond - fatal');
            return;
        }

        var controller = {
            cloudProvider: global.config.cloudProvider.name,
            ip: publicIP,
            hostname: global.config.erizoController.hostname,
            port: global.config.erizoController.port,
            ssl: global.config.erizoController.ssl
        };
        nuve.addNewErizoController(controller).then(msg => {
          log.info('message: succesfully added to cloudHandler');

          publicIP = msg.publicIP;
          myId = msg.id;
          myState = 2;

          startKeepAlives(myId, publicIP);
          callback('callback');
        }).catch(reason => {
          if (reason === 'timeout') {
            log.warn('message: addECToCloudHandler cloudHandler does not respond, ' +
                     'attemptsLeft: ' + attempt );

            // We'll try it more!
            setTimeout(function() {
                attempt = attempt - 1;
                addECToCloudHandler(attempt);
            }, 3000);
          } else {
            log.error('message: cannot contact cloudHandler');
          }
        });
    };
    addECToCloudHandler(5);
};

//*******************************************************************
//       When adding or removing rooms we use an algorithm to check the state
//       If there is a state change we send a message to cloudHandler
//
//       States:
//            0: Not available
//            1: Warning
//            2: Available
//*******************************************************************
var updateMyState = function () {
    var nRooms = 0, newState;

    nRooms = rooms.size();

    log.debug('message: Updating my state, id:', myId, ', rooms:', nRooms);

    if (nRooms < WARNING_N_ROOMS) {
        newState = 2;
    } else if (nRooms > LIMIT_N_ROOMS) {
        log.warn('message: reached Room Limit, roomLimit:' + LIMIT_N_ROOMS);
        newState = 0;
    } else {
        log.warn('message: reached Warning room limit, ' +
                 'warningRoomLimit: ' + WARNING_N_ROOMS + ', ' +
                 'roomLimit: ' + LIMIT_N_ROOMS);
        newState = 1;
    }

    if (newState === myState) {
        return;
    }

    myState = newState;

    nuve.setInfo({id: myId, state: myState});
};

var getSinglePCConfig = function(singlePC) {
  return !!singlePC && global.config.erizoController.allowSinglePC;
};

var listen = function () {
    io.sockets.on('connection', function (socket) {
        log.info('message: socket connected, socketId: ' + socket.id);

        let channel = new Channel(socket, nuve);

        channel.on('connected', (token, options, callback) => {
          options = options || {};
          try {
            let room = rooms.getOrCreateRoom(token.room, token.p2p);
            options.singlePC = getSinglePCConfig(options.singlePC);
            let client = room.createClient(channel, token, options);
            log.info('message: client connected, clientId: ' + client.id +
                     ', singlePC: ' + options.singlePC);
            if (!room.p2p && global.config.erizoController.report.session_events) {  // jshint ignore:line
              var timeStamp = new Date();
              amqper.broadcast('event', {room: room.id,
                                         user: client.id,
                                         type: 'user_connection',
                                         timestamp: timeStamp.getTime()});
            }

            let streamList = [];
            room.forEachStream((stream) => {
              streamList.push(stream.getPublicStream());
            });

            callback('success', {streams: streamList,
                                 id: room.id,
                                 clientId: client.id,
                                 singlePC: options.singlePC,
                                 p2p: room.p2p,
                                 defaultVideoBW: global.config.erizoController.defaultVideoBW,
                                 maxVideoBW: global.config.erizoController.maxVideoBW,
                                 iceServers: global.config.erizoController.iceServers});
          } catch(e) {
            log.warn('message: error creating Room or Client, error:', e);
          }
        });

        channel.on('reconnected', clientId => {
          rooms.forEachRoom(room => {
            const client = room.getClientById(clientId);
            if (client !== undefined) {
              client.setNewChannel(channel);
            }
          });
        });

        socket.channel = channel;
    });
};


/*
 *Gets a list of users in a given room.
 */
exports.getUsersInRoom = function (roomId, callback) {
    let users = [];
    let room = rooms.getRoomById(roomId);
    if (room === undefined) {
        callback(users);
        return;
    }

    room.forEachClient((client) => {
      users.push(client.user);
    });

    callback(users);
};

/*
 *Remove user from a room.
 */
exports.deleteUser = function (user, roomId, callback) {
    let room = rooms.getRoomById(roomId);

    if (room === undefined) {
       callback('Success');
       return;
    }
    let clientsToDelete = [];

    room.forEachClient((client) => {
      if (client.user.name === user) {
        clientsToDelete.push(client);
      }
    });

    for (let client of clientsToDelete) {
        log.info('message: deleteUser, user: ' + client.user.name);
        client.disconnect();
    }

    if (clientsToDelete.length !== 0) {
        callback('Success');
    } else {
        log.error('mesagge: deleteUser user does not exist, user: ' + user );
        callback('User does not exist');
    }
};


/*
 * Delete a room.
 */
exports.deleteRoom = function (roomId, callback) {
    log.info('message: deleteRoom, roomId: ' + roomId);

    let room = rooms.getRoomById(roomId);

    if (room === undefined) {
       callback('Success');
       return;
    }

    if (!room.p2p) {
      room.forEachClient((client) => {
        room.controller.removeSubscriptions(client.id);
      });
      room.forEachStream((stream) => {
        if (stream.hasAudio() || stream.hasVideo() || stream.hasScreen()) {
          room.controller.removePublisher(stream.getID());
        }
      });
    }

    room.forEachClient((client) => {
      client.channel.disconnect();
    });

    rooms.deleteRoom(roomId);

    updateMyState();
    callback('Success');
};

amqper.connect(function () {
  try {
    rooms.on('updated', updateMyState);
    amqper.setPublicRPC(rpcPublic);

    addToCloudHandler(function () {
      var rpcID = 'erizoController_' + myId;
      amqper.bind(rpcID, listen);
    });
  } catch (error) {
    log.info('message: Error in Erizo Controller, ' + logger.objectToLog(error));
  }
});
