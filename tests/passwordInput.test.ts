import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PasswordInput } from '../src/components/ui/PasswordInput';

test('password input starts hidden with an accessible non-submitting visibility toggle', () => {
  const markup = renderToStaticMarkup(createElement(PasswordInput, {
    'aria-label': 'Password',
    autoComplete: 'current-password',
    value: '',
    onChange: () => {},
  }));

  assert.match(markup, /type="password"/);
  assert.match(markup, /aria-label="Show password"/);
  assert.match(markup, /aria-pressed="false"/);
  assert.match(markup, /type="button"/);
  assert.match(markup, /autoComplete="current-password"/);
});
