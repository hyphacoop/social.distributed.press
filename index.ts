import apiBuilder from './api/index.js'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import envPaths from 'env-paths'
const paths = envPaths('social.distributed.press')

const argv = yargs(hideBin(process.argv)).options({
  port: { type: 'number' },
  host: { type: 'string' },
  storage: { type: 'string' }
}).parseSync()

export interface ServerI {
  port: number
  host: string
  storage: string
  publicURL: string
}

const port = Number(argv.port ?? process.env.PORT ?? '8080')
const host = argv.host ?? process.env.HOST ?? 'localhost'
const storage = argv.storage ?? paths.data
const publicURL = `http://${host}:${port}`
const cfg: ServerI = {
  port,
  host,
  storage,
  publicURL
}

const server = await apiBuilder({
  ...cfg,
  useLogging: true,
  useSwagger: true,
  usePrometheus: true,
  useSigIntHandler: true
})
server.listen(cfg, (err, _address) => {
  if (err != null) {
    server.log.error(err)
    process.exit(1)
  }
})
