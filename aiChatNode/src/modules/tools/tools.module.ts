import { Module } from '@nestjs/common';
import { WebSearchModule } from '../web-search/web-search.module';
import { ToolsController } from './tools.controller';
import { ToolRegistryService } from './tools.registry.service';
import { CodeInterpreterPlugin } from './plugins/code-interpreter.plugin';
import { WebSearchPlugin } from './plugins/web-search.plugin';
import { UrlFetcherPlugin } from './plugins/url-fetcher.plugin';
import { CalculatorPlugin } from './plugins/calculator.plugin';
import { WeatherPlugin } from './plugins/weather.plugin';
import { ClockCalendarPlugin } from './plugins/clock-calendar.plugin';

@Module({
  imports: [WebSearchModule],
  controllers: [ToolsController],
  providers: [
    ToolRegistryService,
    CodeInterpreterPlugin,
    WebSearchPlugin,
    UrlFetcherPlugin,
    CalculatorPlugin,
    WeatherPlugin,
    ClockCalendarPlugin,
  ],
  exports: [ToolRegistryService],
})
export class ToolsModule {}
