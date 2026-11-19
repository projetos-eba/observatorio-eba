declare namespace Cloudflare {
  interface Env {
    EBA_DEV_ADMIN?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
    EBA_INTEGRATION_KEY?: string;
    EBA_INTEGRATION_SCHEDULER?: string;
  }
}
