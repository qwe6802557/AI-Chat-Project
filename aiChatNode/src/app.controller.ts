import { Controller, Get, Query } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth(
    @Query('includeProviders') includeProviders?: string,
    @Query('providerTimeoutMs') providerTimeoutMs?: string,
    @Query('providerCacheTtlSeconds') providerCacheTtlSeconds?: string,
    @Query('bypassProviderCache') bypassProviderCache?: string,
  ) {
    return this.appService.getHealth({
      includeProviders: includeProviders === 'true',
      providerTimeoutMs: providerTimeoutMs
        ? Number.parseInt(providerTimeoutMs, 10)
        : undefined,
      providerCacheTtlSeconds: providerCacheTtlSeconds
        ? Number.parseInt(providerCacheTtlSeconds, 10)
        : undefined,
      bypassProviderCache: bypassProviderCache === 'true',
    });
  }

  @Get('health/redis')
  getRedisHealth() {
    return this.appService.getRedisHealth();
  }

  @Get('health/database')
  getDatabaseHealth() {
    return this.appService.getDatabaseHealth();
  }

  @Get('health/providers')
  getProvidersHealth(
    @Query('timeoutMs') timeoutMs?: string,
    @Query('cacheTtlSeconds') cacheTtlSeconds?: string,
    @Query('bypassCache') bypassCache?: string,
  ) {
    return this.appService.getProvidersHealth({
      timeoutMs: timeoutMs ? Number.parseInt(timeoutMs, 10) : undefined,
      cacheTtlSeconds: cacheTtlSeconds
        ? Number.parseInt(cacheTtlSeconds, 10)
        : undefined,
      bypassCache: bypassCache === 'true',
    });
  }
}
