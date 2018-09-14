"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const ip_1 = require("ip");
const handy_redis_1 = require("handy-redis");
class RedisIpRanges {
    constructor(client, prefix = 'proxies') {
        this.client = handy_redis_1.createHandyClient(client);
        this.prefix = prefix;
        this.IPS_KEY = this.prefix + ':ips';
        this.INDEX_KEY = this.prefix + ':index';
        this.CIDR_KEY = this.prefix + ':cidr:';
    }
    insert(cidr) {
        return __awaiter(this, void 0, void 0, function* () {
            if (cidr.indexOf('/') === -1)
                return this.client.sadd(this.IPS_KEY, cidr);
            const subnet = ip_1.cidrSubnet(cidr);
            yield this.client.zadd(this.INDEX_KEY, [ip_1.toLong(subnet.lastAddress), cidr]);
            return this.client.set(this.CIDR_KEY + cidr, ip_1.toLong(subnet.firstAddress).toString());
        });
    }
    insertBulk(cidrs) {
        return __awaiter(this, void 0, void 0, function* () {
            const ips = [];
            const ranges = [];
            const minimals = [];
            for (let cidr of cidrs) {
                if (cidr.indexOf('/') === -1) {
                    ips.push(cidr);
                    continue;
                }
                const subnet = ip_1.cidrSubnet(cidr);
                ranges.push([ip_1.toLong(subnet.lastAddress), cidr]);
                minimals.push([this.CIDR_KEY + cidr, ip_1.toLong(subnet.firstAddress).toString()]);
            }
            if (ips.length)
                yield this.client.sadd(this.IPS_KEY, ...ips);
            if (ranges.length) {
                yield this.client.zadd(this.INDEX_KEY, ...ranges);
                yield this.client.mset(...minimals);
            }
        });
    }
    check(ip) {
        return __awaiter(this, void 0, void 0, function* () {
            if (yield this.client.sismember(this.IPS_KEY, ip))
                return true;
            const longIp = ip_1.toLong(ip);
            const candidate = yield this.client.zrangebyscore(this.INDEX_KEY, longIp, Infinity, 'limit', 0, 1);
            if (candidate.length)
                return (longIp > parseInt(yield this.client.get(this.CIDR_KEY + candidate[0])));
            return false;
        });
    }
    remove(ip) {
    }
}
module.exports = RedisIpRanges;
//# sourceMappingURL=RedisIpRanges.js.map