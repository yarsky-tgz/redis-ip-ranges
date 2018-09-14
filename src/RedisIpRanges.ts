import { toLong, cidrSubnet } from "ip";
import { createHandyClient, IHandyRedis } from 'handy-redis';

class RedisIpRanges {
  private client: IHandyRedis;
  readonly prefix: string;
  readonly IPS_KEY: string;
  readonly INDEX_KEY: string;
  readonly CIDR_KEY: string;
  constructor(client: any, prefix: string = 'proxies') {
    this.client = createHandyClient(client);
    this.prefix = prefix;
    this.IPS_KEY = this.prefix + ':ips';
    this.INDEX_KEY = this.prefix + ':index';
    this.CIDR_KEY = this.prefix + ':cidr:';
  }
  async insert(cidr: string) {
    if (cidr.indexOf('/') === -1) return this.client.sadd(this.IPS_KEY, cidr);
    const subnet: SubnetInfo = cidrSubnet(cidr);
    await this.client.zadd(this.INDEX_KEY, [toLong(subnet.lastAddress), cidr]);
    return this.client.set(this.CIDR_KEY + cidr, toLong(subnet.firstAddress).toString());
  }
  async insertBulk(cidrs: string[]) {
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
    if (ips.length) await this.client.sadd(this.IPS_KEY, ...ips);
    if (ranges.length) {
      await this.client.zadd(this.INDEX_KEY, ...ranges);
      await this.client.mset(...minimals);
    }
  }
  async check(ip: string): Promise<boolean> {
    if (await this.client.sismember(this.IPS_KEY, ip)) return true;
    const longIp = toLong(ip);
    const candidate = await (this.client.zrangebyscore as any)(this.INDEX_KEY, longIp, Infinity, 'limit' as any, 0 as any, 1 as any);
    if (candidate.length) return (longIp > parseInt(await this.client.get(this.CIDR_KEY + candidate[ 0 ])));
    return false;
  }
  remove(ip: string) {
  
  }
}

export = RedisIpRanges;
