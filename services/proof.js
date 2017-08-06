'use strict';

var sha256 = require('sha256');
var util = require('util');

var key = require('./key');
var contract = require('./contract');
var config = require('../config');

// TODO move userId to options object in each API
const userId = "un-authenticated";

async function getProof(opts) {
    console.log(`[services/proof:getProof] opts: ${util.inspect(opts)}`);
    
    if (!opts.trackingId) throw new Error(`missing argument 'trackingId'`);

    var trackingId = opts.trackingId;
    var decrypt = opts.decrypt;
    var proofs = [];

    while (trackingId && trackingId != "root") {

      var result = await contract.getProof(trackingId);
      if (!result) return null;

      // TODO wrap getProof and return null if doesn't exists
      var proof;

      if (!decrypt) {
        proof = result.encryptedProof;
      }
      else {
        var decrypted = await key.decrypt(userId, trackingId, result.encryptedProof);

        // ensure we always return a valid json, even if we get back a string
        var decryptedJson = { rawContent : decrypted};

        try {
          decryptedJson = JSON.parse(decrypted);
        }
        catch(err) {
          console.warn(`invalid decrypted json: ${decrypted}: ${err.message}`);
        };

        proof = decryptedJson;     
      }

      // check if we got a valid proof
      if (result.previousTrackingId) {
        proofs.push({
          trackingId: trackingId,
          owner: result.owner,
          encryptedProof: proof,
          publicProof: result.publicProof ? JSON.parse(result.publicProof) : result.publicProof,
          previousTrackingId: result.previousTrackingId
        });

        trackingId = result.previousTrackingId;
      }
    }
    
    return proofs;
}

async function storeProof(opts) {
  console.log(`[services/proof:storeProof] opts: ${util.inspect(opts)}`);
    
  if (!opts.trackingId) throw new Error(`missing argument 'trackingId'`);
  if (!opts.publicProof) throw new Error(`missing argument 'publicProof'`);

  opts.previousTrackingId = opts.previousTrackingId || "root";

  var proof = await createProof(opts);

  var result = await contract.storeProof({
    trackingId: opts.trackingId, 
    previousTrackinId: opts.previousTrackingId, 
    encryptedProof: opts.encryptedProof, 
    publicProof: opts.publicProof,
    config: { from: config.ACCOUNT_ADDRESS, gas : config.GAS }
  });

  console.log(`returning storeProof result: ${util.inspect(result)}`);
  return result;
}

async function createProof(opts) {
  console.log(`[services/proof:createProof] opts: ${util.inspect(opts)}`);
     
  if (!opts.trackingId) throw new Error(`missing argument 'trackingId'`);
  if (!opts.proofToEncrypt) throw new Error(`missing argument 'proofToEncrypt'`);

  var proofToEncryptStr = JSON.stringify(opts.proofToEncrypt);
  var hash = sha256(proofToEncryptStr);
  opts.publicProof = JSON.stringify({
    encryptedProofHash : hash.toUpperCase(),
    publicProof : opts.publicProof
  });
  opts.encryptedProof = await key.encrypt(userId, opts.trackingId, proofToEncryptStr);
  return opts;
}

async function transfer(opts) {
  // TODO: add input validation as implemented in above functions

  var result = await contract.transfer({
    trackingId: opts.trackingId, 
    transferTo: opts.transferTo, 
    config: { from: config.ACCOUNT_ADDRESS, gas : config.GAS }
  });

  return result;  
}

module.exports = {
  getProof,
  storeProof,
  transfer
}
