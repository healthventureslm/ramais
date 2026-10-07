import {
  Avatar,
  Badge,
  Banner,
  Button,
  Card,
  CardHeader,
  Checkbox,
  RadioGroup,
  ChipGroup,
  CopyField,
  Dialog,
  Drawer,
  IconButton,
  Input,
  Menu,
  Select,
  StatusDot,
  Table,
  Tag,
  useConfirm,
} from '@healthventureslm/design-system';
import { Copy, KeyRound, MoreHorizontal, Plus, Smartphone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, type Credenciais, type Lotacao, type PessoaEquipe, type Setor } from '../../api';
import { avisar } from '../../componentes/Avisos';

const IDIOMAS = [
  { id: 'pt', nome: 'Português' },
  { id: 'es', nome: 'Espanhol' },
  { id: 'en', nome: 'Inglês' },
];

const RECEBE = { sempre: 'Recebe pedidos', ultimo_recurso: 'Só se ninguém mais', nunca: 'Não recebe' } as const;

interface Rascunho {
  id: string | null;
  nome: string;
  email: string;
  idiomas: string[];
  admin: boolean;
  gerente: boolean;
  ativo: boolean;
  lotacoes: Lotacao[];
}

const vazio = (): Rascunho => ({ id: null, nome: '', email: '', idiomas: ['pt'], admin: false, gerente: false, ativo: true, lotacoes: [] });

