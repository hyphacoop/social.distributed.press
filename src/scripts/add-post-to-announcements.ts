import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import envPaths from 'env-paths'
import { Level } from 'level'

import Store from '../server/store/index.js'
import { nanoid } from 'nanoid'

const paths = envPaths('social.distributed.press')

const argv = yargs(hideBin(process.argv)).positional('content', {}).options({
  storage: { type: 'string' }
}).parseSync()

const storage = argv.storage ?? paths.data
const content = argv.$0

const db = new Level(storage, { valueEncoding: 'json' })

const store = new Store(db)

console.log(`Posting: ${content}`)
const actor=await store.announcements.getInfo()

await store.announcements.outbox.add({
    '@context': 'https://www.w3.org/ns/activitystreams',
    type: 'Note',
    id: `${actor.actorUrl}/outbox/${nanoid()}`,
    actor: actor.actorUrl,
      attributedTo: actor.actorUrl,
      published: new Date().toUTCString(),
  "to": ["https://www.w3.org/ns/activitystreams#Public"],
  "cc": ["https://social.distributed.press/v1/@sutty@sutty.nl/followers"],
    object: {

    }
})
await store.admins.add(list)

const final = await store.admins.list()

console.log('Final admin list:')
console.log(final)
