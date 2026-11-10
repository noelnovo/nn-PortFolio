import React from 'react';
import {afterEach, vi} from 'vitest';
import {cleanup} from '@testing-library/react';

Object.assign(globalThis, {React});
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {value: vi.fn(() => ({matches: false, addEventListener() {}, removeEventListener() {}})), writable: true, configurable: true});
}
vi.mock('next/image', () => ({default: ({src, fill, priority, ...props}: any) => React.createElement('img', {...props, src: typeof src === 'string' ? src : src.src})}));
vi.mock('../src/images/header-background.webp', () => ({default: {src: '/header.webp', width: 100, height: 100}}));
vi.mock('../src/images/portfolio/profile.jpg', () => ({default: {src: '/profile.jpg', width: 100, height: 100}}));
vi.mock('next/head', () => ({default: ({children}: any) => React.createElement(React.Fragment, {}, children)}));
afterEach(() => {cleanup(); vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals();});
