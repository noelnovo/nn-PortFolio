import React from 'react';
import {render, screen} from '@testing-library/react';
import {renderToStaticMarkup} from 'react-dom/server';
import {expect, it, vi} from 'vitest';
import MyApp from '../src/pages/_app';
import Document from '../src/pages/_document';

vi.mock('next/document', () => ({
  Html: ({children, ...props}: any) => <html {...props}>{children}</html>,
  Head: ({children}: any) => <head>{children}</head>,
  Main: () => <main id="application-root" />,
  NextScript: () => <script id="next-scripts" />,
}));

it('passes page props through the application wrapper', () => {
  render(<MyApp Component={(({message}: any) => <p>{message}</p>) as any} pageProps={{message:'Page content'}} router={{} as any} />);
  expect(screen.getByText('Page content')).toBeTruthy();
});

it('keeps the document language, encoding, no-translate directive and Next bootstrap slots', () => {
  const html = renderToStaticMarkup(<Document />);
  expect(html).toContain('lang="en"');
  expect(html).toContain('charSet="utf-8"');
  expect(html).toContain('content="notranslate"');
  expect(html).toContain('application-root'); expect(html).toContain('next-scripts');
});

it('detects DOM, pointer and Apple capabilities rather than assuming mobile', async () => {
  vi.resetModules();
  Object.defineProperty(window, 'matchMedia', {value:vi.fn(() => ({matches:true})), configurable:true});
  vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
  const config = await import('../src/config');
  expect(config.isBrowser).toBe(true); expect(config.canUseDOM).toBe(true);
  expect(config.isMobile).toBe(true); expect(config.isApple).toBe(true);
});
