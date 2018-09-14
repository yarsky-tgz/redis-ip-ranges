# redis-ip-ranges
redis storage for not overlapping ip ranges with check ability

## Installation

```
npm i redis-ip-ranges
```

## Usage

```
const redis = require('redis');
const RedisIpRanges = require('./dist');
const client = redis.createClient();
const rangesHandler = new RedisIpRanges(client, 'proxies');

(async () => {
  await rangesHandler.insertBulk(['127.0.0.1', '10.0.0.0/8']);
  console.log(await rangesHandler.check('127.0.0.1')); //true
  console.log(await rangesHandler.check('10.10.128.1')); //true
  console.log(await rangesHandler.check('127.0.0.2')); //false
  console.log(await rangesHandler.check('8.8.8.8')); //false
})();
```
