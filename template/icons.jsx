// Bridge lucide UMD -> a single <Icon name="..." size={} className=""/> component.
// lucide UMD exposes `window.lucide.icons` keyed by PascalCase name, each value being
// a node tree like ["svg", attrs, [["path", {...}], ...]].
// We render that tree as React elements.

const LucideTree = (window.lucide && window.lucide.icons) || {};

function renderTree(node, key) {
  if (!Array.isArray(node)) return null;
  const [tag, attrs, children] = node;
  const safeAttrs = { ...(attrs || {}), key };
  // Convert HTML attrs that React renames
  if (safeAttrs['stroke-width'] !== undefined) {
    safeAttrs.strokeWidth = safeAttrs['stroke-width'];
    delete safeAttrs['stroke-width'];
  }
  if (safeAttrs['stroke-linecap'] !== undefined) {
    safeAttrs.strokeLinecap = safeAttrs['stroke-linecap'];
    delete safeAttrs['stroke-linecap'];
  }
  if (safeAttrs['stroke-linejoin'] !== undefined) {
    safeAttrs.strokeLinejoin = safeAttrs['stroke-linejoin'];
    delete safeAttrs['stroke-linejoin'];
  }
  const kids = (children || []).map((c, i) => renderTree(c, `${key}-${i}`));
  return React.createElement(tag, safeAttrs, ...kids);
}

function Icon({ name, size = 16, className = '', strokeWidth = 1.75, ...rest }) {
  const tree = LucideTree[name];
  if (!tree) {
    // Fallback: small dot so missing names are visible but not loud
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...rest}>
        <circle cx="12" cy="12" r="2" fill="currentColor" />
      </svg>
    );
  }
  const [, baseAttrs, children] = tree;
  const attrs = {
    ...baseAttrs,
    width: size,
    height: size,
    strokeWidth,
    className,
    ...rest,
  };
  // Remove kebab-case props that React won't like
  delete attrs['stroke-width'];
  delete attrs['stroke-linecap'];
  delete attrs['stroke-linejoin'];
  attrs.strokeLinecap = 'round';
  attrs.strokeLinejoin = 'round';
  const kids = (children || []).map((c, i) => renderTree(c, `i-${i}`));
  return React.createElement('svg', attrs, ...kids);
}

window.Icon = Icon;
