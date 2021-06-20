'use strict'

const cbor = require('@exodus/borc')
const CID = require('cids')
const isCircular = require('is-circular')

// https://github.com/ipfs/go-ipfs/issues/3570#issuecomment-273931692
const CID_CBOR_TAG = 42

/**
 * @param {CID | string} cid
 */
function tagCID (cid) {
  let buf

  if (typeof cid === 'string') {
    buf = new CID(cid).bytes
  } else if (CID.isCID(cid)) {
    buf = cid.bytes
  } else {
    throw new Error('Could not tag CID - was not string or CID')
  }

  const nodebuf = Buffer.concat([
    Buffer.from('00', 'hex'),
    buf
  ])
  const uint8buf = new Uint8Array(nodebuf.buffer, nodebuf.offset, nodebuf.length)
  return new cbor.Tagged(CID_CBOR_TAG, uint8buf)
}

/**
 * @param {any} dagNode
 */
function replaceCIDbyTAG (dagNode) {
  let circular
  try {
    circular = isCircular(dagNode)
  } catch (e) {
    circular = false
  }
  if (circular) {
    throw new Error('The object passed has circular references')
  }

  /**
   * @param {any} obj
   * @returns {any}
   */
  function transform (obj) {
    if (!obj || obj instanceof Uint8Array || typeof obj === 'string') {
      return obj
    }

    if (Array.isArray(obj)) {
      return obj.map(transform)
    }

    if (CID.isCID(obj)) {
      return tagCID(obj)
    }

    const keys = Object.keys(obj)

    if (keys.length > 0) {
      // Recursive transform
      /** @type {Record<string, any>} */
      const out = {}
      keys.forEach((key) => {
        if (typeof obj[key] === 'object') {
          out[key] = transform(obj[key])
        } else {
          out[key] = obj[key]
        }
      })
      return out
    } else {
      return obj
    }
  }

  return transform(dagNode)
}

/**
 * Serialize internal representation into a binary CBOR block.
 *
 * @param {Object} node - Internal representation of a CBOR block
 * @returns {Uint8Array} - The encoded binary representation
 */
function serialize (node) {
  const nodeTagged = replaceCIDbyTAG(node)
  const serialized = cbor.encode(nodeTagged)

  return serialized
}

module.exports = {
  serialize,
}
