import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SMS_PROVIDER } from './sms-provider.interface';
import { ConsoleSmsProvider } from './console-sms.provider';
import { HttpSmsProvider } from './http-sms.provider';
import { OtpiqSmsProvider } from './otpiq-sms.provider';

@Module({
  providers: [
    ConsoleSmsProvider,
    HttpSmsProvider,
    OtpiqSmsProvider,
    {
      provide: SMS_PROVIDER,
      inject: [
        ConfigService,
        ConsoleSmsProvider,
        HttpSmsProvider,
        OtpiqSmsProvider,
      ],
      useFactory: (
        config: ConfigService,
        consoleProvider: ConsoleSmsProvider,
        httpProvider: HttpSmsProvider,
        otpiqProvider: OtpiqSmsProvider,
      ) => {
        const provider = config.get<string>('sms.provider', 'console');
        switch (provider) {
          case 'otpiq':
            return otpiqProvider;
          case 'http':
            return httpProvider;
          default:
            return consoleProvider;
        }
      },
    },
  ],
  exports: [SMS_PROVIDER],
})
export class SmsModule {}
