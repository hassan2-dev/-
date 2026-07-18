/**
 * Manual OTPIQ smoke test.
 * Usage (from backend/): node --env-file=.env scripts/otpiq-test-send.mjs
 * Or set OTPIQ_API_KEY in the environment first.
 */
const KEY = process.env.OTPIQ_API_KEY;
const phoneLocal = process.env.OTPIQ_TEST_PHONE || '07833390888';
const phoneNumber = '964' + phoneLocal.slice(1);
const code = String(Math.floor(100000 + Math.random() * 900000));

async function main() {
  if (!KEY) {
    console.error('Missing OTPIQ_API_KEY. Load backend/.env or export it first.');
    process.exit(1);
  }

  console.log('Sending OTP to', phoneNumber, 'code=', code);
  const res = await fetch('https://api.otpiq.com/api/sms', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      phoneNumber,
      smsType: 'verification',
      verificationCode: code,
      provider: 'auto',
    }),
  });
  const text = await res.text();
  console.log('STATUS', res.status);
  console.log(text);
}

main().catch((e) => {
  console.error('ERR', e.message);
  process.exit(1);
});
