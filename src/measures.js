// https://nordschool.com/build-a-serverless-database-using-faunadb-and-netlify-functions/
exports.handler = async (event, context) => {
  const path = event.path.replace(/\.netlify\/functions\/[^\/]+/, '');
  const segments = path.split('/').filter(e => e);

  switch (event.httpMethod) {
    case 'GET':
      // e.g. GET /.netlify/functions/measures
      if (segments.length === 0) {
        return require('./measures/read-all').handler(event, context);
      }
    case 'POST':
      // e.g. POST /.netlify/functions/measures with a body of key value pair objects, NOT strings
      return require('./measures/add').handler(event, context);
    case 'OPTIONS':
      // To enable CORS
      const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST'
      };
      return {
        statusCode: 200, // <-- Must be 200 otherwise pre-flight call fails
        headers,
        body: 'This was a preflight call!'
      };
  }
  return {
    statusCode: 500,
    body: 'unrecognized HTTP Method, must be one of GET/POST/OPTIONS'
  };
};