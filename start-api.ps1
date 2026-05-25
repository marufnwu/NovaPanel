$env:SESSION_SECRET = "change-me-to-64-random-chars-minimum-session-secret"
$env:JWT_SECRET = "change-me-to-64-random-chars-minimum-jwt-secret!!"
$env:SF_ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
$env:ADMIN_EMAIL = "admin@example.com"
$env:LE_EMAIL = "admin@example.com"

cd apps/api
node dist/index.js --skip-migrate