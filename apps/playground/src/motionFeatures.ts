/**
 * Lazily-loaded Framer Motion feature bundle.
 *
 * `App.tsx` mounts `<LazyMotion features={() => import('./motionFeatures')}>`
 * so the heavy animation / gesture / layout feature code (`domMax`) is split
 * into its own async chunk and fetched AFTER first paint instead of riding the
 * first-paint critical path. Components render with the lightweight `m` factory;
 * until this bundle resolves they show their final (static) frame, then animate.
 *
 * `domMax` (not `domAnimation`) because the sidebar's active-nav indicator uses
 * shared-layout animation (`layout` / `layoutId`), which only ships in the max
 * feature set.
 */
import { domMax } from 'framer-motion';

export default domMax;
