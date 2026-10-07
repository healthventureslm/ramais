import { Banner, Button, Dialog, Input } from '@healthventureslm/design-system';
import { useState } from 'react';
import { api } from '../api';
import { avisar } from './Avisos';

/**
 * Troca de senha. No primeiro acesso (senha temporária) é obrigatória: não fecha
 * até trocar, só dá para sair.
 */
export function TrocarSenha({
  nome,
  email,
  obrigatoria,
  aoTrocar,
  aoFechar,
  aoSair,
}: {
  nome: string;
  email: string;
  obrigatoria: boolean;
  aoTrocar: () => void;
  aoFechar: () => void;
  aoSair: () => void;
}) {
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [confirma, setConfirma] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const curta = nova.length > 0 && nova.length < 8;
  const diferente = confirma.length > 0 && confirma !== nova;
  const pronta = atual && nova.length >= 8 && nova === confirma;

  async function salvar() {
    if (!pronta) return;
    setSalvando(true);
    setErro(null);
    try {
      await api.trocarSenha(atual, nova);
      avisar('Senha trocada.', 'success');
      aoTrocar();
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog
      open
      size="sm"
      onClose={obrigatoria ? undefined : aoFechar}
      title={obrigatoria ? `Bem-vindo(a), ${nome.split(' ')[0]}` : 'Minha conta'}
      description={obrigatoria ? 'Você entrou com uma senha temporária. Crie a sua para continuar.' : `${nome} · ${email}`}
      footer={
        <>
          <Button variant="ghost" onClick={obrigatoria ? aoSair : aoFechar}>
            {obrigatoria ? 'Sair' : 'Fechar'}
          </Button>
          <Button onClick={salvar} loading={salvando} disabled={!pronta}>
            Trocar senha
          </Button>
        </>
      }
    >
      <form
        className="pilha pilha--larga"
        onSubmit={(e) => {
          e.preventDefault();
          void salvar();
        }}
      >
        <Input
          label={obrigatoria ? 'Senha temporária' : 'Senha atual'}
          type="password"
          autoComplete="current-password"
          value={atual}
          onChange={(e) => setAtual(e.target.value)}
          autoFocus
          required
        />
        <Input
          label="Nova senha"
          type="password"
          autoComplete="new-password"
          value={nova}
          onChange={(e) => setNova(e.target.value)}
          hint="Pelo menos 8 caracteres."
          error={curta ? 'A nova senha precisa de pelo menos 8 caracteres.' : undefined}
          required
        />
        <Input
          label="Repita a nova senha"
          type="password"
          autoComplete="new-password"
          value={confirma}
          onChange={(e) => setConfirma(e.target.value)}
          error={diferente ? 'As duas senhas não são iguais.' : undefined}
          required
        />
        {erro && <Banner variant="danger" title={erro} />}
        {!obrigatoria && <p className="pequeno mudo" style={{ margin: 0 }}>Esqueceu a senha ou o PIN do celular? Peça ao administrador para gerar outro.</p>}
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
