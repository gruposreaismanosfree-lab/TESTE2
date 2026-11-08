# Painel administrativo

A rota /admin utiliza o cliente Supabase existente e as funções da migração 20260718000000_admin_panel.sql. O link fica disponível após o login; a autorização é feita no banco em cada operação, não pela visibilidade do link.

## Acesso e publicação

Aplicar a migração antes de usar o painel. Ela não cria outro banco, não concede papéis a usuários, não modifica políticas existentes e não altera valores de limites durante a instalação.

O acesso exige sessão Supabase autenticada e uma linha em public.user_roles com user_id igual a auth.uid() e role com representação textual admin. Contas comuns e chamadas anônimas não recebem dados administrativos. A atribuição de papéis permanece fora deste painel. As políticas existentes de user_roles devem impedir que uma conta comum atribua a si mesma o papel admin.

As funções SECURITY DEFINER têm search_path fixo, referências qualificadas às tabelas e checagem de papel antes das consultas ou alterações. Nenhuma chave service_role é enviada ao navegador. Os desafios OTP e as sessões administrativas existentes não são usados por este fluxo; esta entrega protege o painel por sessão de login e papel, sem implementar uma segunda verificação administrativa.

## Operações disponíveis

- Busca de perfis por nome, e-mail ou ID, com 20 resultados por página.
- Consulta do consumo do dia UTC, seguindo o critério de reserve_study_request: todos os eventos, inclusive tentativas com falha.
- Edição do limite padrão em app_settings, id 1, com updated_by e updated_at.
- Edição do limite individual e bloqueio da IA em user_limits.
- Retorno ao limite padrão removendo a exceção individual. Isso não remove o perfil, análises nem eventos de consumo.
- Consulta dos 20 erros mais recentes e das 20 ações administrativas mais recentes.

Cada gravação insere admin_audit_log na mesma transação, com responsável, alvo e valores anteriores e novos. Se a auditoria falhar, a alteração também é revertida. Atualizações de uma conta usam a mesma trava transacional da reserva de análise. Uma análise já reservada pode terminar mesmo após um bloqueio; o bloqueio impede novas reservas.

Como daily_limit não aceita NULL, uma linha de user_limits sempre representa um limite individual. Para bloquear uma conta, desmarcar Usar limite padrão e informar o limite individual. Para restaurar a herança, desmarcar o bloqueio e marcar Usar limite padrão. A interface e o banco recusam valores negativos; zero impede novas reservas.

Não há mudança de saldo do provedor, limpeza de eventos, exclusão de contas, edição de papéis, alteração de formatos de upload nem chamadas automáticas à IA. Os números de uso não indicam créditos disponíveis no provedor. A lista de usuários corresponde aos registros de profiles, não a uma exportação de auth.users.

## Validação antes da liberação

Estas verificações ainda não foram executadas:

1. Executar o build do projeto e aplicar a migração.
2. Abrir /admin sem sessão e conferir o direcionamento ao login.
3. Entrar com conta comum e confirmar que as três RPCs recusam acesso, inclusive quando chamadas diretamente.
4. Confirmar que as políticas de user_roles não permitem autopromoção.
5. Entrar com um administrador existente e conferir busca, paginação, consumo, erros e auditoria.
6. Alterar um limite em conta de teste e confirmar a linha de user_limits e a auditoria correspondente.
7. Bloquear a conta de teste e verificar que study-ai recusa uma nova análise; depois restaurar as regras anteriores.
8. Testar limite zero, herança do padrão, erros de gravação e expiração da sessão.
9. Validar a navegação e os formulários em computador e Android.

A recuperação da IA continua dependendo da publicação do serviço study-ai, da migração de reserva e dos segredos reais do provedor descritos em docs/study-ai.md. Este painel não comprova a disponibilidade do provedor e não adiciona análises de imagens ou PDFs.
