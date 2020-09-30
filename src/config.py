import os

DEBUG = os.getenv("DEBUG", False)

BCRYPT_LOG_ROUNDS = 12

SECRET_KEY = "1b2ac321-c8fc-4ad5-a0ca-44ba12364618"

MAX_SESSION_TIME = 365

MAIL_FROM_EMAIL = os.getenv("EMAIL_FROM", "admin@localhost")

# Oidc
OIDC_CLIENT_SECRETS = "client_secrets.json"
OVERWRITE_REDIRECT_URI = os.getenv("OVERWRITE_REDIRECT_URI", None)
OIDC_ID_TOKEN_COOKIE_SECURE = True
OIDC_REQUIRE_VERIFIED_EMAIL = False
OIDC_USER_INFO_ENABLED = True
OIDC_OPENID_REALM = "master"
OIDC_SCOPES = ["openid", "email", "profile"]
OIDC_INTROSPECTION_AUTH_METHOD = "client_secret_post"
