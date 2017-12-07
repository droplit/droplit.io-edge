'use strict';

const http = require('http');
const https = require('https');
const querystring = require('querystring');
const url = require('url');

function filterForNonReserved(reserved, options) {
    return Object.keys(options)
        .filter(o => !reserved.find(r => r === o))
        .reduce((p, c) => {
            p[c] = options[c];
            return p;
        }, {});
}

function filterOutReservedFunctions(reserved, options) {
    return Object.keys(options)
        .filter(o =>
            !reserved.find(r => r === o) ||
            (typeof options[o] !== 'function')
        )
        .reduce((p, c) => {
            p[c] = options[c];
            return p;
        }, {});
}

function rfc3986(str) {
    return str.replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function Request(options) {
    const reserved = Object.keys(Request.prototype);
    const nonReserved = filterForNonReserved(reserved, options);

    Object.assign(this, nonReserved);

    options = filterOutReservedFunctions(reserved, options);

    this.init(options);
}

Request.prototype.abort = function () {
    this._aborted = true;

    if (this.req)
        this.req.abort();
    else if (this.response)
        this.response.destroy();
};

Request.prototype.init = function (options) {
    if (!options)
        options = {};

    // Standardizes to same case
    const normalizePropNames = (p, c) => {
        p[c.toLowerCase()] = this.headers[c];
        return p;
    };

    // If all custom headers are lowercase, we can assume lowercase for internal operations
    this.headers = this.headers ?
        Object.keys(this.headers).reduce(normalizePropNames, {}) :
        {};

    // Default the method
    if (!this.method)
        this.method = options.method || 'GET';

    // 'url' is often used in the wild, so swap with proper 'uri'
    if (!this.uri && this.url) {
        this.uri = options.url;
        delete this.url;
    }

    if (typeof this.uri === 'string')
        this.uri = url.parse(this.uri);

    this.host = this.uri.hostname;
    this.httpModule = this.uri.protocol === 'https:' ? https : http;
    this.path = this.uri.path;
    this.port = this.uri.port;
    this.protocol = this.uri.protocol;

    this.start();
};

Request.prototype.onRequestError = function () {
    if (this.timeout && this.timeoutTimer) {
        clearTimeout(this.timeoutTimer);
        this.timeoutTimer = null;
    }
};

Request.prototype.onRequestResponse = function (response) {
    let bufferLength = 0;
    let buffers = [];
    let strings = [];

    response.on('data', chunk => {
        if (!Buffer.isBuffer(chunk))
            strings.push(chunk);
        else if (chunk.length) {
            bufferLength += chunk.length;
            buffers.push(chunk);
        }
    });

    response.once('end', () => {
        if (bufferLength) {
            response.body = Buffer.concat(buffers, bufferLength).toString();
            buffers = [];
            bufferLength = 0;
        } else if (strings.length) {
            response.body = strings.join('');
            strings = [];
        }

        if (this.timeout && this.timeoutTimer) {
            clearTimeout(this.timeoutTimer);
            this.timeoutTimer = null;
        }

        if (this.json) {
            try {
                response.body = JSON.parse(response.body);
            } catch (ex) { } // eslint-disable-line no-empty
        }

        if (this.callback)
            this.callback(null, response, response.body);
    });

    response.on('error', err => {
        if (this.callback)
            this.callback(err);
    });
};

Request.prototype.start = function () {
    if (this.form) {
        this.headers['content-type'] = 'application/x-www-form-urlencoded';
        this.body = (typeof this.form === 'string') ?
            rfc3986(this.form.toString('utf8')) :
            querystring(this.form).toString('utf8');
    }

    if (this.json && typeof this.json === 'object') {
        this.body = JSON.stringify(this.json);

        this.headers.accept = 'application/json';
        this.headers['content-length'] = Buffer.byteLength(this.body);
        this.headers['content-type'] = 'application/json';
    }

    if (this.body) {
        if (!this.headers['content-length']) {
            let length;
            if (typeof this.body === 'string')
                length = Buffer.byteLength(this.body);
            else if (Array.isArray(this.body))
                length = this.body.reduce((a, b) => a + b.length, 0);
            else
                length = this.body.length;

            if (length)
                this.headers['content-length'] = length;
        }
    }

    const reqOptions = Object.assign({}, this);

    // While node v6.8.0 supports `timeout` in `http.request()` we want to handle manually to support older node versions
    delete reqOptions.timeout;

    let timeout;
    if (this.timeout && !this.timeoutTimer) {
        if (this.timeout < 0)
            timeout = 0;
        else if (typeof this.timeout === 'number' && isFinite(this.timeout))
            timeout = this.timeout;
    }

    this.req = this.httpModule.request(reqOptions);

    this.req.on('error', this.onRequestError.bind(this));
    this.req.on('response', this.onRequestResponse.bind(this));
    this.req.on('socket', socket => {
        const isConnecting = socket._connecting || socket._connecting;

        const setReqTimeout = () => {
            // Set the amount of time to wait *between* bytes sent
            this.req.setTimeout(timeout, () => {
                if (this.req)
                    this.abort();
            });
        };

        if (timeout !== undefined) {
            if (isConnecting) {
                const onReqSockConnect = () => {
                    socket.removeListener('connect', onReqSockConnect);
                    clearTimeout(this.timeoutTimer);
                    this.timeoutTimer = null;
                    setReqTimeout();
                };

                socket.on('connect', onReqSockConnect);
                this.req.on('error', () =>
                    socket.removeListener('connect', onReqSockConnect));

                this.timeoutTimer = setTimeout(() => {
                    socket.removeListener('connect', onReqSockConnect);
                    this.abort();
                }, timeout);
            } else
                setReqTimeout();
        }
    });

    if (this.body) {
        if (Array.isArray(this.body))
            this.body.forEach(part => this.req.write(part));
        else
            this.req.write(this.body);
    }

    this.req.end();
};

module.exports = Request;