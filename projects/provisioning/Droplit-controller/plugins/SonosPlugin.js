/**
* Created by Nik! on 7/1/2014.
*/

'use strict';

var async = require('async');
var EasySax = require('easysax');
var Q = require('q');
var util = require('util');

var droplitPlugin = require('./DroplitPlugin');
var droplitConstants = require('./DroplitConstants');

var sonosPlugin = function () {
    var self = this;
    sonosPlugin.super_.call(this);

    var sonosDiscovery = require('sonos-discovery');
    var discovery = null;
    var STEP_SIZE = 5;
    var playerStates = {};
    var coordinatorLookup = {};

    this.connect = function (connectInfo) {
        discovery = new sonosDiscovery();

        // Disable sonos library's console output
        discovery.log.remove(discovery.log.transports.console);

        discovery.on('group-mute', onGroupMute);
        discovery.on('group-volume', onGroupVolume);
        discovery.on('mute', onMute);
        discovery.on('topology-change', onTopologyChange);
        discovery.on('transport-state', onTransportState);
    }

    // Sonos events
    function onGroupMute(data) {
        if (!playerStates[data.uuid])
            playerStates[data.uuid] = {};

        if (!('mute' in playerStates[data.uuid]) || playerStates[data.uuid].mute !== data.state.mute) {
            playerStates[data.uuid].mute = data.state.mute;
            self.servicePropertyChanged(data.uuid, "AudioOutput", "mute", data.state.mute);
        }
    }
    function onGroupVolume(data) {
        if (!playerStates[data.uuid])
            playerStates[data.uuid] = {};

        if (!playerStates[data.uuid].volume || playerStates[data.uuid].volume !== data.groupState.volume) {
            playerStates[data.uuid].volume = data.groupState.volume;
            self.servicePropertyChanged(data.uuid, "AudioOutput", "volume", data.groupState.volume);
        }
    }
    function onMute(data) { }
    function onTopologyChange(data) {
        var groupChange = [];
        for (var uuid in discovery.players) {
            var player = discovery.players[uuid];
            console.log('player', player.uuid);

            // Update player grouping lookup
            if (player.coordinator.uuid != player.uuid) {
                if (!coordinatorLookup.hasOwnProperty(player.coordinator.uuid))
                    coordinatorLookup[player.coordinator.uuid] = {};
                if (!coordinatorLookup[player.coordinator.uuid].hasOwnProperty(player.uuid)) {
                    groupChange.push(player.uuid);
                    coordinatorLookup[player.coordinator.uuid][player.uuid] = true;
                }
            }
            else
                Object.keys(coordinatorLookup).forEach(function (key) {
                    if (coordinatorLookup[key].hasOwnProperty(player.uuid)) {
                        // Only queue as change for existing players
                        if (playerStates.hasOwnProperty(player.uuid))
                            groupChange.push(player.uuid);
                        delete coordinatorLookup[key][player.uuid];
                    }
                    if (Object.keys(coordinatorLookup[key]).length == 0)
                        delete coordinatorLookup[key];
                });

            // No need to emit discovered for already discovered devices
            if (playerStates.hasOwnProperty(player.uuid))
                continue;

            player.getDescriptionInfo(function (player, info) {
                playerStates[player.uuid] = {};
                self.deviceDiscovered({
                    address: player.address,
                    identifier: player.uuid,
                    manufacturer: 'Sonos, Inc.',
                    productName: [info.modelName, player.roomName].join(' '),
                    productType: info.modelName,
                    name: '',
                    services: ['AudioOutput', 'BinarySwitch', 'Indicator', 'MediaControl', 'MediaInfo'],
                    promotedMembers: {
                        'blink': 'Indicator.blink',
                        'switch': 'BinarySwitch.switch',
                        'play': 'MediaControl.play',
                        'pause': 'MediaControl.pause',
                        'next': 'MediaControl.next',
                        'previous': 'MediaControl.previous',
                        'mute': 'AudioOutput.mute',
                        'unmute': 'AudioOutput.unmute',
                        'volume': 'AudioOutput.volume'
                    }
                });
                var data = player.convertToSimple();
                processStateChanges(data);
            } .bind(this, player));
        }
        for (var i in groupChange) {
            var uuid = groupChange[i];
            var player = discovery.players[uuid];
            var data = player.convertToSimple();
            processStateChanges(data);
        }
    }
    function onTransportState(data) {
        processStateChanges(data);
    }

    // Binary Switch implementation
    self.get_switch = function (identifier, address, cb) {
        if (discovery) {
            var player = discovery.getPlayerByUUID(identifier);
            if (!player)
                return;
            var on = player.getState().playerState == 'PLAYING' ? 'on' : 'off';
            cb(on);
        }
    }
    self.set_switch = function (identifier, address, value) {
        switch (value) {
            case "off":
                self.switchOff(identifier, address);
                break;
            case "on":
                self.switchOn(identifier, address);
                break;
        }
    }
    self.switchOff = function (identifier, address) {
        if (discovery) {
            var player = discovery.getPlayerByUUID(identifier);
            if (!player)
                return;
            player.pause();
        }
    }
    self.switchOn = function (identifier, address) {
        if (discovery) {
            var player = discovery.getPlayerByUUID(identifier);
            if (!player)
                return;
            player.play();
        }
    }

    // Audio Output implementation
    self.get_mute = function (identifier, address, cb) {
        if (discovery) {
            var player = discovery.getPlayerByUUID(identifier);
            if (!player)
                return;
            cb(player.getState().mute);
        }
    }
    self.get_volume = function (identifier, address, cb) {
        if (discovery) {
            var player = discovery.getPlayerByUUID(identifier);
            if (!player)
                return;
            cb(player.getState().volume);
        }
    }
    self.mute = function (identifier, address) {
        if (discovery) {
            var player = discovery.getPlayerByUUID(identifier);
            if (!player)
                return;
            player.mute(true);
        }
    }
    self.set_mute = function (identifier, address, value) {
        if (value.toLowerCase() === 'true')
            self.mute(identifier, address);
        else
            self.unmute(identifier, address);
    }
    self.set_volume = function (identifier, address, value) {
        if (discovery) {
            var player = discovery.getPlayerByUUID(identifier);
            if (!player)
                return;
            player.setVolume(value);
        }
    }
    self.stepDown_volume = function (identifier, address) {
        self.get_volume(identifier, address, function (value) {
            self.set_volume(identifier, address, Math.max(value - STEP_SIZE, 0));
        });
    }
    self.stepUp_volume = function (identifier, address) {
        self.get_volume(identifier, address, function (value) {
            self.set_volume(identifier, address, Math.min(value + STEP_SIZE, 100));
        });
    }
    self.unmute = function (identifier, address) {
        if (discovery) {
            var player = discovery.getPlayerByUUID(identifier);
            if (!player)
                return;
            player.mute(false);
        }
    }

    // Indicator implementation
    self.blink = function (identfier, address) {
        if (discovery) {
            var player = discovery.getPlayerByUUID(identfier);
            if (!player)
                return;
            var toggleVal = true;
            var getLEDState = function () {
                return function () {
                    var deferred = Q.defer();

                    player.getLED(function (success, res) {
                        toggleVal = res === 'On' ? true : false;
                        deferred.resolve(toggleVal);
                    });

                    return deferred.promise;
                }
            }
            var toggle = function (enable) {
                return function () {
                    var deferred = Q.defer();
                    player.toggleLED(!toggleVal, function (success, res) {
                        deferred.resolve();
                        toggleVal = !toggleVal;
                    });
                    return deferred.promise;
                };
            }

            Q.fcall(getLEDState())
                .then(toggle())
                .then(function () { return Q().delay(1000); })
                .then(toggle())
                .then(function () { return Q().delay(1000); })
                .then(toggle())
                .then(function () { return Q().delay(1000); })
                .then(toggle());
        }
    }

    // Media Control implementation
    self.get_playingState = function (identifier, address, cb) {
        if (discovery) {
            var player = discovery.getPlayerByUUID(identifier);
            if (!player)
                return;
            var state = player.getState().playerState == 'PLAYING' ? 'play' : 'pause';
            cb(state);
        }
    }
    self.next = function (identifier, address) {
        if (discovery) {
            var player = getCoordinator(identifier);
            if (!player)
                return;
            player.nextTrack();
        }
    }
    self.pause = function (identifier, address) {
        if (discovery) {
            var player = getCoordinator(identifier);
            if (!player)
                return;
            player.pause();
        }
    }
    self.play = function (identifier, address) {
        if (discovery) {
            var player = getCoordinator(identifier);
            if (!player)
                return;
            player.play();
        }
    }
    self.previous = function (identifier, address) {
        if (discovery) {
            var player = getCoordinator(identifier);
            if (!player)
                return;
            player.previousTrack();
        }
    }
    self.set_playingState = function (identifier, address, value) {
        if (value == 'play')
            self.play(identifier, address);
        else
            self.pause(identifier, address);
    }

    // Media Info implementation
    self.get_albumArt = function (identifier, address, cb) {
        if (discovery) {
            var player = discovery.getPlayerByUUID(identifier);
            if (!player)
                return;
            cb(player.getState().currentTrack.albumArtURI);
        }
    }
    self.get_albumTitle = function (identifier, address, cb) {
        if (discovery) {
            var player = discovery.getPlayerByUUID(identifier);
            if (!player)
                return;
            cb(player.getState().currentTrack.album);
        }
    }
    self.get_artist = function (identifier, address, cb) {
        if (discovery) {
            var player = discovery.getPlayerByUUID(identifier);
            if (!player)
                return;
            cb(player.getState().currentTrack.artist);
        }
    }
    self.get_nextAlbumTitle = function (identifier, address, cb) {
        if (discovery) {
            var player = discovery.getPlayerByUUID(identifier);
            if (!player)
                return;
            cb(player.getState().nextTrack.album);
        }
    }
    self.get_nextArtist = function (identifier, address, cb) {
        if (discovery) {
            var player = discovery.getPlayerByUUID(identifier);
            if (!player)
                return;
            cb(player.getState().nextTrack.artist);
        }
    }
    self.get_nextTrackName = function (identifier, address, cb) {
        if (discovery) {
            var player = discovery.getPlayerByUUID(identifier);
            if (!player)
                return;
            cb(player.getState().nextTrack.title);
        }
    }
    self.get_trackName = function (identifier, address, cb) {
        if (discovery) {
            var player = discovery.getPlayerByUUID(identifier);
            if (!player)
                return;
            cb(player.getState().currentTrack.title);
        }
    }

    function getCoordinator(uuid) {
        var player = discovery.getPlayerByUUID(uuid);
        if (!player)
            return;

        // Player is its own coordinator
        if (player.coordinator.uuid == player.uuid)
            return player;

        return discovery.getPlayerByUUID(player.coordinator.uuid);
    }
    function getOutputState(data) {
        return {
            albumArt: data.state.currentTrack.albumArtURI,
            albumTitle: data.state.currentTrack.album,
            artist: data.state.currentTrack.artist,
            mute: data.state.mute,
            nextAlbumTitle: data.state.nextTrack.album,
            nextArtist: data.state.nextTrack.artist,
            nextTrackName: data.state.nextTrack.title,
            on: data.state.playerState == 'PLAYING' ? 'on' : 'off',
            statePlaying: data.state.playerState == 'PLAYING' ? 'play' : 'stop',
            trackName: data.state.currentTrack.title,
            volume: data.state.volume
        }
    }
    function processPendingGets(type, address, value) {
        if (pendingGets[type].length > 0) {
            var idx = pendingGets[type].length;
            while (idx--) {
                if (pendingGets[type][idx].address == address) {
                    pendingGets[type][idx].callback(value);
                    pendingGets[type].splice(idx, 1);
                }
            }
        }
    }
    function processStateChanges(data) {
        var playerIds = [];
        if (playerStates.hasOwnProperty(data.uuid))
            playerIds.push(data.uuid);

        if (coordinatorLookup.hasOwnProperty(data.uuid))
            Array.prototype.push.apply(playerIds, Object.keys(coordinatorLookup[data.uuid]).filter(function (value) { return playerStates.hasOwnProperty(value); }));

        if (playerIds.length == 0)
            return;

        var state = getOutputState(data);
        if (!playerStates[data.uuid])
            playerStates[data.uuid] = {};

        // AudioOutput.mute
        if (!('mute' in playerStates[data.uuid]) || playerStates[data.uuid].mute !== state.mute) {
            playerStates[data.uuid].mute = state.mute;
            self.servicePropertyChanged(data.uuid, "AudioOutput", "mute", state.mute);
        }
        // AudioOutput.volume
        if (!playerStates[data.uuid].volume || playerStates[data.uuid].volume !== state.volume) {
            playerStates[data.uuid].volume = state.volume;
            self.servicePropertyChanged(data.uuid, "AudioOutput", "volume", state.volume);
        }

        for (var id in playerIds) {
            var playerId = playerIds[id];

            if (!playerStates[playerId])
                playerStates[playerId] = {};

            // BinarySwitch.switch
            if (!playerStates[playerId].on || playerStates[playerId].on !== state.on) {
                playerStates[playerId].on = state.on;
                self.servicePropertyChanged(playerId, "BinarySwitch", "switch", state.on);
            }
            // MediaControl.state
            if (!playerStates[playerId].statePlaying || playerStates[playerId].statePlaying !== state.statePlaying) {
                playerStates[playerId].statePlaying = state.statePlaying;
                self.servicePropertyChanged(playerId, "MediaControl", "state", state.statePlaying);
            }
            // MediaInfo.albumArt
            if (!playerStates[playerId].albumArt || playerStates[playerId].albumArt !== state.albumArt) {
                playerStates[playerId].albumArt = state.albumArt;
                self.servicePropertyChanged(playerId, "MediaInfo", "albumArt", state.albumArt);
            }
            // MediaInfo.albumTitle
            if (!playerStates[playerId].albumTitle || playerStates[playerId].albumTitle !== state.albumTitle) {
                playerStates[playerId].albumTitle = state.albumTitle;
                self.servicePropertyChanged(playerId, "MediaInfo", "albumTitle", state.albumTitle);
            }
            // MediaInfo.artist
            if (!playerStates[playerId].artist || playerStates[playerId].artist !== state.artist) {
                playerStates[playerId].artist = state.artist;
                self.servicePropertyChanged(playerId, "MediaInfo", "artist", state.artist);
            }
            // MediaInfo.nextAlbumTitle
            if (!playerStates[playerId].nextAlbumTitle || playerStates[playerId].nextAlbumTitle !== state.nextAlbumTitle) {
                playerStates[playerId].nextAlbumTitle = state.nextAlbumTitle;
                self.servicePropertyChanged(playerId, "MediaInfo", "nextAlbumTitle", state.nextAlbumTitle);
            }
            // MediaInfo.nextArtist
            if (!playerStates[playerId].nextArtist || playerStates[playerId].nextArtist !== state.nextArtist) {
                playerStates[playerId].nextArtist = state.nextArtist;
                self.servicePropertyChanged(playerId, "MediaInfo", "nextArtist", state.nextArtist);
            }
            // MediaInfo.nextTrackName
            if (!playerStates[playerId].nextTrackName || playerStates[playerId].nextTrackName !== state.nextTrackName) {
                playerStates[playerId].nextTrackName = state.nextTrackName;
                self.servicePropertyChanged(playerId, "MediaInfo", "nextTrackName", state.nextTrackName);
            }
            // MediaInfo.trackName
            if (!playerStates[playerId].trackName || playerStates[playerId].trackName !== state.trackName) {
                playerStates[playerId].trackName = state.trackName;
                self.servicePropertyChanged(playerId, "MediaInfo", "trackName", state.trackName);
            }
        }
    }

    self.services = {
        AudioOutput: {
            get_mute: self.get_mute,
            get_volume: self.get_volume,
            mute: self.mute,
            set_mute: self.set_mute,
            set_volume: self.set_volume,
            stepDown: self.stepDown_volume,
            stepUp: self.stepUp_volume,
            unmute: self.unmute
        },
        BinarySwitch: {
            get_switch: self.get_switch,
            set_switch: self.set_switch,
            switchOff: self.switchOff,
            switchOn: self.switchOn
        },
        Indicator: {
            blink: self.blink
        },
        MediaControl: {
            get_state: self.get_playingState,
            next: self.next,
            pause: self.pause,
            play: self.play,
            previous: self.previous,
            set_state: self.set_playingState
        },
        MediaInfo: {
            get_albumArt: self.get_albumArt,
            get_albumTitle: self.get_albumTitle,
            get_artist: self.get_artist,
            get_nextAlbumTitle: self.get_nextAlbumTitle,
            get_nextArtist: self.get_nextArtist,
            get_nextTrackName: self.get_nextTrackName,
            get_trackName: self.get_trackName
        }
    }
}

util.inherits(sonosPlugin, droplitPlugin);
module.exports = sonosPlugin;