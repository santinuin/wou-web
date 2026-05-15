import { test } from '@playwright/test';

test('source crudo — busca la sección ReelsBand en el HTML body', async ({ page }) => {
  const response = await page.goto('/');
  const html = await response!.text();
  
  const bodyStart = html.indexOf('<body');
  const bodyHtml = html.substring(bodyStart);
  
  const idx = bodyHtml.indexOf('class="ReelsBand"');
  if (idx === -1) {
    console.log('❌ <section class="ReelsBand"> NO está en el source HTML');
    // Buscar astro-island con ReelsCarousel
    const islandIdx = bodyHtml.indexOf('ReelsCarousel');
    console.log('ReelsCarousel en el source:', islandIdx !== -1 ? 'SÍ (idx=' + islandIdx + ')' : 'NO');
    // Ver qué hay donde debería estar
    const newsGridIdx = bodyHtml.indexOf('NewsGrid');
    if (newsGridIdx !== -1) {
      console.log('Fragmento alrededor de NewsGrid:', bodyHtml.substring(newsGridIdx, newsGridIdx + 500));
    }
  } else {
    console.log('✅ ReelsBand encontrado en source, fragmento:');
    console.log(bodyHtml.substring(idx, idx + 1500));
  }
});
