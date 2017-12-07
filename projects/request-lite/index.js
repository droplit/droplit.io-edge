'use strict';

/*
    Super light-weight request client built from modification of the request module (https://github.com/request/request).

    Made to accommodate low memory devices
*/

function initParams(uri, options, callback) {
    if (typeof options === 'function')
        callback = options;

    const params = {};
    if (typeof options === 'object')
        Object.assign(params, options, { uri });
    else if (typeof uri === 'string')
        Object.assign(params, { uri });
    else
        Object.assign(params, uri);

    params.callback = callback || params.callback;
    return params;
}

function request(uri, options, callback) {
    if (typeof uri === 'undefined')
        throw new Error('undefined is not a valid uri or options object.');

    if (typeof options === 'function')
        callback = options;

    const params = initParams(uri, options, callback);

    return new request.Request(params);
}

function verbFunc(verb) {
    const method = verb.toUpperCase();
    return (uri, options, callback) => {
        const params = initParams(uri, options, callback);
        params.method = method;
        return request(params, params.callback);
    };
}

request.get = verbFunc('get');
request.head = verbFunc('head');
request.options = verbFunc('options');
request.post = verbFunc('post');
request.put = verbFunc('put');
request.patch = verbFunc('patch');
request.del = verbFunc('delete');
request['delete'] = verbFunc('delete'); // eslint-disable-line dot-notation

module.exports = request;

request.Request = require('./request');