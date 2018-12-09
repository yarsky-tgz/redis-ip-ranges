const redis = require('redis');
const redisClient = redis.createClient();
const RedisIpRanges = require('redis-ip-ranges');
const proxiesRanges = new RedisIpRanges(redisClient, 's1-proxies');
const present = require('present');

(async () => {
  const startTime1 = present();
  for (let i = 0; i < 100000; i++) await proxiesRanges.check('37.73.12.161');
  const finishTime1 = present();
  console.log(`100 000 checks for NOT PROXY ip taken ${(finishTime1 - startTime1) / 1000.0} seconds`);
  const startTime2 = present();
  for (let i = 0; i < 100000; i++) await proxiesRanges.check('181.224.136.5');
  const finishTime2 = present();
  console.log(`100 000 checks for PROXY ip (part of CIDR range) taken ${(finishTime2 - startTime2) / 1000.0} seconds`);
  const startTime3 = present();
  for (let i = 0; i < 100000; i++) await proxiesRanges.check('1.0.0.88');
  const finishTime3 = present();
  console.log(`100 000 checks for PROXY ip (single IP) taken ${(finishTime3 - startTime3) / 1000.0} seconds`);
})();