/** Quem trabalha na unidade, em quais setores, e o acesso de cada um. */
export function Equipe({ unidadeId, euId }: { unidadeId: string; euId: string }) {
  const [pessoas, setPessoas] = useState<PessoaEquipe[] | null>(null);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [editando, setEditando] = useState<Rascunho | null>(null);
  const [credenciais, setCredenciais] = useState<{ nome: string; email: string; c: Credenciais } | null>(null);
  const [verInativos, setVerInativos] = useState(false);
  const [confirmar, confirmacao] = useConfirm();

  const carregar = () => api.admin.pessoas(unidadeId).then(setPessoas).catch((e) => avisar(e.message, 'error'));
  useEffect(() => {
    void carregar();
    api.setores(unidadeId).then(setSetores).catch(() => undefined);
  }, [unidadeId]);

  const nomeSetor = (id: string) => setores.find((s) => s.id === id)?.nome ?? '—';
  const lista = (pessoas ?? []).filter((p) => verInativos || p.ativo);
  const inativos = (pessoas ?? []).filter((p) => !p.ativo).length;
  const ativas = (pessoas ?? []).length - inativos;

  async function redefinir(p: PessoaEquipe, o: { senha: boolean; pin: boolean }) {
    const qual = o.senha && o.pin ? 'uma senha temporária e um PIN novos' : o.senha ? 'uma senha temporária nova' : 'um PIN novo';
    const ok = await confirmar({
      title: `Gerar ${qual} para ${p.nome}?`,
      description: 'O acesso atual deixa de valer.',
      confirmLabel: 'Gerar',
      danger: true,
    });
    if (!ok) return;
    try {
      setCredenciais({ nome: p.nome, email: p.email, c: await api.admin.redefinir(p.id, o) });
      void carregar();
    } catch (e) {
      avisar((e as Error).message, 'error');
    }
  }

  const editar = (p: PessoaEquipe) =>
    setEditando({ id: p.id, nome: p.nome, email: p.email, idiomas: p.idiomas, admin: p.admin, gerente: p.gerente, ativo: p.ativo, lotacoes: p.lotacoes });

  return (
    <>
      <div className="admin-barra">
        <p className="mudo" style={{ margin: 0, flex: '1 1 320px' }}>
          Cada pessoa entra com e-mail e senha no computador, ou com PIN no celular do setor. Quem é lotado num setor recebe os pedidos dele quando
          está no turno.
        </p>
        {inativos > 0 && <Checkbox label={`Mostrar desativadas (${inativos})`} checked={verInativos} onChange={(e) => setVerInativos(e.target.checked)} />}
        <Button iconLeft={<Plus />} onClick={() => setEditando(vazio())}>
          Nova pessoa
        </Button>
      </div>

      <Card>
        <CardHeader title="Pessoas" subtitle={pessoas ? `${ativas} ativas${inativos ? ` · ${inativos} desativadas` : ''}` : undefined} />
        <Table<PessoaEquipe>
          data={lista}
          emptyText={pessoas === null ? 'Carregando…' : 'Ninguém cadastrado ainda.'}
          columns={[
            {
              key: 'pessoa',
              header: 'Pessoa',
              primary: true,
              render: (p: PessoaEquipe) => (
                <div className="linha" style={{ flexWrap: 'nowrap', gap: 'var(--space-3)' }}>
                  <Avatar name={p.nome} size="sm" />
                  <div style={{ minWidth: 0 }}>
                    <div className="linha">
                      <strong style={{ color: p.ativo ? 'var(--text-strong)' : 'var(--text-muted)' }}>{p.nome}</strong>
                      {p.admin ? <Badge variant="brand">Admin</Badge> : p.gerente && <Badge variant="info">Gerente</Badge>}
                    </div>
                    <div className="pequeno mudo">{p.email}</div>
                  </div>
                </div>
              ),
            } as never,
            {
              key: 'setores',
              header: 'Setores',
              secondary: true,
              render: (p: PessoaEquipe) =>
                p.lotacoes.length === 0 ? (
                  <span className="pequeno mudo">Nenhum</span>
                ) : (
                  <div className="linha">
                    {p.lotacoes.map((l) => (
                      <Tag key={l.setorId} title={RECEBE[l.recebe]}>
                        {nomeSetor(l.setorId)}
                        {l.papel === 'supervisor' ? ' · supervisor' : ''}
                        {l.recebe !== 'sempre' ? ' · ' + (l.recebe === 'nunca' ? 'não recebe' : 'reserva') : ''}
                      </Tag>
                    ))}
                  </div>
                ),
            } as never,
            { key: 'idiomas', header: 'Idiomas', mono: true, render: (p) => p.idiomas.map((i) => i.toUpperCase()).join(' · ') },
            {
              key: 'situacao',
              header: 'Situação',
              render: (p) => (
                <div className="linha">
                  {!p.ativo && <StatusDot status="neutral">Desativada</StatusDot>}
                  {p.ativo && p.emTurno && <StatusDot status="positive">No turno</StatusDot>}
                  {p.ativo && p.trocarSenha && (
                    <Badge variant="warning" title="Ainda não entrou com a senha temporária">
                      1º acesso pendente
                    </Badge>
                  )}
                  {p.pinBloqueado && <Badge variant="danger">PIN bloqueado</Badge>}
                  {p.ativo && !p.temPin && <Badge variant="neutral">Sem PIN</Badge>}
                  {p.ativo && !p.emTurno && !p.trocarSenha && !p.pinBloqueado && p.temPin && <span className="pequeno mudo">Ativa</span>}
                </div>
              ),
            },
            {
              key: 'acoes',
              header: '',
              align: 'right',
              render: (p) => (
                <div className="linha" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                  <Button size="sm" variant="secondary" onClick={() => editar(p)}>
                    Editar
                  </Button>
                  {p.ativo && (
                    <Menu
                      sheetTitle={p.nome}
                      trigger={
                        <IconButton label={`Mais ações para ${p.nome}`} size="sm" variant="ghost">
                          <MoreHorizontal />
                        </IconButton>
                      }
                      items={[
                        { id: 'senha', label: 'Nova senha temporária', icon: <KeyRound />, onSelect: () => void redefinir(p, { senha: true, pin: false }) },
                        {
                          id: 'pin',
                          label: p.pinBloqueado ? 'Desbloquear PIN' : 'Novo PIN',
                          icon: <Smartphone />,
                          onSelect: () => void redefinir(p, { senha: false, pin: true }),
                        },
                      ]}
                    />
                  )}
                </div>
              ),
            },
          ]}
        />
      </Card>

      {editando && (
        <FormPessoa
          key={editando.id ?? 'nova'}
          r={editando}
          setores={setores}
          unidadeId={unidadeId}
          eu={editando.id === euId}
          aoFechar={() => setEditando(null)}
          aoSalvar={(c) => {
            setEditando(null);
            if (c) setCredenciais(c);
            void carregar();
          }}
        />
      )}
      {credenciais && <MostrarCredenciais {...credenciais} aoFechar={() => setCredenciais(null)} />}
      {confirmacao}
    </>
  );
}

