const faunadb = require('faunadb')
const q = faunadb.query

//const secret = process.env.FAUNADB_SECRET
//var endpoint = process.env.FAUNADB_ENDPOINT
const secret='fnAEsXkXO8ACSdshO_ivs5r277vs_Sw9qZON0Doz'

if (typeof secret === 'undefined' || secret === '') {
  console.error('The FAUNADB_SECRET environment variable is not set, exiting.')
  process.exit(1)
}

if (!endpoint) endpoint = 'https://db.fauna.com/'

var mg, domain, port, scheme
if ((mg = endpoint.match(/^(https?):\/\/([^:]+)(:(\d+))?/))) {
  scheme = mg[1] || 'https'
  domain = mg[2] || 'db.fauna.com'
  port = mg[4] || 443
}

const client = new faunadb.Client({
  secret: secret,
  domain: domain,
  port: port,
  scheme: scheme,
})

client.query(
  q.Create(
    q.Collection('People'),
    {
      data: {
        first: 'Linus',
        last: 'Torvalds',
        age: 52,
      },
    },
  )
)
.then((ret) => console.log(ret))
.catch((err) => console.error(
  'Error: [%s] %s: %s',
  err.name,
  err.message,
  err.errors()[0].description,
))