# WS STUDY AI — fundação do produto

## Entrega 1 de 4

A aplicação mantém Vite, React, TypeScript, TanStack Router e Tailwind. As rotas são registradas explicitamente em src/router.tsx, seguindo a arquitetura existente.

- `/`: início, identidade visual e integração existente do assistente por texto.
- `/pesquisas`: planejador local que transforma tema, matéria, formato, profundidade e material de apoio em instruções editáveis. Não gera respostas nem faz pesquisa na internet.
- `/perfil`: preferências visuais locais, não um perfil sincronizado de conta.
- `/admin`: implementação anterior preservada, sem novos privilégios ou métricas simuladas.

## Persistência local

A chave localStorage `ws-study:appearance:v1` contém apenas nome de exibição, cor, tamanho de texto e preferência de movimento. As alterações são sincronizadas entre abas pelo evento storage. Falhas de leitura ou gravação são informadas na página de preferências.

O encaminhamento de uma pesquisa usa sessionStorage com a chave `ws-study:research-draft:v1`. O rascunho permanece na aba enquanto o usuário entra na conta; é removido após uma resposta válida. Não é um histórico de conversas. Nenhum envio ao provedor acontece automaticamente. Evite inserir dados sensíveis em rascunhos, principalmente em dispositivos compartilhados.

O frontend não cria perfis em tabelas não confirmadas. O nome da página de preferências não modifica dados da autenticação.

## Estado dos serviços

Não há banco conectado nesta etapa. Os arquivos anteriores de funções e migrações foram preservados, mas sua presença não significa que foram publicados ou que as tabelas existem. Não há credenciais, provedor ou saldo de IA confirmados nesta entrega.

A interface não inventa estatísticas: sem dados reais de consumo, informa que a contagem está indisponível. A existência de configuração do cliente não é apresentada como prova de saúde do provedor.

## Validação progressiva

Testes adicionados, não executados nesta entrega:

- `node --test tests/research.test.mjs`: validação de tema, tamanhos, formatos, profundidades, exigência de material para conclusão e compatibilidade com o limite textual do assistente.
- `npm run build`: verificação de tipos e build de produção.

Roteiro manual de aceitação:

1. Abrir início, pesquisas e perfil diretamente por URL, voltar e avançar no navegador.
2. Testar em larguras de 360, 768 e 1440 pixels; verificar ausência de rolagem horizontal, navegação e campos legíveis.
3. Navegar por teclado e usar o link de pular para o conteúdo. Conferir foco visível, rótulos e avisos.
4. Salvar cor, nome e tamanho; atualizar a página e abrir outra aba. Confirmar persistência e sincronização.
5. Ativar redução de movimento tanto no sistema quanto na página. Conferir que nenhuma animação é necessária para usar o produto.
6. Bloquear armazenamento local. Conferir que o formulário continua utilizável e não informa salvamento bem-sucedido.
7. Criar pesquisa, editar instruções, copiar e encaminhar. Confirmar que a IA não é chamada automaticamente.
8. Sem integração configurada, conferir o aviso de ativação e a preservação visível do rascunho.
9. Com integração validada nas próximas etapas, confirmar login, envio explícito, erros e remoção do rascunho somente após sucesso.

## Etapas restantes

2. Conexão dos serviços, confirmação da estrutura real, autenticação completa, recuperação de senha, perfil e histórico isolados por usuário.
3. Validação do provedor real, contexto de conversas, respostas formatadas, imagens, PDFs, documentos e testes controlados de qualidade.
4. Administração autorizada no servidor, limites atômicos de 30/999, configuração dinâmica de anexos, RLS, monitoramento e testes integrados.

Não há afirmação de que testes de produção, Android ou chamadas reais à IA tenham sido executados.