function FormPessoa({
  r: inicial,
  setores,
  unidadeId,
  eu,
  aoFechar,
  aoSalvar,
}: {
  r: Rascunho;
  setores: Setor[];
  unidadeId: string;
  eu: boolean;
  aoFechar: () => void;
  aoSalvar: (c?: { nome: string; email: string; c: Credenciais }) => void;
}) {
  const [r, setR] = useState(inicial);
  const [salvando, setSalvando] = useState(false);
  const [confirmar, confirmacao] = useConfirm();
  const nova = r.id === null;
  const lot = (setorId: string) => r.lotacoes.find((l) => l.setorId === setorId);
  const mudarLot = (setorId: string, m: Partial<Lotacao> | null) =>
    setR((x) => {
      const resto = x.lotacoes.filter((l) => l.setorId !== setorId);
      if (m === null) return { ...x, lotacoes: resto };
      const atual = x.lotacoes.find((l) => l.setorId === setorId) ?? { setorId, papel: 'membro', recebe: 'sempre', limiteCarga: 5 };
      return { ...x, lotacoes: [...resto, { ...atual, ...m }] };
    });

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!r.idiomas.length) return avisar('Escolha pelo menos um idioma.', 'warning');
    if (
      !nova &&
      inicial.ativo &&
      !r.ativo &&
      !(await confirmar({
        title: `Desativar ${r.nome}?`,
        description: 'Sai do turno agora e as conversas abertas voltam para a fila.',
        confirmLabel: 'Desativar',
        danger: true,
      }))
    )
      return;
    setSalvando(true);
    try {
      const corpo = { unidadeId, nome: r.nome.trim(), idiomas: r.idiomas, admin: r.admin, gerente: r.gerente && !r.admin, lotacoes: r.lotacoes };
      if (nova) {
        const c = await api.admin.criarPessoa({ ...corpo, email: r.email.trim() });
        aoSalvar({ nome: corpo.nome, email: r.email.trim(), c });
      } else {
        await api.admin.salvarPessoa(r.id!, { ...corpo, ativo: r.ativo });
        avisar('Salvo.', 'success');
        aoSalvar();
      }
    } catch (err) {
      avisar((err as Error).message, 'error');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Drawer
      open
      onClose={aoFechar}
      size="md"
      title={nova ? 'Nova pessoa' : inicial.nome}
      subtitle={nova ? 'O acesso é gerado ao criar.' : inicial.email}
      footer={
        <>
          <Button variant="ghost" type="button" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button type="submit" form="form-pessoa" loading={salvando}>
            {nova ? 'Criar e gerar acesso' : 'Salvar'}
          </Button>
        </>
      }
    >
      <form id="form-pessoa" onSubmit={salvar} className="pilha pilha--larga">
        <Input label="Nome" required minLength={2} value={r.nome} onChange={(e) => setR({ ...r, nome: e.target.value })} autoFocus />
        <Input
          label="E-mail"
          type="email"
          required
          value={r.email}
          disabled={!nova}
          onChange={(e) => setR({ ...r, email: e.target.value })}
          hint={nova ? 'É o login no computador.' : 'O e-mail é o login e não muda.'}
        />

        <div className="pilha">
          <span className="admin-rotulo">Idiomas que atende</span>
          <ChipGroup label="Idiomas que atende">
            {IDIOMAS.map((i) => {
              const tem = r.idiomas.includes(i.id);
              return (
                <Tag
                  key={i.id}
                  pressed={tem}
                  onToggle={() => setR((x) => ({ ...x, idiomas: tem ? x.idiomas.filter((y) => y !== i.id) : [...x.idiomas, i.id] }))}
                >
                  {i.nome}
                </Tag>
              );
            })}
          </ChipGroup>
        </div>

        <div className="pilha">
          <span className="admin-rotulo">Setores</span>
          {setores.map((s) => {
            const l = lot(s.id);
            return (
              <div key={s.id} className={`admin-lotacao ${l ? 'admin-lotacao--marcada' : ''}`}>
                <Checkbox label={<strong>{s.nome}</strong>} aria-label={`Lotar em ${s.nome}`} checked={Boolean(l)} onChange={(e) => mudarLot(s.id, e.target.checked ? {} : null)} />
                {l && (
                  <div className="admin-lotacao__campos">
                    <div className="admin-lotacao__select">
                      <Select
                        value={l.papel}
                        onChange={(v) => mudarLot(s.id, { papel: v as Lotacao['papel'] })}
                        sheetTitle={`Papel em ${s.nome}`}
                        options={[
                          { value: 'membro', label: 'Membro' },
                          { value: 'supervisor', label: 'Supervisor' },
                        ]}
                      />
                    </div>
                    <div className="admin-lotacao__select">
                      <Select
                        value={l.recebe}
                        onChange={(v) => mudarLot(s.id, { recebe: v as Lotacao['recebe'] })}
                        sheetTitle={`Recebe pedidos de ${s.nome}`}
                        options={Object.entries(RECEBE).map(([k, v]) => ({ value: k, label: v }))}
                      />
                    </div>
                    <span className="pequeno mudo">até</span>
                    <div className="admin-lotacao__numero">
                      <Input
                        type="number"
                        min={1}
                        max={50}
                        aria-label={`Conversas ao mesmo tempo em ${s.nome}`}
                        title="Quantas conversas ao mesmo tempo"
                        value={l.limiteCarga}
                        onChange={(e) => mudarLot(s.id, { limiteCarga: Math.max(1, Math.min(50, Number(e.target.value) || 1)) })}
                      />
                    </div>
                    <span className="pequeno mudo">conversas</span>
                  </div>
                )}
              </div>
            );
          })}
          <span className="pequeno mudo">Supervisor é avisado quando um pedido do setor fica sem aceite e pode assumir conversas do setor.</span>
        </div>

        <div className="pilha">
          <RadioGroup
            label="Nível de acesso"
            variant="cards"
            disabled={eu}
            value={r.admin ? 'admin' : r.gerente ? 'gerente' : 'funcionario'}
            onChange={(v) => setR({ ...r, admin: v === 'admin', gerente: v === 'gerente' })}
            options={[
              { value: 'funcionario', label: 'Funcionário', description: 'Atende os setores em que está lotado. Supervisor vê e assume as conversas do setor.' },
              { value: 'gerente', label: 'Gerente', description: 'Vê e assume todas as conversas do hotel e o relatório. Não mexe na configuração.' },
              { value: 'admin', label: 'Administrador', description: 'Tudo do gerente, e configura a jornada, a equipe e os quartos.' },
            ]}
          />
          {!nova && (
            <Checkbox
              label="Ativa"
              description="Desmarque quando a pessoa sair da equipe."
              checked={r.ativo}
              disabled={eu}
              onChange={(e) => setR({ ...r, ativo: e.target.checked })}
            />
          )}
          {eu && <span className="pequeno mudo">Você não pode tirar o próprio acesso de administrador.</span>}
        </div>
      </form>
      {confirmacao}
    </Drawer>
  );
}

