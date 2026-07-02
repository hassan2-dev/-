const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const source = path.join(root, 'assets', 'icon.png');
const targetDir = path.join(root, 'admin-update', 'assets');
const target = path.join(targetDir, 'icon.png');

if (!fs.existsSync(source)) {
  console.error('[admin-icon] missing source:', source);
  process.exit(1);
}

fs.mkdirSync(targetDir, { recursive: true });
fs.copyFileSync(source, target);
console.log('[admin-icon] copied to admin-update/assets/icon.png');
