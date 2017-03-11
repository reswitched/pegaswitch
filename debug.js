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
    response: 'bridged',
    minArgs: 3,
    help: 'bridge <name> <addr> <retval> <...args>'
  },
  bridges: {
    response: 'bridges'
  },
  call: {
    response: 'call',
    minArgs: 1,
    help: 'call <name> <...args>'
  },
  gc: {
    response: 'gcran'
  },
  malloc: {
    response: 'mallocd',
    args: 1,
    help: 'malloc <bytes>'
  },
  write4: {
    response: 'wrote4',
    wait: false,
    minArgs: 2,
    maxArgs: 3,
    help: 'write4 <addr> <data> <offset=0>'
  },
  write8: {
    response: 'wrote8',
    wait: false,
    minArgs: 2,
    maxArgs: 3,
    help: 'write8 <addr> <data> <offset=0>'
  },
  read4: {
    response: 'rread',
    minArgs: 1,
    maxArgs: 2,
    help: 'read4 <addr> <offset=0>'
  },
  read8: {
    response: 'rread',
    minArgs: 1,
    maxArgs: 2,
    help: 'read8 <addr> <offset=0>'
  },
  readstring: {
    response: 'rreadstring',
    minArgs: 1,
    maxArgs: 2,
    help: 'readstring <addr> <bytes=4>'
  }
}

let _ = null // last value reg

function defaultHandler (saveVal, callback) {
  return function (response) {
    if (saveVal) {
      _ = response
    }
    return callback(null, response)
  }
}

function handle (input, context, filename, callback) {
  let tmp = input.replace(/\n$/, '')

  if (!tmp) {
    return callback()
  }

  let saveVal = false

  let args = tmp.split(' ')
  let cmd = args.shift()

  if (cmd === '_') {
    return callback(null, _)
  } else if (cmd === '$') {
    // if prefixed with $ we
    // save the response to _
    saveVal = true
    cmd = args.shift()
  }

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '_') {
      args[i] = _
    }
  }

  let fn = fns[cmd]

  if (!fn) {
    return callback(null, 'unknown cmd')
  }

  if (
    fn.args !== undefined && fn.args !== args.length ||
    fn.minArgs !== undefined && fn.minArgs > args.length ||
    fn.maxArgs !== undefined && args.length > fn.maxArgs
  ) {
    return callback(null, fn.help)
  }

  var handle = fn.handler || defaultHandler(saveVal, callback)

  ee.once(fn.response, handle)

  sendMsg(cmd, args)

  if (fn.wait === false) {
    ee.removeListener(fn.response, handle)
    return callback()
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
