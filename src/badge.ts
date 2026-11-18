/**
 * @file        src/badge.ts
 * @author      jambaa
 * @created     2026-11-18
 * @description Small DOM helpers: the status badge shown on each map pane, the
 *              full-pane notice used when a key is missing, and a time formatter.
 * SPDX-License-Identifier: MIT
 */
/** Overall health shown as the status dot and accent border. */
export type BadgeState = 'idle' | 'good' | 'warn' | 'bad'

export interface Badge {
  el: HTMLElement
  titleEl: HTMLElement
  setStats(html: string): void
  setState(state: BadgeState): void
}

export function createBadge(parent: HTMLElement, title: string): Badge {
  const el = document.createElement('div')
  el.className = 'badge'
  el.dataset.state = 'idle'
  const head = document.createElement('div')
  head.className = 'head'
  const dot = document.createElement('span')
  dot.className = 'dot'
  dot.setAttribute('aria-hidden', 'true')
  const titleEl = document.createElement('div')
  titleEl.className = 'title'
  titleEl.textContent = title
  head.append(dot, titleEl)
  const stats = document.createElement('div')
  stats.className = 'stats'
  el.append(head, stats)
  parent.append(el)
  return {
    el,
    titleEl,
    setStats: (html) => (stats.innerHTML = html),
    setState: (state) => (el.dataset.state = state),
  }
}

/** Renders label/value rows for the badge. Values are trusted HTML built by the app. */
export const statRows = (rows: [label: string, valueHtml: string][]) =>
  `<dl class="kv">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`

export function showNotice(parent: HTMLElement, text: string): HTMLElement {
  const el = document.createElement('div')
  el.className = 'notice'
  el.textContent = text
  parent.append(el)
  return el
}

export const hhmmss = (d = new Date()) => d.toLocaleTimeString('en-GB', { hour12: false })
