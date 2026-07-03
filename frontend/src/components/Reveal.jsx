import { useReveal } from '../hooks/useReveal'

/**
 * Wraps children in a div (or `as` element) that fades/slides into view
 * the first time it scrolls into the viewport. Pass `delay` (ms) to stagger
 * a group of siblings.
 */
export default function Reveal({ as: Tag = 'div', delay = 0, className = '', children, ...props }) {
  const [ref, visible] = useReveal()
  return (
    <Tag
      ref={ref}
      className={`reveal${visible ? ' reveal--visible' : ''}${className ? ` ${className}` : ''}`}
      style={{ transitionDelay: visible ? `${delay}ms` : '0ms' }}
      {...props}
    >
      {children}
    </Tag>
  )
}
