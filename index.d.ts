//export as namespace RedisIpRanges;
export = RedisIpRanges;

declare namespace RedisIpRanges {
  export interface RedisIpRangesOptions {
    whitelist?: RedisIpRanges;
    versioning?: boolean;
  }
}
declare class RedisIpRanges {
  constructor(client: any, prefix: string, options: RedisIpRanges.RedisIpRangesOptions);
  insert(cidr: string): Promise<any>;
  insertBulk(cidrs: string[]): Promise<any>;
  check(ip: string): Promise<boolean>;
  remove(ip: string): Promise<any>;
}

export = RedisIpRanges;