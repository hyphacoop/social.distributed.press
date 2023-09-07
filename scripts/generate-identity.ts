import generateIdentity from '../src/keypair'

const keyPair = generateIdentity()

console.log(JSON.stringify(keyPair, null, '  '))
