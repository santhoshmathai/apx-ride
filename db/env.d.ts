declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    BUCKET: R2Bucket;
    APX_AUTH_MODE?: string;
    CF_ACCESS_TEAM_DOMAIN?: string;
    CF_ACCESS_AUD?: string;
  }
}

declare const __APX_CLOUDFLARE_BUILD__: boolean;
