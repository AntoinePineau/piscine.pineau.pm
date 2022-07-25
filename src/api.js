const add = (data) => {
  return fetch('/.netlify/functions/add-measure', {
    body: JSON.stringify(data),
    method: 'POST'
  }).then(response => {
    return response.json()
  })
}

const readAll = () => {
  return fetch('/.netlify/functions/read-all-measures').then((response) => {
    return response.json()
  })
}

const readLast = () => {
  return fetch('/.netlify/functions/read-last-measure').then((response) => {
    return response.json()
  })
}


export default {
  add: add,
  readAll: readAll,
  readLast: readLast
}