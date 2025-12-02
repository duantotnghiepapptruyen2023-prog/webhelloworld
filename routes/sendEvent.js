const router = require('express').Router()

let clients = []
const allowedOrigins = [
  'http://localhost:3000',
]

router.get('/events', (req, res) => {
  console.log('Client connected to events API')
  const origin = req.headers.origin
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Credentials', 'true')
  } else {
    return res.status(403).json({ message: 'Origin không được phép' })
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  res.write('data: {"event": "connection_established"}\n\n')

  try {
    clients.push(res)
    const heartbeatInterval = setInterval(() => {
      res.write('data: {"event": "heartbeat"}\n\n')
    }, 30000)

    req.on('close', () => {
      clearInterval(heartbeatInterval)
      clients = clients.filter(client => client !== res)
      console.log('Client disconnected')
    })
  } catch (error) {
    console.error('Error in events API:', error)
    res.status(500).send('Internal Server Error')
  }
})

const sendEvent = data => {
  clients.forEach(client => {
    client.write(`data: ${JSON.stringify(data)}\n\n`)
  })
}

module.exports = { router, sendEvent }
