import { Banner, Button, Input } from '@healthventureslm/design-system';
import type { Sessao } from '@ramais/contracts';
import { useState } from 'react';
import { api } from '../api';

/** O quadro de chaves da recepção: alguns quartos com pedido aberto, a lâmpada acesa. */
const QUADRO = ['101', '102', '103', '104', '201', '202', '203', '204', '301', '302', '303', '304'];
const ACESOS = new Set(['102', '203', '302']);

export function Login({ aoEntrar }: { aoEntrar: (s: Sessao) => void }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  return (
    <div className="entrada">
      <section className="entrada__marca">
        <div className="entrada__nome">Ramais</div>
        <div className="entrada__quadro" aria-hidden>
          {QUADRO.map((q) => (
            <span key={q} className={ACESOS.has(q) ? 'aceso' : ''}>
              {q}
            </span>
          ))}
        </div>
        <p className="entrada__frase">O hóspede escreve no WhatsApp, e a mensagem chega traduzida para quem está no turno do setor certo.</p>
      </section>
      <div className="entrada__form">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setErro('');
            setEnviando(true);
            try {
              aoEntrar(await api.login(email, senha));
            } catch (e) {
              setErro((e as Error).message);
            } finally {
              setEnviando(false);
            }
          }}
        >
          <div>
            <h1 style={{ margin: 0, font: 'var(--weight-semibold) var(--text-2xl)/1.15 var(--font-display)', color: 'var(--text-strong)' }}>Entrar</h1>
            <p className="mudo" style={{ margin: 'var(--space-2) 0 0' }}>
              Use o e-mail e a senha que o administrador do hotel passou para você.
            </p>
          </div>
          <Input label="E-mail" type="email" autoComplete="username" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input label="Senha" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
          {erro && <Banner variant="danger" title={erro} />}
          <Button type="submit" size="lg" block loading={enviando}>
            Entrar
          </Button>
          <p className="pequeno mudo" style={{ margin: 0 }}>
            No celular do setor, entre pelo app com o seu PIN.
          </p>
        </form>
      </div>
    </div>
  );
}
