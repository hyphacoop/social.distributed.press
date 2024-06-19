import generateIdentity from '../keypair.js'

const keyPair = generateIdentity()

console.log(JSON.stringify(keyPair, null, '  '))
