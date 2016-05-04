# WebSocket protocol notes

## Introduction

The Droplit edge server uses native websocket connections to the droplit service to perform real-time bidirectional communication.

The connection is maintained by the client, uses a secure connection, and does not fall-back to long-polling (for performance reasons).

## Maintaining the connection state

The transport is maintained with two calls `start(settings)` and `stop()`. The `Transport` module will automatically maintain the connection as best as possible.

transport raises `connected` and `disconnected` events

