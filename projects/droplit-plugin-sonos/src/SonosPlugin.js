'use strict';

const droplit = require('droplit-plugin');
const SonosDiscovery = require('sonos-discovery');

const StepSize = 5;

class SonosPlugin extends droplit.DroplitPlugin {
    constructor() {
        super();

        this.discovery = new SonosDiscovery();
        let playerStates = new Map();

        this.services = {
            AudioOutput: {
                get_mute: this.getMute,
                get_volume: this.getVolume,
                mute: this.mute,
                set_mute: this.setMute,
                set_volume: this.setVolume,
                stepDown: this.stepDown,
                stepUp: this.stepUp,
                unmute: this.unmute
            },
            BinarySwitch: {
                get_switch: this.getSwitch,
                set_switch: this.setSwitch,
                switchOff: this.switchOff,
                switchOn: this.switchOn
            },
            Indicator: {
                blink: this.blink
            },
            MediaControl: {
                get_state: this.getState,
                next: this.next,
                pause: this.pause,
                play: this.play,
                previous: this.previous,
                set_state: this.setState
            },
            MediaInfo: {
                get_albumArt: this.getAlbumArt,
                get_albumTitle: this.getAlbumTitle,
                get_artist: this.getArtist,
                get_nextAlbum: this.getNextAlbum,
                get_nextArtist: this.getNextArtist,
                get_nextTrackName: this.getNextTrackName,
                get_trackName: this.getTrackName
            }
        };

        this.discovery.on('transport-state', player => {
            processStateChanges.bind(this)(player.toJSON());
        });

        this.discovery.on('topology-change', topology => {
            for (let idx in this.discovery.players) {
                let player = this.discovery.players[idx];

                if (player.coordinator.uuid !== player.uuid) {
                    console.log('player not own coordinator');
                }
                
                let state = playerStates.get(player.uuid);
                // Do not emit discovered for pre-existing devices
                if (state)
                    continue;
                
                playerStates.set(player.uuid, {});

                this.onDeviceInfo({
                    localId: player.uuid,
                    address: player.baseUrl,
                    localName: player.roomName,
                    services: [ 'AudioOutput', 'BinarySwitch', 'Indicator', 'MediaControl', 'MediaInfo' ],
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

                let data = player.toJSON();
                processStateChanges.bind(this)(data);
            }
        });

        function getOutputState(data) {
            return {
                albumArt: data.state.currentTrack.albumArtUri,
                albumTitle: data.state.currentTrack.album,
                artist: data.state.currentTrack.artist,
                mute: data.state.mute,
                nextAlbumTitle: data.state.nextTrack.album,
                nextArtist: data.state.nextTrack.artist,
                nextTrackName: data.state.nextTrack.title,
                on: data.state.playbackState === 'PLAYING' ? 'on' : 'off',
                statePlaying: data.state.playbackState === 'PLAYING' ? 'play' : 'stop',
                trackName: data.state.currentTrack.title,
                volume: data.state.volume
            };
        }

        function processStateChanges(data) {
            let state = getOutputState(data);

            let changes = [];
            let playerState = playerStates.get(data.uuid) || {};

            let isChanged = (propName, pState, cState) => !pState.hasOwnProperty(propName) || pState[propName] !== cState[propName];

            // AudioOutput.mute
            if (isChanged('mute', playerState, state)) {
                playerState.mute = state.mute;
                changes.push({ localId: data.uuid, service: 'AudioOutput', member: 'mute', value: state.mute });
            }

            // AudioOutput.volume
            if (isChanged('volume', playerState, state)) {
                playerState.volume = state.volume;
                changes.push({ localId: data.uuid, service: 'AudioOutput', member: 'volume', value: state.volume });
            }

            // BinarySwitch.switch
            if (isChanged('on', playerState, state)) {
                playerState.on = state.on;
                changes.push({ localId: data.uuid, service: 'BinarySwitch', member: 'switch', value: state.on });
            }

            // MediaControl.state
            if (isChanged('statePlaying', playerState, state)) {
                playerState.statePlaying = state.statePlaying;
                changes.push({ localId: data.uuid, service: 'MediaControl', member: 'state', value: state.statePlaying });
            }

            // MediaInfo.albumArt
            if (isChanged('albumArt', playerState, state)) {
                playerState.albumArt = state.albumArt;
                changes.push({ localId: data.uuid, service: 'MediaInfo', member: 'albumArt', value: state.albumArt });
            }

            // MediaInfo.albumTitle
            if (isChanged('albumTitle', playerState, state)) {
                playerState.albumTitle = state.albumTitle;
                changes.push({ localId: data.uuid, service: 'MediaInfo', member: 'albumTitle', value: state.albumTitle });
            }

            // MediaInfo.artist
            if (isChanged('artist', playerState, state)) {
                playerState.albumTitle = state.artist;
                changes.push({ localId: data.uuid, service: 'MediaInfo', member: 'artist', value: state.artist });
            }

            // MediaInfo.nextAlbum
            if (isChanged('nextAlbumTitle', playerState, state)) {
                playerState.nextAlbumTitle = state.nextAlbumTitle;
                changes.push({ localId: data.uuid, service: 'MediaInfo', member: 'nextAlbum', value: state.nextAlbumTitle });
            }

            // MediaInfo.nextArtist
            if (isChanged('nextAlbumTitle', playerState, state)) {
                playerState.nextArtist = state.nextArtist;
                changes.push({ localId: data.uuid, service: 'MediaInfo', member: 'nextArtist', value: state.nextArtist });
            }

            // MediaInfo.nextTrackName
            if (isChanged('nextTrackName', playerState, state)) {
                playerState.nextTrackName = state.nextTrackName;
                changes.push({ localId: data.uuid, service: 'MediaInfo', member: 'nextTrackName', value: state.nextTrackName });
            }

            // MediaInfo.trackName
            if (isChanged('trackName', playerState, state)) {
                playerState.trackName = state.trackName;
                changes.push({ localId: data.uuid, service: 'MediaInfo', member: 'trackName', value: state.trackName });
            }

            playerStates.set(data.uuid, playerState);

            if (changes.length > 0)
                this.onPropertiesChanged(changes);
        }
    }
    
    discover() { }
    dropDevice(localId) { }

    // AudioOutput implementation
    getMute(localId, callback) {
        let player = this.discovery.getPlayerByUUID(localId);
        if (!player)
            return;
        callback(player.toJSON().state.mute);
    }

    getVolume(localId, callback) {
        let player = this.discovery.getPlayerByUUID(localId);
        if (!player)
            return;
        callback(player.toJSON().state.volume);
    }

    mute(localId) {
        let player = this.discovery.getPlayerByUUID(localId);
        if (!player)
            return;
        player.mute();
    }

    setMute(localId, value) {
        if (value.toLowerCase() === 'true')
            this.mute(localId);
        else
            this.unmute(localId);
    }

    setVolume(localId, value) {
        let player = this.discovery.getPlayerByUUID(localId);
        if (!player)
            return;
        player.setVolume(value);
    }

    stepDown(localId) {
        this.getVolume(localId, value => {
            this.setVolume(localId, Math.max(value - StepSize, 0));
        });
    }

    stepUp(localId) {
        this.getVolume(localId, value => {
            this.setVolume(localId, Math.min(value + StepSize, 100));
        });
    }

    unmute(localId) {
        let player = this.discovery.getPlayerByUUID(localId);
        if (!player)
            return;
        player.unMute();
    }

    // BinarySwitch implementation
    getSwitch(localId, callback) {
        let player = this.discovery.getPlayerByUUID(localId);
        if (!player)
            return;

        callback(player.toJSON().state.playbackState === 'PLAYING' ? 'on' : 'off');
    }

    setSwitch(localId, value) {
        if (value === 'off')
            this.switchOff(localId);
        else if (value === 'on')
            this.switchOn(localId);
    }

    switchOff(localId) {
        let player = this.discovery.getPlayerByUUID(localId);
        if (!player)
            return;
        player.pause();
    }

    switchOn(localId) {
        let player = this.discovery.getPlayerByUUID(localId);
        if (!player)
            return;
        player.play();
    }

    // Indicator implementation
    blink(localId) {
        let player = this.discovery.getPlayerByUUID(localId);
        if (!player)
            return;

        let state;
        let delay = (duration) => () => new Promise((resolve, reject) =>
            setTimeout(() => resolve(), duration));
        let getState = () => () => new Promise((resolve, reject) =>
            player.getLEDState().then(value => {
                state = value.currentledstate === 'On' ? true : false;
                resolve(); 
            }));
        let toggle = () => () => new Promise((resolve, reject) =>
            player.setLEDState(!state).then(() => {
                state = !state;
                resolve();
            }));

        let promises = [ getState(), toggle(), delay(1000), toggle(), delay(1000), toggle(), delay(1000), toggle(), ];
        promises.reduce((p, c) =>
            p.then(() => new Promise((resolve, reject) =>
                c().then(resolve).catch(reject)
            )), Promise.resolve());
    }

    // MediaControl implementation
    getState(localId, callback) {
        let player = this.discovery.getPlayerByUUID(localId);
        if (!player)
            return;
        callback(data.state.playbackState === 'PLAYING' ? 'play' : 'stop');
    }

    next(localId) {
        let player = this.discovery.getPlayerByUUID(localId);
        if (!player)
            return;
        player.nextTrack();
    }   

    pause(localId) {
        let player = this.discovery.getPlayerByUUID(localId);
        if (!player)
            return;
        player.pause();
    } 

    play(localId) {
        let player = this.discovery.getPlayerByUUID(localId);
        if (!player)
            return;
        player.play();
    }

    previous(localId) {
        let player = this.discovery.getPlayerByUUID(localId);
        if (!player)
            return;
        player.previousTrack();
    }

    setState(localId, value) {
        if (value === 'play')
            this.play(localId);
        else
            this.pause(localId);
    }

    // MediaInfo implementation
    getAlbumArt(localId, callback) {
        let player = this.discovery.getPlayerByUUID(localId);
        if (!player)
            return;
        callback(player.state.currentTrack.albumArtUri);
    }

    getAlbumTitle(localId, callback) {
        let player = this.discovery.getPlayerByUUID(localId);
        if (!player)
            return;
        callback(player.state.currentTrack.albumTitle);
    }

    getArtist(localId, callback) {
        let player = this.discovery.getPlayerByUUID(localId);
        if (!player)
            return;
        callback(player.state.currentTrack.artist);
    }

    getNextAlbum(localId, callback) {
        let player = this.discovery.getPlayerByUUID(localId);
        if (!player)
            return;
        callback(player.state.nextTrack.album);
    }

    getNextArtist(localId, callback) {
        let player = this.discovery.getPlayerByUUID(localId);
        if (!player)
            return;
        callback(player.state.nextTrack.artist);
    }

    getNextTrackName(localId, callback) {
        let player = this.discovery.getPlayerByUUID(localId);
        if (!player)
            return;
        callback(player.state.nextTrack.title);
    }

    getTrackName(localId, callback) {
        let player = this.discovery.getPlayerByUUID(localId);
        if (!player)
            return;
        callback(player.state.currentTrack.title);
    }
}

module.exports = SonosPlugin;