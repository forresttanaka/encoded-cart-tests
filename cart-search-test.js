#!/usr/bin/env node

const program = require('commander');
const fetch = require('node-fetch');
const _ = require('underscore');
const { readKeyfile, keypairToAuth } = require('./cart-search-test-utils');

/**
 * Perform a search query and retrieve the resulting @ids.
 * @param {string} host URL of host domain from keypairs.json
 * @param {string} query query string for search to perform without leading '?'
 * @param {string} auth Authentication string
 *
 * @return {array} @ids of search results.
 */
const getSearchIds = async (host, query, auth) => (
    fetch(`${host}/search/?${query}&limit=all`, {
        method: 'GET',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: auth,
        },
    }).then((response) => {
        // Convert response to JSON
        if (response.ok) {
            return response.json();
        }
        throw new Error(`not ok ${JSON.stringify(response)}`);
    }).then((results) => (
        results['@graph'].map((result) => result['@id'])
    )).catch((e) => {
        console.log('OBJECT LOAD ERROR: %s', e);
    })
);

/**
 * Get a writeable version of the cart object specified by `cartAtId` from the DB. You can mutate
 * the resulting cart object.
 * @param {string} cartAtId @id of the cart object to retrieve
 * @param {func} fetch System-wide fetch operation
 * @return {object} Promise with the retrieved cart object
 */
const getWriteableCartObject = async (host, cartAtId, auth) => (
    fetch(`${host}${cartAtId}?frame=edit`, {
        method: 'GET',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: auth,
        },
    }).then((response) => {
        if (response.ok) {
            return response.json();
        }
        throw new Error(response);
    }).catch((err) => {
        console.error('Retrieving writeable cart object', err);
    })
);

/**
 * Create a new cart on the specified host.
 * @param {string} host URL of host to perform search on
 * @param {string} auth base64-encoded key and secret for POST permission
 * @param {number} suffix New carts will start with this suffix "Test Cart {suffix}"
 * @param {bool} debug True to output debug messages to console
 *
 * @return {Promise} Search result object
 */
const writeCart = async (host, cart, auth) => (
    fetch(`${host}/carts/${cart.identifier}`, {
        method: 'PUT',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: auth,
        },
        body: JSON.stringify(cart),
    }).then((response) => {
        // Convert response to JSON
        if (response.ok) {
            return response.json();
        }
        throw new Error(`not ok ${JSON.stringify(response)}`);
    }).then((results) => (
        results['@graph'][0].elements
    )).catch((e) => {
        console.log('OBJECT LOAD ERROR: %s', e);
    })
);

/**
 * Create multiple new empty carts.
 * @param {number} count Number of new carts to create
 * @param {number} start Starting suffix number for cart name "Test Cart {number}"
 * @param {string} host URL of host on which to create carts
 * @param {string} auth base64-encoded key and secret for POST permission
 * @param {object} progressBar Instance of progress-bar object
 * @param {bool} debug True to output debug messages to console
 *
 * @return {Promise} Promise for cart creation
 */
const searchCart = async (host, cartId, auth) => (
    fetch(`${host}/cart-search/?cart=${cartId}&limit=all`, {
        method: 'GET',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: auth,
        },
    }).then((response) => {
        if (response.ok) {
            return response.json();
        }
        throw new Error(response);
    }).then((results) => (
        results['@graph'].map((result) => result['@id'])
    )).catch((err) => {
        console.error('SEARCH CART ERROR %o', err);
    })
);

const compareCarts = (cart0, cart1) => {
    if (cart0.length === cart1.length) {
        const sortedCart0 = _.sortBy(cart0);
        const sortedCart1 = _.sortBy(cart1);
        return sortedCart0.filter((cart0Item, index) => cart0Item !== sortedCart1[index]);
    }
    return false;
};

program
    .version('1.0.0')
    .option('-k, --key [key]', 'key of keyfile', 'localhost')
    .option('-f, --keyfile [filename]', 'keyfile name/path', 'keypairs.json')
    .option('-c, --cart [string]', '@id of cart')
    .option('-q, --query [string]', 'query string to search', 'type=Experiment&status=released&perturbed=false&assay_title=siRNA+RNA-seq')
    .option('-t, --type [string]', 'Cart search type (search, matrix, report)', 'search')
    .option('-d, --debug', 'Debug flag', false)
    .parse(process.argv);


// Requirements
// 1. Keypairs
// 2. Query string
// 3. Cart search type
//
// Steps
// 1. Request query string
// 2. Collect all @ids for /experiments/, /annotations/, /functional-characterization-experiments/
// 3. Create a cart with these @ids
// 4. Perform selected cart search with the selected cart @id.
// 5. Make sure all returned cart search exists in originl collected @ids.
const main = async () => {
    const keyFileData = await readKeyfile(program.keyfile);
    const { server } = keyFileData[program.key];
    const auth = keypairToAuth(keyFileData[program.key].key, keyFileData[program.key].secret);
    const itemIds = await getSearchIds(server, program.query, auth, program.debug);
    const cart = await getWriteableCartObject(server, program.cart, auth);
    cart.elements = itemIds;
    const updatedCart = await writeCart(server, cart, auth);
    const searchedCart = await searchCart(server, program.cart, auth);
    const differences = compareCarts(updatedCart, searchedCart);
    if (differences === false) {
        console.log('Different contents Cart size: %s -- Search size %s', updatedCart.length, searchedCart.length);
    } else {
        console.log('Differences: %o', differences);
    }
};

main();
