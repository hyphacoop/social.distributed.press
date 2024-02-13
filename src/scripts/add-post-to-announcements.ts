import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import envPaths from 'env-paths'
import { Level } from 'level'

import Store from '../server/store/index.js'

const paths = envPaths('social.distributed.press')

const argv = yargs(hideBin(process.argv)).positional('content', {}).options({
  storage: { type: 'string' }
}).parseSync()

const storage = argv.storage ?? paths.data
const content = argv.$0

const db = new Level(storage, { valueEncoding: 'json' })

const store = new Store(db)

console.log(`Posting: ${content}`)
await store.announcements.outbox.add({
id:
})
await store.admins.add(list)

const final = await store.admins.list()

console.log('Final admin list:')
console.log(final)
