import { DpiaListClient } from '@/components/dpia/DpiaListClient';

/**
 * F57. The DPIA module's own route.
 *
 * Until now the entire DPIA capability was one tab reachable only by opening a
 * processing activity — so a DPIA covering four activities had to be reached
 * through whichever of them happened to be linked, and "which of our assessments
 * are unsigned?" was a question the product could not answer about itself.
 */
export default function DpiaPage() {
  return <DpiaListClient />;
}
