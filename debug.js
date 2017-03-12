require('colors')

const repl = require('repl')
const events = require('events')
const fs = require('fs')
const path = require('path')

const WebSocket = require('ws')
const History = require('repl.history')

const ee = new events.EventEmitter()
const wss = new WebSocket.Server({ port: 81 })

const historyPath = path.resolve(__dirname, '.shell_history')

const bridgedFns = fs.readFileSync(path.resolve(__dirname, 'bridged.txt')).toString().split('\n').map(x => x.replace('\r', '')).splice(1)

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
    response: 'gotsp',
    helptxt: 'Return SP'
  },
  bridge: {
    response: 'bridged',
    minArgs: 3,
    help: 'bridge <name> <addr> <retval> <...args>',
    helptxt: 'Bridges native function to name you can call'
  },
  bridges: {
    response: 'bridges',
    helptxt: 'Lists bridged native functions'
  },
  call: {
    response: 'call',
    minArgs: 1,
    help: 'call <name> <...args>',
    helptxt: 'Call a bridged native function'
  },
  gc: {
    response: 'gcran',
    helptxt: 'Forcefully run GC'
  },
  malloc: {
    response: 'mallocd',
    args: 1,
    help: 'malloc <bytes>',
    helptxt: 'Allocates space at returned address'
  },
  free: {
    response: 'freed',
    wait: false,
    args: 1,
    help: 'free <address>',
    helptxt: 'Frees memory at address allocated by malloc'
  },
  write4: {
    response: 'wrote4',
    wait: false,
    minArgs: 2,
    maxArgs: 3,
    help: 'write4 <addr> <data> <offset=0>',
    helptxt: 'Writes 4 bytes of data to address'
  },
  write8: {
    response: 'wrote8',
    wait: false,
    minArgs: 2,
    maxArgs: 3,
    help: 'write8 <addr> <data> <offset=0>',
    helptxt: 'Writes 8 bytes of data to address'
  },
  read4: {
    response: 'rread',
    minArgs: 1,
    maxArgs: 2,
    help: 'read4 <addr> <offset=0>',
    helptxt: 'Reads 4 bytes of data from address'
  },
  read8: {
    response: 'rread',
    minArgs: 1,
    maxArgs: 2,
    help: 'read8 <addr> <offset=0>',
    helptxt: 'Reads 8 bytes of data from address'
  },
  readstring: {
    response: 'rreadstring',
    minArgs: 1,
    maxArgs: 2,
    help: 'readstring <addr> <bytes=4>',
    helptxt: 'Reads data at address and prints as string'
  }
}

function showHelp (callback) {
  for(let k in fns) {
    let out = `${k.bold}: ${fns[k].helptxt}`
    if (fns[k].help) {
      out += ` (${fns[k].help})`.dim
    }
    console.log(out)
  }
  console.log()
  return callback()
}

let _ = undefined // last value reg

function defaultHandler (saveVal, callback) {
  return function (response) {
    if (saveVal) {
      _ = response
    }
    return callback(null, response)
  }
}

function handle (input, context, filename, callback) {
  if (!connection) {
    return console.log('Switch not connected...'.bold)
  }
  let tmp = input.replace(/\n$/, '')

  if (!tmp) {
    return callback()
  }

  let saveVal = false

  let args = tmp.split(' ')
  let cmd = args.shift()

  if (cmd === '_') {
    return callback(null, _)
  } else if (cmd === 'help') {
    return showHelp(callback)
  } else if (cmd === '$') {
    // if prefixed with $ we
    // save the response to _
    saveVal = true
    cmd = args.shift()
  }

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '_') {
      if (_ === undefined) {
        return callback(null, '_ has no value')
      }
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

History(r, historyPath)

r.setPrompt('')

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

  r.setPrompt('switch>')
  r.write('\n')

  ws.on('close', function () {
    console.log('\nSwitch disconnected...')
    r.setPrompt('')
    connection = null
    r.pause()
  })

  ws.on('message', function (data) {
    data = JSON.parse(data)
    const type = data.type
    const response = data.response
    ee.emit(type, response)
  })
})
