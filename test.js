const redis = require('redis');
const RedisIpRanges = require('./dist');
const client = redis.createClient({
  host: '127.0.0.1',
  port: 6379
});
const rangesHandler = new RedisIpRanges(client, 'proxies');

(async () => {
  await rangesHandler.insertBulk(['127.0.0.1', '10.0.0.0/8']);
  console.log(await rangesHandler.check('127.0.0.1')); //true
  console.log(await rangesHandler.check('10.10.128.1')); //true
  console.log(await rangesHandler.check('127.0.0.2')); //false
  console.log(await rangesHandler.check('8.8.8.8')); //false
})();


(async () => {
  console.log('------Delete test----------');
  await rangesHandler.insertBulk(['10.0.0.0/8', '1.1.1.1']);
  console.log(await rangesHandler.check('10.11.11.5')); //false
  console.log(await rangesHandler.check('10.10.10.10')); //true
  console.log(await rangesHandler.check('1.1.1.1')); //true
  await rangesHandler.remove('10.0.0.0/8');
  console.log('Delete cidr');
  console.log(await rangesHandler.check('10.10.10.10')); //false
  console.log(await rangesHandler.check('10.11.11.5')); //false
  console.log(await rangesHandler.check('1.1.1.1')); //true
  await rangesHandler.remove('1.1.1.1');
  console.log('Delete ip');
  console.log(await rangesHandler.check('10.10.10.10')); //false
  console.log(await rangesHandler.check('10.11.11.5')); //false
  console.log(await rangesHandler.check('1.1.1.1')); //true
})();