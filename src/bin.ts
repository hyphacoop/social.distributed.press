#!/usr/bin/env node
import { buildServer } from './index.js'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import envPaths from 'env-paths'
const paths = envPaths('social.distributed.press')

await yargs(hideBin(process.argv)).command('run', 'start the Social Inbox service', {
  port: { type: 'number' },
  host: { type: 'string' },
  storage: { type: 'string' },
  publicURL: { type: 'string' }
}, async (argv) => {
  const port = Number(argv.port ?? process.env.PORT ?? '8080')
  const host = argv.host ?? process.env.HOST ?? 'localhost'
  const storage = argv.storage ?? paths.data
  const publicURL = argv.publicURL ?? `http://${host}:${port}`

  const server = await buildServer({
    port,
    host,
    storage,
    publicURL,
    useLogging: true,
    useSwagger: true,
    usePrometheus: true,
    useSigIntHandler: true
  })

  server.listen({ port, host }, (err, _address) => {
    if (err != null) {
      server.log.error(err)
      process.exit(1)
    }
  })
})
  .help()
  .demandCommand()
  .recommendCommands()
  .strict()
  .parseAsync()
