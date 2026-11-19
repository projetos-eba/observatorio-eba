declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    EBA_INTEGRATION_KEY?: string;
    EBA_INTEGRATION_SCHEDULER?: string;
  }
}
