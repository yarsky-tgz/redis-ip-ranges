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
  private async getCidrByIp(ip: string) {
    const longIp = toLong(ip);
    const [cidr] = await (this.client.zrangebyscore as any)(this.INDEX_KEY, longIp, Infinity, 'limit' as any, 0 as any, 1 as any);
    if (cidr) {
      const minValCheck = parseInt(await this.client.get(this.CIDR_KEY + cidr), 10);
      if (minValCheck < longIp) return cidr;
    }
  }
  private async deleteCidr(cidr: string) {
    await this.client.zrem(this.INDEX_KEY, cidr);
    return this.client.del(this.CIDR_KEY + cidr);
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
  async check(ip: string): Promise<string> {
    if (await this.client.sismember(this.IPS_KEY, ip)) return ip;
    return this.getCidrByIp(ip);
  }
  async remove(ip: string) {
    if (ip.indexOf('/') !== -1) await this.deleteCidr(ip);
    await this.client.srem(this.IPS_KEY, ip);
    const candidate = await this.getCidrByIp(ip);
    if (candidate) await this.deleteCidr(candidate);
  }
}

export = RedisIpRanges;
