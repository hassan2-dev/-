import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const row = await prisma.storeSettings.upsert({
  where: { id: 'store' },
  create: {
    id: 'store',
    forceUpdate: true,
    minIosVersion: '1.0.3',
    minAndroidVersion: '1.0.3',
    updateMessage: 'يتوفر تحديث جديد لتطبيق تفاحة. يجب تحديث التطبيق للمتابعة.',
    iosStoreUrl: 'https://apps.apple.com/app/id6763769377',
    androidStoreUrl:
      'https://play.google.com/store/apps/details?id=com.tofahastore.app',
  },
  update: {
    forceUpdate: true,
    minIosVersion: '1.0.3',
    minAndroidVersion: '1.0.3',
    updateMessage: 'يتوفر تحديث جديد لتطبيق تفاحة. يجب تحديث التطبيق للمتابعة.',
    iosStoreUrl: 'https://apps.apple.com/app/id6763769377',
    androidStoreUrl:
      'https://play.google.com/store/apps/details?id=com.tofahastore.app',
  },
});

console.log(
  'OK',
  JSON.stringify({
    forceUpdate: row.forceUpdate,
    minIosVersion: row.minIosVersion,
    minAndroidVersion: row.minAndroidVersion,
  }),
);

await prisma.$disconnect();
