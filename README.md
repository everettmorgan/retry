# ejmorgan-retry

A simple and lightweight package to retry various execution contexts.
## Installation

```bash
npm install ejmorgan-retry
// or
yarn add ejmorgan-retry
```

## Usage

### Basic
```javascript
const { Retry } = require("ejmorgan-retry");

const retry = new Retry(function(resolve, reject, retry) {
    if (retry.attempts < 5)
        resolve(retry.reschedule(2000))
    else
        reject("oof!");
})

retry.schedule()
    .then((ok) => console.log(ok))
    .catch((err) => console.error(err));
```

### HTTP Request
```javascript
const https = require("https");
const { Retry } = require("ejmorgan-retry");

// create a Retry that wraps our execution context
const retry = new Retry((resolve, reject, retry) => {
  // let's make an http request
  const req = https.request({/* opts */}, (res) => {
    let data = "";

    res.on("data",(d) = > data += d);

    res.on("error", (e) => reject(e));

    res.on("end", () => {
      // success
      if (res.statusCode >= 200 && res.statusCode < 400) {
        resolve(res);
      } 
      
      // retry?
      else if (retry.attempts < 5) {
        // this line reschedules the retry
        // you MUST use the resolve() function
        // otherwise, using `return` or `reject`
        // will exit out of the Retry immediately
        resolve(retry.reschedule(2000));
      } 
      
      // error, no retries left
      else {
        reject("ERR");
      }
    });
  });

  req.end();
});

// let's call our wrapped execution context
retry.schedule()
  // handle resolve() or return
  .then((res) => console.log(res))
  // handle reject()
  .catch((err) => console.error(err));
```