/** Senha e PIN aparecem uma vez só: o servidor guarda apenas o hash. */
function MostrarCredenciais({ nome, email, c, aoFechar }: { nome: string; email: string; c: Credenciais; aoFechar: () => void }) {
  const texto = [`Acesso ao Ramais — ${nome}`, `E-mail: ${email}`, c.senhaTemporaria && `Senha temporária: ${c.senhaTemporaria}`, c.pin && `PIN do celular: ${c.pin}`]
    .filter(Boolean)
    .join('\n');
  return (
    <Dialog
      open
      title={`Acesso de ${nome}`}
      icon={<KeyRound />}
      footer={
        <>
          <Button
            variant="secondary"
            iconLeft={<Copy />}
            onClick={() =>
              navigator.clipboard.writeText(texto).then(
                () => avisar('Copiado.', 'success'),
                () => avisar('Não deu para copiar; anote à mão.', 'warning'),
              )
            }
          >
            Copiar tudo
          </Button>
          <Button onClick={aoFechar}>Já anotei</Button>
        </>
      }
    >
      <div className="pilha pilha--larga">
        <Banner variant="warning" title="Anote ou copie agora: não dá para ver de novo." description="Se perder, gere outro." />
        <CopyField label="E-mail" value={email} />
        {c.senhaTemporaria && <CopyField label="Senha temporária" value={c.senhaTemporaria} hint="Troca no primeiro acesso." />}
        {c.pin && <CopyField label="PIN do celular" value={c.pin} />}
      </div>
    </Dialog>
  );
}
