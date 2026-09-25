import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import { defineConfig } from 'vite';

const SITE_CREATOR_DATABASE_ID =
  '00000000-0000-4000-8000-000000000000';
const STAGING_DATABASE_ID = '06ebd43e-b555-4a7b-b763-e4f3a07412ba';
const STAGING_ACCESS_TEAM_DOMAIN = 'apxride-portal.cloudflareaccess.com';
const STAGING_ACCESS_AUDIENCE =
  '181dd9cad29cea775fe99891906e45fa8e5f10b8d93abd52e70c08fd8de23fc7';

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === 'seatbelt';

export default defineConfig(async ({ mode }) => {
  // Keep the existing Sites build unchanged while we prepare an independent
  // Cloudflare build. No production deployment is configured by this switch.
  const independentCloudflareBuild = mode === 'cloudflare';
  const sitesPlugins = independentCloudflareBuild
    ? []
    : [(await import('@openai/sites-vite-plugin')).sites()];
  const { d1, r2 } = independentCloudflareBuild
    ? { d1: 'DB', r2: 'BUCKET' }
    : (await import('./.openai/hosting.json')).default;
  const localBindingConfig = {
    main: 'vinext/server/fetch-handler',
    compatibility_flags: ['nodejs_compat'],
    d1_databases: d1
      ? [{
          binding: d1,
          database_name: independentCloudflareBuild ? 'apx-ride-staging' : 'site-creator-d1',
          database_id: independentCloudflareBuild
            ? STAGING_DATABASE_ID
            : SITE_CREATOR_DATABASE_ID,
        }]
      : [],
    r2_buckets: r2
      ? [{
          binding: r2,
          bucket_name: independentCloudflareBuild
            ? 'apx-ride-staging-documents'
            : 'site-creator-r2',
          ...(independentCloudflareBuild ? { jurisdiction: 'eu' } : {}),
        }]
      : [],
  };
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= 'false';
  process.env.WRANGLER_LOG_PATH ??= '.wrangler/logs';
  process.env.MINIFLARE_REGISTRY_PATH ??= '.wrangler/registry';

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import('@cloudflare/vite-plugin');

  return {
    define: { __APX_CLOUDFLARE_BUILD__: JSON.stringify(independentCloudflareBuild) },
    css: { postcss: { plugins: [tailwindcss()] } },
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    plugins: [
      vinext(),
      ...sitesPlugins,
      cloudflare({
        viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
        config: independentCloudflareBuild
          ? {
              ...localBindingConfig,
              name: 'apx-ride-portal-staging',
              workers_dev: false,
              preview_urls: false,
              routes: [
                {
                  pattern: 'portal-staging.apxride.com',
                  custom_domain: true,
                },
              ],
              vars: {
                APX_AUTH_MODE: 'cloudflare',
                CF_ACCESS_TEAM_DOMAIN: STAGING_ACCESS_TEAM_DOMAIN,
                CF_ACCESS_AUD: STAGING_ACCESS_AUDIENCE,
              },
            }
          : localBindingConfig,
      }),
    ],
  };
});
