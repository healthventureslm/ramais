// Design system da Health Ventures (tokens, sem o @import do Google Fonts: as fontes vão empacotadas).
import '@healthventureslm/design-system/tokens/colors.css';
import '@healthventureslm/design-system/tokens/typography.css';
import '@healthventureslm/design-system/tokens/spacing.css';
import '@healthventureslm/design-system/tokens/elevation.css';
import '@healthventureslm/design-system/tokens/motion.css';
import '@healthventureslm/design-system/tokens/mobile.css';
import '@healthventureslm/design-system/tokens/base.css';
import '@healthventureslm/design-system/tokens/theme-dark.css';
import '@fontsource/schibsted-grotesk/500.css';
import '@fontsource/schibsted-grotesk/600.css';
import '@fontsource/schibsted-grotesk/700.css';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/400-italic.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-sans/700.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
// A marca do Ramais por cima das rampas do DS, e a cola de layout das telas.
import './estilo/tema-ramais.css';
import './estilo/layout.css';
import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { aparenciaSalva, aplicarAparencia } from './aparencia';

// Antes de pintar: quem escolheu claro ou escuro não vê o outro tema piscar.
aplicarAparencia(aparenciaSalva());

const raiz = createRoot(document.getElementById('raiz')!);
const montar = (n: ReactNode) => raiz.render(<StrictMode>{n}</StrictMode>);

// /q/<código>: o QR do quarto abre o chat do hóspede, sem login. O resto é o app da equipe.
// Cada um baixa só o seu código.
const qr = /^\/q\/([A-Za-z0-9_-]{4,40})\/?$/.exec(window.location.pathname);
if (qr) void import('./telas/ChatQuarto').then(({ ChatQuarto }) => montar(<ChatQuarto codigo={qr[1]!} />));
else void import('./App').then(({ App }) => montar(<App />));
