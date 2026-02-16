var p = { exports: {} },
  t = {} /**
 * @license React
 * react-jsx-runtime.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var g
function j() {
  if (g) return t
  g = 1
  var u = Symbol.for('react.transitional.element'),
    i = Symbol.for('react.fragment')
  function a(c, e, r) {
    var m = null
    if (
      (r !== void 0 && (m = '' + r),
      e.key !== void 0 && (m = '' + e.key),
      'key' in e)
    ) {
      r = {}
      for (var d in e) d !== 'key' && (r[d] = e[d])
    } else r = e
    return (
      (e = r.ref),
      { $$typeof: u, type: c, key: m, ref: e !== void 0 ? e : null, props: r }
    )
  }
  return (t.Fragment = i), (t.jsx = a), (t.jsxs = a), t
}
var y
function C() {
  return y || ((y = 1), (p.exports = j())), p.exports
}
var O = C()
const q = ({
  primary: u = !1,
  size: i = 'medium',
  backgroundColor: a,
  label: c,
  ...e
}) => {
  const r = u ? 'storybook-button--primary' : 'storybook-button--secondary'
  return O.jsx('button', {
    type: 'button',
    className: ['storybook-button', `storybook-button--${i}`, r].join(' '),
    style: { backgroundColor: a },
    ...e,
    children: c,
  })
}
q.__docgenInfo = {
  description: 'Primary UI component for user interaction',
  methods: [],
  displayName: 'Button',
  props: {
    primary: {
      required: !1,
      tsType: { name: 'boolean' },
      description: 'Is this the principal call to action on the page?',
      defaultValue: { value: 'false', computed: !1 },
    },
    backgroundColor: {
      required: !1,
      tsType: { name: 'string' },
      description: 'What background color to use',
    },
    size: {
      required: !1,
      tsType: {
        name: 'union',
        raw: "'small' | 'medium' | 'large'",
        elements: [
          { name: 'literal', value: "'small'" },
          { name: 'literal', value: "'medium'" },
          { name: 'literal', value: "'large'" },
        ],
      },
      description: 'How large should the button be?',
      defaultValue: { value: "'medium'", computed: !1 },
    },
    label: {
      required: !0,
      tsType: { name: 'string' },
      description: 'Button contents',
    },
    onClick: {
      required: !1,
      tsType: {
        name: 'signature',
        type: 'function',
        raw: '() => void',
        signature: { arguments: [], return: { name: 'void' } },
      },
      description: 'Optional click handler',
    },
  },
}
const { fn: P } = __STORYBOOK_MODULE_TEST__,
  z = {
    title: 'Example/Button',
    component: q,
    parameters: { layout: 'centered' },
    tags: ['autodocs'],
    argTypes: { backgroundColor: { control: 'color' } },
    args: { onClick: P() },
  },
  o = { args: { primary: !0, label: 'Button' } },
  s = { args: { label: 'Button' } },
  n = { args: { size: 'large', label: 'Button' } },
  l = { args: { size: 'small', label: 'Button' } }
var b, f, x
o.parameters = {
  ...o.parameters,
  docs: {
    ...((b = o.parameters) == null ? void 0 : b.docs),
    source: {
      originalSource: `{
  args: {
    primary: true,
    label: 'Button'
  }
}`,
      ...((x = (f = o.parameters) == null ? void 0 : f.docs) == null
        ? void 0
        : x.source),
    },
  },
}
var v, _, k
s.parameters = {
  ...s.parameters,
  docs: {
    ...((v = s.parameters) == null ? void 0 : v.docs),
    source: {
      originalSource: `{
  args: {
    label: 'Button'
  }
}`,
      ...((k = (_ = s.parameters) == null ? void 0 : _.docs) == null
        ? void 0
        : k.source),
    },
  },
}
var R, T, B
n.parameters = {
  ...n.parameters,
  docs: {
    ...((R = n.parameters) == null ? void 0 : R.docs),
    source: {
      originalSource: `{
  args: {
    size: 'large',
    label: 'Button'
  }
}`,
      ...((B = (T = n.parameters) == null ? void 0 : T.docs) == null
        ? void 0
        : B.source),
    },
  },
}
var E, S, h
l.parameters = {
  ...l.parameters,
  docs: {
    ...((E = l.parameters) == null ? void 0 : E.docs),
    source: {
      originalSource: `{
  args: {
    size: 'small',
    label: 'Button'
  }
}`,
      ...((h = (S = l.parameters) == null ? void 0 : S.docs) == null
        ? void 0
        : h.source),
    },
  },
}
const J = ['Primary', 'Secondary', 'Large', 'Small']
export {
  n as Large,
  o as Primary,
  s as Secondary,
  l as Small,
  J as __namedExportsOrder,
  z as default,
}
