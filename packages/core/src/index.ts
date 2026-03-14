import 'dotenv/config'
import { migrate } from './db/index'
import { startGateway } from './gateway/server'

async function main() {
  console.log('🦫 Starting Capyra...')

  await migrate()

  const port = parseInt(process.env.GATEWAY_PORT ?? '18789')
  startGateway(port)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
