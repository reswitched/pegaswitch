#!/usr/bin/env node
require('colors')

const repl = require('repl')
const events = require('events')
const fs = require('fs')
const path = require('path')

const WebSocket = require('ws')
const History = require('repl.history')
const stringArgv = require('string-argv')

const utils = require('./exploit/utils')

const ee = new events.EventEmitter()
const wss = new WebSocket.Server({ port: 8100 })

const historyPath = path.resolve(__dirname, '.shell_history')

const bridgedFns = fs.readFileSync(path.resolve(__dirname, 'bridged.txt')).toString().split('\n').map(x => x.replace('\r', '')).splice(1).filter(Boolean)

try {
  fs.statSync(path.resolve(__dirname, 'exploit/bundle.js'))
} catch (e) {
  console.error('Please run `npm start` in another window and rerun this script')
  process.exit(1)
}

console.log('Waiting for connection..')

let connection

let bridges = bridgedFns.reduce(function (obj, fn) {
  var t = fn.split(' ')
  obj[t.shift()] = {
    addr: t.shift(),
    return: t.shift(),
    args: t
  }
  return obj
}, {})

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
    helptxt: 'Bridges native function to name you can call',
    handler: function (args, callback) {
      return function (response) {
        bridges[args.shift()] = {
          addr: args.shift(),
          return: args.shift(),
          args: args
        }
        return callback()
      }
    }
  },
  bridges: {
    response: 'bridges',
    helptxt: 'Lists bridged native functions'
  },
  call: {
    response: 'call',
    minArgs: 1,
    help: 'call <name> <...args>',
    helptxt: 'Call a bridged native function',
    setup: function (args, callback) {
      let name = args.shift()
      args = args.join(' ') // join em back together so we can parse properly
      let fn = bridges[name]
      if (!fn) {
        return callback(null, 'unknown fn')
      }
      let parsed = stringArgv(args)
      if (parsed.length !== fn.args.length) {
        console.error('Invalid number of arguments, wanted: ' + fn.args.join(' ').bold)
        return callback()
      }
      for (let i = 0; i < fn.args.length; i++) {
        let type = fn.args[i]
        switch (type) {
          case 'int': {
            parsed[i] = parseInt(parsed[i])
            if (isNaN(parsed[i])) {
              console.error('Invalid parameter at position', i, 'expected', 'int'.bold)
              return callback()
            }
          }
          case 'char*': {
            // do nothing
            break;
          }
          case 'void*': {
            try {
              parsed[i] = utils.parseAddr(parsed[i])
            } catch (e) {
              console.error('Invalid parameter at position', i, 'expected', 'addr'.bold)
              return callback()
            }
          }
        }
      }
      parsed.unshift(name)
      return parsed
    }
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
  },
  eval: {
    response: 'evald',
    help: 'eval <...code>',
    helptxt: 'Evals code on remote console and returns response if applicable'
  },
  evalfile: {
    response: 'evald',
    help: 'evalfile <filename>',
    helptxt: 'Evals code read from file',
    setup: function (args, callback) {
      try {
        var filepath = path.resolve(__dirname, args[0])
        fs.statSync(filepath)
        return fs.readFileSync(filepath).toString().split('\n')
      } catch (e) {
        return callback(null, 'invalid file')
      }
    }
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

  if (fn.setup) {
    args = fn.setup(args, callback)
    if (!args) {
      return
    }
  }

  var handle = fn.handler ? fn.handler(args, callback) : defaultHandler(saveVal, callback)

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

  r.setPrompt('switch> ')
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
