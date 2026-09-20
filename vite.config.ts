import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import { defineConfig } from 'vite';

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  '00000000-0000-4000-8000-000000000000';

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
          database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
        }]
      : [],
    r2_buckets: r2
      ? [{ binding: r2, bucket_name: independentCloudflareBuild ? 'apx-ride-staging-documents' : 'site-creator-r2' }]
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
          ? { ...localBindingConfig, name: 'apx-ride-portal-staging' }
          : localBindingConfig,
      }),
    ],
  };
});
