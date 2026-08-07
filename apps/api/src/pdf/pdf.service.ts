import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import * as puppeteer from 'puppeteer';

export function escapeHtml(unsafe: string | null | undefined): string {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

@Injectable()
export class PdfService implements OnModuleDestroy {
  private readonly logger = new Logger(PdfService.name);
  private browser: puppeteer.Browser | null = null;

  private async getBrowser(): Promise<puppeteer.Browser> {
    if (!this.browser || !this.browser.connected) {
      this.logger.log('Launching Puppeteer Headless Chromium instance...');
      this.browser = await puppeteer.launch({
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote',
        ],
      });
    }
    return this.browser;
  }

  async onModuleDestroy() {
    if (this.browser) {
      this.logger.log('Closing Puppeteer browser instance...');
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
  }

  /**
   * Renders HTML string to PDF Buffer using Puppeteer Headless Chromium.
   */
  async generatePdfFromHtml(html: string): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      // Disable external network requests for template security
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const url = req.url();
        if (url.startsWith('data:') || url.startsWith('file:')) {
          req.continue();
        } else {
          // Block external network requests during PDF rendering
          req.abort();
        }
      });

      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdfUint8Array = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
      });

      return Buffer.from(pdfUint8Array);
    } catch (err) {
      this.logger.error(`Puppeteer PDF rendering error: ${err.message}`);
      throw err;
    } finally {
      await page.close().catch(() => {});
    }
  }
}
