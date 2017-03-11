const repl = require('repl')
const events = require('events')
const fs = require('fs')
const path = require('path')

const WebSocket = require('ws')

const ee = new events.EventEmitter()
const wss = new WebSocket.Server({ port: 81 })

const bridgedFns = fs.readFileSync(path.resolve(__dirname, 'bridged.txt')).toString().split('\n').splice(1)

console.log('Waiting for connection..')

let connection

function sendMsg (cmd, args = []) {
  connection.send(JSON.stringify({
    cmd,
    args
  }))
}

function handle (input, context, filename, callback) {
  let tmp = input.replace(/\n$/, '')

  if (!tmp) {
    return callback()
  }

  let args = tmp.split(' ')
  let cmd = args.shift()

  if (cmd === 'sp') {
    ee.once('sp', function (sp) {
      return callback(null, sp)
    })
    sendMsg('getSP')
  } else if (cmd === 'bridge') {
    ee.once('bridged', function () {
      return callback(null, 'created')
    })
    sendMsg('bridge', args)
  } else if (cmd === 'bridges' || cmd === 'bridged') {
    ee.once('bridges', function (bridges) {
      return callback(null, bridges)
    })
    sendMsg('bridges')
  } else if(cmd === 'call') {
    ee.once('call', function (addr) {
      return callback(null, addr)
    })
    sendMsg('call', args)
  } else if (cmd === 'gc') {
    ee.once('gcran', callback)
    sendMsg('gc')
  } else {
    return callback(null, 'unknown cmd')
  }
}

const r = repl.start({
  prompt: '',
  eval: handle
})

r.pause()
r.setPrompt('switch> ')

wss.on('connection', function (ws) {
  connection = ws
  console.log('Got connection')

  bridgedFns.forEach(function (fn) {
    if (!fn) return
    const args = fn.split(' ')
    ws.send(JSON.stringify({
      cmd: 'bridge',
      args: args
    }))
    console.log('Bridged', args[0])
  })

  r.resume()
  r.write('\n')

  ws.on('close', function () {
    console.log('\nSwitch disconnected...')
    r.pause()
  })

  ws.on('message', function (data) {
    data = JSON.parse(data)
    const type = data.type
    const response = data.response
    ee.emit(type, response)
  })
})
