import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

export const runtime    = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { html, width, height } = await req.json();

  let browser;
  try {
    browser = await puppeteer.launch({
      args:            chromium.args,
      defaultViewport: { width, height },
      executablePath:  await chromium.executablePath(),
      headless:        true,
    });

    const page = await browser.newPage();
    await page.setViewport({ width, height });
    await page.setContent(html, { waitUntil: 'networkidle0' });

    // Wait for fonts to load
    await page.evaluateHandle('document.fonts.ready');

    const screenshot = await page.screenshot({
      type: 'png',
      clip: { x: 0, y: 0, width, height },
    });

    await browser.close();

    return new NextResponse(Buffer.from(screenshot), {
      headers: {
        'Content-Type':        'image/png',
        'Content-Disposition': 'attachment; filename="ad.png"',
      },
    });
  } catch (err) {
    console.error('Capture error:', err);
    if (browser) await browser.close().catch(() => {});
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
