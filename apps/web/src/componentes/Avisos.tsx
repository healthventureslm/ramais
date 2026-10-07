import { ToastProvider, toast } from '@healthventureslm/design-system';
import { useViewport } from '@healthventureslm/design-system';

/** Avisos passageiros pelo Toast do DS. `avisar()` continua sendo a porta de entrada das telas. */
export function avisar(texto: string, tipo: 'info' | 'success' | 'error' | 'warning' = 'info') {
  toast({ title: texto, variant: tipo });
}

export function Avisos() {
  const { isMobile } = useViewport();
  return <ToastProvider position={isMobile ? 'top-center' : 'bottom-left'} duration={5000} max={3} />;
}
