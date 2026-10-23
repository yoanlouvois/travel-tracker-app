// src/server.js
// - lancé directement (npm start)  : écoute sur PORT (8080 par défaut)
// - chargé par Electron             : startServer({ port: 0, host: '127.0.0.1' })

const app = require('./app')

const DEFAULT_PORT = Number(process.env.PORT) || 8080

// Démarre le serveur. port 0 = port libre choisi par le système.
// Renvoie { server, port }
function startServer({ port = DEFAULT_PORT, host } = {}) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, host)
    server.once('listening', () => resolve({ server, port: server.address().port }))
    server.once('error', reject)
  })
}

// lancé avec "node src/server.js"
if (require.main === module) {
  startServer()
    .then(({ port }) => console.log(`Server running at http://localhost:${port}`))
    .catch((err) => {
      console.error(err.code === 'EADDRINUSE' ? `Le port ${DEFAULT_PORT} est déjà utilisé.` : err)
      process.exit(1)
    })
}

module.exports = { startServer }
