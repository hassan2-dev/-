import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SMS_PROVIDER } from './sms-provider.interface';
import { ConsoleSmsProvider } from './console-sms.provider';
import { HttpSmsProvider } from './http-sms.provider';

@Module({
  providers: [
    ConsoleSmsProvider,
    HttpSmsProvider,
    {
      provide: SMS_PROVIDER,
      inject: [ConfigService, ConsoleSmsProvider, HttpSmsProvider],
      useFactory: (
        config: ConfigService,
        consoleProvider: ConsoleSmsProvider,
        httpProvider: HttpSmsProvider,
      ) => {
        const provider = config.get<string>('sms.provider', 'console');
        return provider === 'http' ? httpProvider : consoleProvider;
      },
    },
  ],
  exports: [SMS_PROVIDER],
})
export class SmsModule {}
