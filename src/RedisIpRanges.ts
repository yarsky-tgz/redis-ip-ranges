import { toLong, cidrSubnet } from "ip";
import { createHandyClient, IHandyRedis } from 'handy-redis';

class RedisIpRanges {
  private client: IHandyRedis;
  readonly prefix: string;
  private IPS_KEY: string;
  private INDEX_KEY: string;
  private CIDR_KEY: string;
  readonly VERSION_KEY: string;
  readonly ttl: number;
  constructor(client: any, prefix: string, ttl: number = 86400 * 2) {
    this.client = createHandyClient(client);
    this.prefix = prefix;
    this.ttl = ttl;
    this.VERSION_KEY = `${prefix}:version`;
  }
  async init(version?: string) {
    if (version) this.setVersion(version);
    else version = await this.getVersion();
    this.IPS_KEY = `${this.prefix}.${version}:ips`;
    this.INDEX_KEY = `${this.prefix}.${version}:index`;
    this.CIDR_KEY = `${this.prefix}.${version}:cidr`;
  }
  private getVersion() {
    return this.client.get(this.VERSION_KEY);
  }
  private setVersion(version: string) {
    return this.client.set(this.VERSION_KEY, version);
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
    await this.client.expire(this.INDEX_KEY, this.ttl);
    await this.client.expire(this.CIDR_KEY + cidr, this.ttl);
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
      this.client.expire(this.CIDR_KEY + cidr, this.ttl);
    }
    if (ips.length) {
      await this.client.sadd(this.IPS_KEY, ...ips);
      this.client.expire(this.IPS_KEY, this.ttl);
    }
    if (ranges.length) {
      await this.client.zadd(this.INDEX_KEY, ...ranges);
      this.client.expire(this.INDEX_KEY, this.ttl);
      await this.client.mset(...minimals);
    }
  }
  async check(ip: string): Promise<string> {
    await this.init();
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
