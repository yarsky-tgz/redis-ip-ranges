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
const rangeReducer = (result, range) => {
    range.forEach((element) => result.push(element.toString()));
    return result;
};
const defaultOptions = {
    versioning: true,
};
class RedisIpRanges {
    constructor(client, prefix, options) {
        options = Object.assign({}, defaultOptions, options);
        this.client = client;
        this.prefix = prefix;
        this.versioning = options.versioning;
        this.whitelist = options.whitelist;
        this.VERSION_KEY = `${prefix}:version`;
    }
    init(version) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.versioning)
                version = version || (yield this.getVersion());
            else
                version = 'default';
            this.IPS_KEY = `${this.prefix}.${version}:ips`;
            this.INDEX_KEY = `${this.prefix}.${version}:index`;
            this.CIDR_KEY = `${this.prefix}.${version}:cidr`;
        });
    }
    getVersion() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.versioning)
                return 'default';
            return this.client.get(this.VERSION_KEY);
        });
    }
    setVersion(version) {
        if (!this.versioning)
            return;
        return this.client.set(this.VERSION_KEY, version);
    }
    clean(version) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.init();
            const match = `${this.prefix}.${version}*`;
            const stream = this.client.scanStream({
                match,
                count: 100
            });
            return new Promise((resolve, reject) => {
                const keys = [];
                stream.on('data', function (resultKeys) {
                    for (let i = 0; i < resultKeys.length; i++) {
                        keys.push(resultKeys[i]);
                    }
                });
                stream.on('error', err => reject(err));
                stream.on('end', () => __awaiter(this, void 0, void 0, function* () {
                    try {
                        while (keys.length > 0)
                            yield this.client.del(...keys.splice(-1000, 1000));
                    }
                    catch (e) {
                        reject(e);
                    }
                    resolve();
                }));
            });
        });
    }
    getCidrByIp(ip) {
        return __awaiter(this, void 0, void 0, function* () {
            const longIp = ip_1.toLong(ip);
            const [cidr] = yield this.client.zrangebyscore(this.INDEX_KEY, longIp, Infinity, 'limit', '0', '1'); //(this.client.zrangebyscore as any)(this.INDEX_KEY, longIp, Infinity, 'limit' as any, 0 as any, 1 as any);
            if (cidr) {
                const minValCheck = parseInt(yield this.client.get(this.CIDR_KEY + cidr), 10);
                if (minValCheck < longIp)
                    return cidr;
            }
        });
    }
    deleteCidr(cidr) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.client.zrem(this.INDEX_KEY, cidr);
            return this.client.del(this.CIDR_KEY + cidr);
        });
    }
    insert(cidr) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.init();
            if (cidr.indexOf('/') === -1)
                return this.client.sadd(this.IPS_KEY, cidr);
            const subnet = ip_1.cidrSubnet(cidr);
            yield this.client.zadd(this.INDEX_KEY, ip_1.toLong(subnet.lastAddress).toString(), cidr);
            return this.client.set(this.CIDR_KEY + cidr, ip_1.toLong(subnet.firstAddress).toString());
        });
    }
    insertBulk(cidrs) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.init();
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
            if (ips.length) {
                yield this.client.sadd(this.IPS_KEY, ...ips);
            }
            if (ranges.length) {
                yield this.client.zadd(this.INDEX_KEY, ...ranges.reduce(rangeReducer, []));
                if (minimals.length > 1)
                    yield this.client.mset(...minimals.reduce(rangeReducer, []));
            }
        });
    }
    check(ip) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.init();
            if (this.whitelist && (yield this.whitelist.check(ip)))
                return;
            if (yield this.client.sismember(this.IPS_KEY, ip))
                return ip;
            return this.getCidrByIp(ip);
        });
    }
    remove(ip) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.init();
            if (ip.indexOf('/') !== -1)
                yield this.deleteCidr(ip);
            yield this.client.srem(this.IPS_KEY, ip);
            const candidate = yield this.getCidrByIp(ip);
            if (candidate)
                yield this.deleteCidr(candidate);
        });
    }
}
module.exports = RedisIpRanges;
//# sourceMappingURL=RedisIpRanges.js.map