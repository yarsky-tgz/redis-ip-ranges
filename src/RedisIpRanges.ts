import { toLong, cidrSubnet } from "ip";
import {Redis} from "ioredis";
import {RedisIpRangesOptions} from "../index";
const rangeReducer = (result: string[], range: [number|string, string]) => {
  range.forEach((element: number|string) => result.push(element.toString()));
  return result;
};
const defaultOptions: RedisIpRangesOptions = {
  versioning: true,
};
class RedisIpRanges {
  private client: Redis;
  private whitelist: RedisIpRanges;
  readonly prefix: string;
  private IPS_KEY: string;
  private INDEX_KEY: string;
  private CIDR_KEY: string;
  readonly VERSION_KEY: string;
  readonly versioning: boolean;
  constructor(client: Redis, prefix: string, options: RedisIpRangesOptions) {
    options = Object.assign({}, defaultOptions, options);
    this.client = client;
    this.prefix = prefix;
    this.versioning = options.versioning;
    (this.whitelist as any) = options.whitelist;
    this.VERSION_KEY = `${prefix}:version`;
  }
  async init(version?: string) {
    if (this.versioning) version = version || await this.getVersion();
    else version = 'default';
    this.IPS_KEY = `${this.prefix}.${version}:ips`;
    this.INDEX_KEY = `${this.prefix}.${version}:index`;
    this.CIDR_KEY = `${this.prefix}.${version}:cidr:`;
  }
  async getVersion() {
    if (!this.versioning) return 'default';
    return this.client.get(this.VERSION_KEY);
  }
  setVersion(version: string) {
    if (!this.versioning) return;
    return this.client.set(this.VERSION_KEY, version);
  }
  async clean(version: string) {
    await this.init();
    const match = `${this.prefix}.${version}*`;
    const stream = this.client.scanStream({
      match,
      count: 100
    });
    return new Promise((resolve, reject) => {
      const keys: string[] = [];
      stream.on('data', function (resultKeys: string[]) {
        for (let i = 0; i < resultKeys.length; i++) {
          keys.push(resultKeys[i]);
        }
      });
      stream.on('error', err => reject(err));
      stream.on('end', async () => {
        try {
          while (keys.length > 0) await this.client.del(...keys.splice(-1000, 1000));
        } catch (e) {
          reject(e);
        }
        resolve();
      });
    });
  }
  private async getCidrByIp(ip: string) {
    const longIp = toLong(ip);
    const [cidr] = await this.client.zrangebyscore(this.INDEX_KEY, longIp, Infinity, 'limit', '0', '1'); //(this.client.zrangebyscore as any)(this.INDEX_KEY, longIp, Infinity, 'limit' as any, 0 as any, 1 as any);
    if (cidr) {
      const minValCheck = parseInt(await this.client.get(this.CIDR_KEY + cidr), 10);
      if (minValCheck <= longIp) return cidr;
    }
  }
  private async deleteCidr(cidr: string) {
    await this.client.zrem(this.INDEX_KEY, cidr);
    return this.client.del(this.CIDR_KEY + cidr);
  }
  async insert(cidr: string) {
    if (!this.IPS_KEY) await this.init();
    if (cidr.indexOf('/') === -1) return this.client.sadd(this.IPS_KEY, cidr);
    const subnet: SubnetInfo = cidrSubnet(cidr);
    await this.client.zadd(this.INDEX_KEY, toLong(subnet.lastAddress).toString(), cidr);
    return this.client.set(this.CIDR_KEY + cidr, toLong(subnet.firstAddress).toString());
  }
  async insertBulk(cidrs: string[]) {
    if (!this.IPS_KEY) await this.init();
    const ips: string[] = [];
    const ranges: [number, string][] = [];
    const minimals: [string, string][] = [];
    for (let cidr of cidrs) {
      if (cidr.indexOf('/') === -1) {
        ips.push(cidr);
        continue;
      }
      const subnet: SubnetInfo = cidrSubnet(cidr);
      ranges.push([toLong(subnet.lastAddress), cidr]);
      minimals.push([this.CIDR_KEY + cidr, toLong(subnet.firstAddress).toString()]);
    }
    if (ips.length) {
      await this.client.sadd(this.IPS_KEY, ...ips);
    }

    if (ranges.length) {
      await this.client.zadd(this.INDEX_KEY, ...ranges.reduce(rangeReducer, []));
      if (minimals.length > 1) await (this.client.mset as any)(...minimals.reduce(rangeReducer, []));
    }
  }
  async check(ip: string): Promise<string> {
    await this.init();
    if (this.whitelist && await this.whitelist.check(ip)) return;
    if (await this.client.sismember(this.IPS_KEY, ip)) return ip;
    return this.getCidrByIp(ip);
  }
  async remove(ip: string) {
    await this.init();
    if (ip.indexOf('/') !== -1) await this.deleteCidr(ip);
    await this.client.srem(this.IPS_KEY, ip);
    const candidate = await this.getCidrByIp(ip);
    if (candidate) await this.deleteCidr(candidate);
  }
}

export = RedisIpRanges;
