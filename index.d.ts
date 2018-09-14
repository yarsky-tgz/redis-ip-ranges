declare class RedisIpRanges {
  constructor(client: any, prefix?: string);
  insert(cidr: string): Promise<any>;
  insertBulk(cidrs: string[]): Promise<any>;
  check(ip: string): Promise<boolean>;
  remove(ip: string): Promise<any>;
}

export = RedisIpRanges;