import fs from 'fs';
import path from 'path';

function runPWAAndroidAudit() {
  console.log("=== INICIANDO AUDITORIA TÉCNICA PWA ANDROID-FIRST & PWABUILDER ===");

  const root = process.cwd();
  const publicDir = path.join(root, 'public');

  // 1. Verificação dos Ícones PWA e Assets
  console.log("\n[1] Verificando Ícones e Assets PWA...");
  const requiredAssets = [
    'pwa-192x192.png',
    'pwa-512x512.png',
    'pwa-maskable-512x512.png',
    'apple-touch-icon.png',
    'icon.svg'
  ];

  for (const asset of requiredAssets) {
    const assetPath = path.join(publicDir, asset);
    if (!fs.existsSync(assetPath)) {
      throw new Error(`Asset PWA obrigatório ausente: public/${asset}`);
    }
    const stat = fs.statSync(assetPath);
    if (stat.size === 0) {
      throw new Error(`Asset PWA vazio (0 bytes): public/${asset}`);
    }
    console.log(`  ✓ public/${asset} (${stat.size} bytes) - OK`);
  }

  // 2. Verificação do index.html e Meta Tags Mobile
  console.log("\n[2] Verificando Meta Tags e Viewport no index.html...");
  const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf-8');

  const requiredMetaStrings = [
    'viewport-fit=cover',
    'theme-color',
    '#020617',
    'mobile-web-app-capable',
    'apple-mobile-web-app-capable',
    'apple-mobile-web-app-status-bar-style',
    'color-scheme',
    'apple-touch-icon'
  ];

  for (const meta of requiredMetaStrings) {
    if (!indexHtml.includes(meta)) {
      throw new Error(`index.html ausente da meta tag ou diretiva obrigatória: ${meta}`);
    }
    console.log(`  ✓ Meta tag contendo '${meta}' encontrada no index.html`);
  }

  // 3. Verificação do vite.config.ts e VitePWA Plugin
  console.log("\n[3] Verificando Configuração do Plugin VitePWA...");
  const viteConfig = fs.readFileSync(path.join(root, 'vite.config.ts'), 'utf-8');

  const requiredViteConfigStrings = [
    'VitePWA',
    'registerType: \'autoUpdate\'',
    'display: \'standalone\'',
    'theme_color: \'#020617\'',
    'background_color: \'#020617\'',
    'purpose: \'maskable\'',
    'devOptions'
  ];

  for (const str of requiredViteConfigStrings) {
    if (!viteConfig.includes(str)) {
      throw new Error(`vite.config.ts ausente da configuração PWA: ${str}`);
    }
    console.log(`  ✓ Configuração '${str}' validada no vite.config.ts`);
  }

  // 4. Verificação dos Hooks e Componentes Mobile
  console.log("\n[4] Verificando Componentes e Hooks Android-First...");
  const componentPaths = [
    'src/hooks/usePWAInstall.ts',
    'src/hooks/useOnlineStatus.ts',
    'src/hooks/useAndroidBack.ts',
    'src/components/PWAInstallButton.tsx',
    'src/components/OfflineIndicator.tsx',
    'src/components/BottomNavigation.tsx',
    'src/components/BottomSheet.tsx'
  ];

  for (const comp of componentPaths) {
    const fullPath = path.join(root, comp);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Componente/Hook mobile obrigatório ausente: ${comp}`);
    }
    console.log(`  ✓ ${comp} validado`);
  }

  console.log("\n==================================================================");
  console.log("SUCCESS: AUDITORIA PWA ANDROID-FIRST & PWABUILDER CONCLUÍDA 100%!");
  console.log("==================================================================");
}

runPWAAndroidAudit();
