import React, {Suspense} from 'react';
import {act, fireEvent, render, renderHook, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';

import Home from '../src/pages/index';
import Header from '../src/components/Sections/Header';
import ContactForm from '../src/components/Sections/Contact/ContactForm';
import TimelineItem from '../src/components/Sections/Resume/TimelineItem';
import Base from '../src/components/Base';
import Section from '../src/components/Layout/Section';
import useDetectOutsideClick from '../src/hooks/useDetectOutsideClick';
import useInterval from '../src/hooks/useInterval';
import {useNavObserver} from '../src/hooks/useNavObserver';
import {SectionId} from '../src/data/data';

vi.mock('next/router', () => ({useRouter: () => ({asPath: '/'})}));
vi.mock('next/dynamic', () => ({default: (load: any) => React.lazy(load)}));

function observe() {
  let callback: IntersectionObserverCallback = () => {};
  const disconnect = vi.fn(), watch = vi.fn();
  vi.stubGlobal('IntersectionObserver', class {
    constructor(cb: IntersectionObserverCallback) { callback = cb; }
    observe = watch;
    disconnect = disconnect;
  });
  return {watch, disconnect, emit: (entries: any[]) => callback(entries, {} as IntersectionObserver)};
}

describe('preserved portfolio content and components', () => {
  it('renders the complete home page with every section and project link', async () => {
    observe();
    const {container} = render(<Suspense fallback={<p>Loading</p>}><Home /></Suspense>);
    await screen.findByText('Noel Novo', {selector: 'h1'});
    expect(container.querySelector('#about')).not.toBeNull();
    expect(container.querySelector('#resume')).not.toBeNull();
    expect(container.querySelector('#portfolio')).not.toBeNull();
    expect(container.querySelector('#contact')).not.toBeNull();
    expect(screen.getByText('Some of my work')).toBeTruthy();
    expect(screen.getAllByRole('link').some(link => link.getAttribute('href')?.includes('WalletTracker'))).toBe(true);
  });

  it('keeps resume detail toggling and section padding behavior', () => {
    const item = {title: 'Developer', location: 'Company', date: '2026', content: <p>Detailed responsibilities</p>};
    const {container} = render(<TimelineItem item={item} />);
    const detail = container.querySelector('#container') as HTMLElement;
    expect(detail.style.height).toBe('0px');
    fireEvent.click(container.querySelector('svg')!);
    expect(detail.style.height).toBe('100%');
    fireEvent.click(container.querySelector('svg')!);
    expect(detail.style.height).toBe('0px');
    const section = render(<Section sectionId={SectionId.About}><Base /></Section>);
    expect(section.container.querySelector('section')?.className).toContain('py-16');
  });

  it('updates active navigation on visibility and disconnects on cleanup', () => {
    const observer = observe();
    const {container, unmount} = render(<><Header /><section id="about" /><section id="resume" /></>);
    act(() => observer.emit([{target: container.querySelector('#about'), boundingClientRect: {y: 10}, isIntersecting: true, intersectionRatio: 1}]));
    expect(screen.getAllByText('about', {selector:'a'}).some(node => node.className.includes('text-fuchsia-700'))).toBe(true);
    act(() => observer.emit([{target: container.querySelector('#resume'), boundingClientRect: {y: 10}, isIntersecting: false, intersectionRatio: .5}]));
    expect(observer.watch).toHaveBeenCalled();
    unmount(); expect(observer.disconnect).toHaveBeenCalled();
  });
});

describe('contact form user outcomes', () => {
  it.each(['success', 'rejected', 'offline'])('handles %s without losing error input', async result => {
    const fetch = vi.fn(async () => {
      if (result === 'offline') throw new Error('offline');
      return {ok: result === 'success'};
    });
    vi.stubGlobal('fetch', fetch);
    const {container} = render(<ContactForm />);
    fireEvent.change(screen.getByPlaceholderText('Your name'), {target:{value:'Visitor'}});
    fireEvent.change(screen.getByPlaceholderText('Your email'), {target:{value:'visitor@example.com'}});
    fireEvent.change(screen.getByPlaceholderText('Message'), {target:{value:'A genuine test message'}});
    fireEvent.submit(container.querySelector('form')!);
    await screen.findByText(result === 'success' ? 'Thanks, your message has been sent.' : 'Something went wrong. Please try again.');
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({name:'Visitor',email:'visitor@example.com',message:'A genuine test message'});
    expect((screen.getByPlaceholderText('Your name') as HTMLInputElement).value).toBe(result === 'success' ? '' : 'Visitor');
  });
});

describe('event hooks', () => {
  it('ignores descendant/missing-ref events, reacts to outside and removes listeners', () => {
    const handler = vi.fn(), element = document.createElement('div'), child = document.createElement('span');
    element.append(child); document.body.append(element);
    const ref = {current: element};
    const {unmount} = renderHook(() => useDetectOutsideClick(ref, handler));
    fireEvent.mouseDown(child); expect(handler).not.toHaveBeenCalled();
    fireEvent.mouseDown(document.body); expect(handler).toHaveBeenCalledTimes(1);
    ref.current = null as any;
    fireEvent.touchStart(document.body); expect(handler).toHaveBeenCalledTimes(1);
    unmount(); fireEvent.mouseDown(document.body); expect(handler).toHaveBeenCalledTimes(1);
    element.remove();
  });

  it('supports paused and zero intervals, refreshes the callback and clears timers', () => {
    vi.useFakeTimers();
    try {
      const callback = vi.fn(), updated = vi.fn();
      const {rerender, unmount} = renderHook(({delay, fn}) => useInterval(fn, delay), {initialProps:{delay:null as number|null, fn:callback}});
      vi.advanceTimersByTime(10); expect(callback).not.toHaveBeenCalled();
      rerender({delay:10,fn:callback}); vi.advanceTimersByTime(10); expect(callback).toHaveBeenCalledTimes(1);
      rerender({delay:10,fn:updated}); vi.advanceTimersByTime(10); expect(updated).toHaveBeenCalledTimes(1);
      rerender({delay:0,fn:updated}); expect(vi.getTimerCount()).toBe(1);
      unmount(); expect(vi.getTimerCount()).toBe(0);
    } finally {vi.useRealTimers();}
  });

  it('handles a missing header without reporting a visible section', () => {
    const observer = observe(), handler = vi.fn();
    const element = document.createElement('section'); element.id = 'about'; document.body.append(element);
    const {unmount} = renderHook(() => useNavObserver('#about', handler));
    act(() => observer.emit([{target:element, boundingClientRect:{y:0}, isIntersecting:true, intersectionRatio:1}]));
    expect(handler).not.toHaveBeenCalled(); unmount(); element.remove();
  });
});

const icons = import.meta.glob('../src/components/Icon/*Icon.tsx', {eager:true}) as Record<string,{default:React.ElementType}>;
it.each(Object.entries(icons))('renders %s with a stable SVG viewBox and paths', (name, module) => {
  const Icon = module.default;
  const props = name.endsWith('/CustomCarIcon.tsx') ? {title: 'Technology', titleId: 'technology-icon'} : {};
  const {container} = render(<Icon {...props}><path d="M0 0h1v1z" /></Icon>);
  expect(container.querySelector('svg')?.getAttribute('viewBox')).toBeTruthy();
  expect(container.querySelector('path')).not.toBeNull();
  if (name.endsWith('/CustomCarIcon.tsx')) expect(container.querySelector('title')?.textContent).toBe('Technology');
});
