import cluster from 'cluster'
import os from 'os'
import dotenv from 'dotenv'

dotenv.config()

const totalCPUs = os.cpus().length
const PORT      = process.env.PORT || 5000
const isDev     = process.env.NODE_ENV === 'development'

if (isDev) {
    const app = require('./app').default
    app.listen(PORT, () => {
        console.log(`
    ─────────────────────────────────
    Dev Server PID : ${process.pid}
    Port           : ${PORT}
    Environment    : ${process.env.NODE_ENV}
    ─────────────────────────────────
        `)
    })
} else if (cluster.isMaster) {
    console.log(`
    ─────────────────────────────────
    Master PID  : ${process.pid}
    Total Cores : ${totalCPUs}
    Port        : ${PORT}
    ─────────────────────────────────
    `)

    for (let i = 0; i < totalCPUs; i++) {
        cluster.fork()
    }

    cluster.on('exit', (worker) => {
        console.log(`Worker ${worker.process.pid} died. Restarting...`)
        cluster.fork()
    })

    cluster.on('online', (worker) => {
        console.log(`Worker ${worker.process.pid} is online`)
    })

} else {
    const app = require('./app').default
    app.listen(PORT, () => {
        console.log(`Worker ${process.pid} listening on port ${PORT}`)
    })
}