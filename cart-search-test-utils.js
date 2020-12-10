const fs = require('fs');

/**
 * Convert a user key and secret assigned to them on an encoded site to an authorization string for
 * XHR requests.
 * @param {string} key Authorization key from encoded
 * @param {string} secret Authorization secret from encoded
 *
 * @return {string} Authorization string; use in XHR request headers.
 */
export const keypairToAuth = (key, secret) => (
    `Basic ${Buffer.from(unescape(encodeURIComponent(`${key}:${secret}`))).toString('base64')}`
);

/**
 * Read a file and return its data in a Promise.
 * @param {string} path to a file
 * @param {string} opts Any encoding option
 *
 * @return {string} Contents of file
 */
const readFile = (path, opts = 'utf8') => (
    new Promise((resolve, reject) => {
        fs.readFile(path, opts, (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    })
);

/**
 * Retrieve the JSON contents of the key file that contains the authentication information as well
 * as the URL of the host we'll be searching.
 * @param {string} keyfile keyfile path name
 *
 * @return {Promise} JSON contents of key file
 */
export const readKeyfile = async (keyfile) => {
    const results = await readFile(keyfile);
    return JSON.parse(results);
};
