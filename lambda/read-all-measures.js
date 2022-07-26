import faunadb from 'faunadb'

const q = faunadb.query
const client = new faunadb.Client({
  secret: process.env.FAUNADB_SECRET
})

exports.handler = (event, context, callback) => {
  console.log("Function `read-all-measures` invoked")
  return client.query(q.Paginate(q.Match(q.Ref("indexes/all_measures"))))
  .then((response) => {
    const todoRefs = response.data
    console.log("measure refs", todoRefs)
    console.log(`${todoRefs.length} measures found`)
    const getAllTodoDataQuery = todoRefs.map((ref) => {
      return q.Get(ref)
    })
    return client.query(getAllTodoDataQuery).then((ret) => {
      return callback(null, {
        statusCode: 200,
        body: JSON.stringify(ret)
      })
    })
  }).catch((error) => {
    console.log("error", error)
    return callback(null, {
      statusCode: 400,
      body: JSON.stringify(error)
    })
  })
}