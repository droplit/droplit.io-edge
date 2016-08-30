'use strict';

const droplit = require('droplit-plugin');
const SonosDiscovery = require('sonos-discovery');

const StepSize = 5;

class SonosPlugin extends droplit.DroplitPlugin {
    constructor() {
        super();

        this.discovery = new SonosDiscovery();
        const coordinatorLookup = new Map();
        const playerStates = new Map();

        /* eslint-disable camelcase */
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
        /* es-lint-enable camelcase */

        this.discovery.on('group-mute', data => {
            const playerState = playerStates.get(data.uuid) || {};
            if (!playerState.hasOwnProperty('mute') || playerState.mute !== data.newMute) {
                playerState.mute = data.newMute;
                this.onPropertiesChanged([{ localId: data.uuid, service: 'AudioOutput', member: 'mute', value: data.newMute }]);
            }
        });

        this.discovery.on('mute-change', data => {
            const playerState = playerStates.get(data.uuid) || {};
            if (!playerState.hasOwnProperty('mute') || playerState.mute !== data.newMute) {
                playerState.mute = data.newMute;
                this.onPropertiesChanged([{ localId: data.uuid, service: 'AudioOutput', member: 'mute', value: data.newMute }]);
            }
        });

        this.discovery.on('volume-change', data => {
            const playerState = playerStates.get(data.uuid) || {};
            if (!playerState.hasOwnProperty('volume') || playerState.volume !== data.newVolume) {
                playerState.volume = data.newVolume;
                this.onPropertiesChanged([{ localId: data.uuid, service: 'AudioOutput', member: 'volume', value: data.newVolume }]);
            }
        });

        this.discovery.on('transport-state', player => {
            processStateChanges.bind(this)(player.toJSON());
        });

        this.discovery.on('topology-change', () => {
            const groupChange = [];
            for (const idx in this.discovery.players) {
                const player = this.discovery.players[idx];

                // Update player grouping lookup
                if (player.coordinator.uuid !== player.uuid) {
                    const coordinator = coordinatorLookup.get(player.coordinator.uuid) || {};
                    if (!coordinator.hasOwnProperty(player.uuid)) {
                        groupChange.push(player.uuid);
                        coordinator[player.uuid] = true;
                        coordinatorLookup.set(player.coordinator.uuid, coordinator);
                    }
                } else
                    coordinatorLookup.forEach((coordinator, key) => {
                        if (coordinator.hasOwnProperty(player.uuid)) {
                            // Only queue as change for existing players
                            if (playerStates.has(player.uuid))
                                groupChange.push(player.uuid);
                            delete coordinator[player.uuid];
                            coordinatorLookup.set(key, coordinator);
                        }
                        if (Object.keys(coordinator).length === 0)
                            coordinatorLookup.delete(key);
                    });

                const state = playerStates.get(player.uuid);
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
                        blink: 'Indicator.blink',
                        switch: 'BinarySwitch.switch',
                        play: 'MediaControl.play',
                        pause: 'MediaControl.pause',
                        next: 'MediaControl.next',
                        previous: 'MediaControl.previous',
                        mute: 'AudioOutput.mute',
                        unmute: 'AudioOutput.unmute',
                        volume: 'AudioOutput.volume'
                    }
                });

                const data = player.toJSON();
                processStateChanges.bind(this)(data);
            }
            groupChange.forEach(uuid => {
                const player = this.discovery.getPlayerByUUID(uuid);
                const data = player.toJSON();
                processStateChanges.bind(this)(data);
            });
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
            const changes = [];
            const state = getOutputState(data);

            const playerIds = [];
            if (playerStates.has(data.uuid))
                playerIds.push(data.uuid);

            // If this is the coordinator, other players in the group should have same properties
            if (coordinatorLookup.has(data.uuid))
                Array.prototype.push.apply(playerIds, Object.keys(coordinatorLookup.get(data.uuid)).filter(value => playerStates.has(value)));

            if (playerIds.length === 0)
                return;

            const isChanged = (propName, pState, cState) => !pState.hasOwnProperty(propName) || pState[propName] !== cState[propName];

            // Properties independant of group
            (() => {
                const playerState = playerStates.get(data.uuid) || {};

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

                playerStates.set(data.uuid, playerState);
            })();

