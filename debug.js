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

ee.on('error', function (message) {
  console.error('ERROR:', message)
})

const fns = {
  sp: {
    response: 'gotsp'
  },
  bridge: {
    response: 'bridged'
  },
  bridges: {
    response: 'bridges'
  },
  call: {
    response: 'call'
  },
  gc: {
    response: 'gcran'
  },
  querymem: {
    response: 'memory'
  },
  malloc: {
    response: 'mallocd'
  }
}

function defaultHandler (fn, callback) {
  return function (response) {
    return callback(null, response)
  }
}

function handle (input, context, filename, callback) {
  let tmp = input.replace(/\n$/, '')

  if (!tmp) {
    return callback()
  }

  let args = tmp.split(' ')
  let cmd = args.shift()

  let fn = fns[cmd]

  if (!fn) {
    return callback(null, 'unknown cmd')
  }

  ee.once(fn.response, fn.handler || defaultHandler(fn, callback))

  sendMsg(cmd, args)
}

const r = repl.start({
  prompt: '',
  eval: handle
})

r.pause()
r.setPrompt('switch> ')

wss.on('connection', function (ws) {
  connection = ws
  console.log('Switch connected...')

  bridgedFns.forEach(function (fn) {
    if (!fn) return
    const args = fn.split(' ')
    ws.send(JSON.stringify({
      cmd: 'bridge',
      args: args
    }))
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