            // Grouped properties
            playerIds.forEach(playerId => {
                const playerState = playerStates.get(playerId) || {};

                // BinarySwitch.switch
                if (isChanged('on', playerState, state)) {
                    playerState.on = state.on;
                    changes.push({ localId: playerId, service: 'BinarySwitch', member: 'switch', value: state.on });
                }

                // MediaControl.state
                if (isChanged('statePlaying', playerState, state)) {
                    playerState.statePlaying = state.statePlaying;
                    changes.push({ localId: playerId, service: 'MediaControl', member: 'state', value: state.statePlaying });
                }

                // MediaInfo.albumArt
                if (isChanged('albumArt', playerState, state)) {
                    playerState.albumArt = state.albumArt;
                    changes.push({ localId: playerId, service: 'MediaInfo', member: 'albumArt', value: state.albumArt });
                }

                // MediaInfo.albumTitle
                if (isChanged('albumTitle', playerState, state)) {
                    playerState.albumTitle = state.albumTitle;
                    changes.push({ localId: playerId, service: 'MediaInfo', member: 'albumTitle', value: state.albumTitle });
                }

                // MediaInfo.artist
                if (isChanged('artist', playerState, state)) {
                    playerState.artist = state.artist;
                    changes.push({ localId: playerId, service: 'MediaInfo', member: 'artist', value: state.artist });
                }

                // MediaInfo.nextAlbum
                if (isChanged('nextAlbumTitle', playerState, state)) {
                    playerState.nextAlbumTitle = state.nextAlbumTitle;
                    changes.push({ localId: playerId, service: 'MediaInfo', member: 'nextAlbum', value: state.nextAlbumTitle });
                }

                // MediaInfo.nextArtist
                if (isChanged('nextAlbumTitle', playerState, state)) {
                    playerState.nextArtist = state.nextArtist;
                    changes.push({ localId: playerId, service: 'MediaInfo', member: 'nextArtist', value: state.nextArtist });
                }

                // MediaInfo.nextTrackName
                if (isChanged('nextTrackName', playerState, state)) {
                    playerState.nextTrackName = state.nextTrackName;
                    changes.push({ localId: playerId, service: 'MediaInfo', member: 'nextTrackName', value: state.nextTrackName });
                }

                // MediaInfo.trackName
                if (isChanged('trackName', playerState, state)) {
                    playerState.trackName = state.trackName;
                    changes.push({ localId: playerId, service: 'MediaInfo', member: 'trackName', value: state.trackName });
                }

                playerStates.set(playerId, playerState);
            });

            if (changes.length > 0)
                this.onPropertiesChanged(changes);
        }
    }

    discover() { }
    dropDevice() { }

    getCoordinator(uuid) {
        const player = this.discovery.getPlayerByUUID(uuid);
        if (!player)
            return;

        // Player is its own coordinator
        if (player.coordinator.uuid === player.uuid)
            return player;

        return this.discovery.getPlayerByUUID(player.coordinator.uuid);
    }

    // AudioOutput implementation
    getMute(localId, callback) {
        const player = this.discovery.getPlayerByUUID(localId);
        if (!player)
            return;
        callback(player.toJSON().state.mute);
    }

    getVolume(localId, callback) {
        const player = this.discovery.getPlayerByUUID(localId);
        if (!player)
            return;
        callback(player.toJSON().state.volume);
    }

    mute(localId) {
        const player = this.discovery.getPlayerByUUID(localId);
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
        const player = this.discovery.getPlayerByUUID(localId);
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
        const player = this.discovery.getPlayerByUUID(localId);
        if (!player)
            return;
        player.unMute();
    }

    // BinarySwitch implementation
    getSwitch(localId, callback) {
        const player = this.discovery.getPlayerByUUID(localId);
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
        const player = this.discovery.getPlayerByUUID(localId);
        if (!player)
            return;
        player.pause();
    }

    switchOn(localId) {
        const player = this.discovery.getPlayerByUUID(localId);
        if (!player)
            return;
        player.play();
    }

    // Indicator implementation
    blink(localId) {
        const player = this.discovery.getPlayerByUUID(localId);
        if (!player)
            return;

        let state;
        const delay = duration => () => new Promise(resolve =>
            setTimeout(() => resolve(), duration));
        const getState = () => () => new Promise(resolve =>
            player.getLEDState().then(value => {
                state = value.currentledstate === 'On';
                resolve();
            }));
        const toggle = () => () => new Promise(resolve =>
            player.setLEDState(!state).then(() => {
                state = !state;
                resolve();
            }));

        const promises = [ getState(), toggle(), delay(1000), toggle(), delay(1000), toggle(), delay(1000), toggle() ];
        promises.reduce((p, c) =>
            p.then(() => new Promise((resolve, reject) =>
                c().then(resolve).catch(reject)
            )), Promise.resolve());
    }

    // MediaControl implementation
    getState(localId, callback) {
        const player = this.discovery.getPlayerByUUID(localId);
        if (!player)
            return;
        callback(player.state.playbackState === 'PLAYING' ? 'play' : 'stop');
    }

    next(localId) {
        const player = this.getCoordinator(localId);
        if (!player)
            return;
        player.nextTrack();
    }

    pause(localId) {
        const player = this.getCoordinator(localId);
        if (!player)
            return;
        player.pause();
    }

    play(localId) {
        const player = this.getCoordinator(localId);
        if (!player)
            return;
        player.play();
    }

    previous(localId) {
        const player = this.getCoordinator(localId);
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
        const player = this.discovery.getPlayerByUUID(localId);
        if (!player)
            return;
        callback(player.state.currentTrack.albumArtUri);
    }

    getAlbumTitle(localId, callback) {
        const player = this.discovery.getPlayerByUUID(localId);
        if (!player)
            return;
        callback(player.state.currentTrack.albumTitle);
    }

    getArtist(localId, callback) {
        const player = this.discovery.getPlayerByUUID(localId);
        if (!player)
            return;
        callback(player.state.currentTrack.artist);
    }

    getNextAlbum(localId, callback) {
        const player = this.discovery.getPlayerByUUID(localId);
        if (!player)
            return;
        callback(player.state.nextTrack.album);
    }

    getNextArtist(localId, callback) {
        const player = this.discovery.getPlayerByUUID(localId);
        if (!player)
            return;
        callback(player.state.nextTrack.artist);
    }

    getNextTrackName(localId, callback) {
        const player = this.discovery.getPlayerByUUID(localId);
        if (!player)
            return;
        callback(player.state.nextTrack.title);
    }

    getTrackName(localId, callback) {
        const player = this.discovery.getPlayerByUUID(localId);
        if (!player)
            return;
        callback(player.state.currentTrack.title);
    }
}

module.exports = SonosPlugin;
