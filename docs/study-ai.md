# WS STUDY AI — análise por texto

Esta entrega cria uma aplicação Vite, React, TypeScript, TanStack Router e Tailwind. Não substitui nem simula a integração anterior, que não consta nos arquivos do projeto.

## Conexão existente

O frontend utiliza VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY (ou VITE_SUPABASE_ANON_KEY) do projeto Supabase existente. Nunca exponha uma chave service_role no frontend.

O cadastro usa signUp. Quando houver sessão autenticada, o perfil é inserido em profiles com id igual ao id da conta. Perfis existentes não são sobrescritos. Se houver confirmação obrigatória por e-mail, a gravação acontece após a confirmação e o login. As políticas existentes precisam permitir essa inserção pelo titular.

## Serviço de IA

Publicar a função Supabase study-ai e aplicar a migração reserve_study_request no banco existente. A função valida o token pelo Auth antes de consultar dados. A função SQL só pode ser executada por service_role.

O serviço usa uma API compatível com Chat Completions. Definir como segredos do serviço AI_BASE_URL, AI_API_KEY e AI_MODEL com os valores reais da integração. AI_BASE_URL deve incluir o prefixo da API, como /v1 quando necessário; o serviço acrescenta /chat/completions. Não existe provedor, modelo ou chave de demonstração predefinidos. APIs com outro protocolo precisam de um adaptador específico.

Não é necessário criar outro banco. SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são lidos exclusivamente pelo serviço.

## Limites e persistência

Nenhum valor de app_settings ou user_limits é modificado. Contas bloqueadas são recusadas. daily_limit individual prevalece sobre default_daily_limit da configuração id 1. Sem configuração aplicável, o envio é recusado em vez de liberar uso ilimitado.

A reserva usa bloqueio transacional por usuário e insere usage_events antes da chamada ao provedor. Conta todos os eventos do usuário no dia UTC, inclusive tentativas que falharam. Esse critério é explícito nesta implementação; o critério original não consta no repositório. O bloqueio protege chamadas deste serviço, não outras integrações que gravem eventos sem usar a mesma função.

Não há tentativas automáticas ou chamadas de teste ao provedor. Cada envio aceito faz uma chamada. Respostas válidas são gravadas em analyses. Se a gravação falhar, a resposta ainda é exibida com aviso. Falhas técnicas são registradas em error_logs sem incluir credenciais, perguntas ou respostas do provedor.

## Verificações antes de considerar recuperado

- Instalar as dependências e executar npm run build.
- Confirmar as políticas e restrições existentes para profiles, analyses e usage_events, incluindo os valores analysis e error usados nos eventos.
- Publicar a migração e a função com os segredos reais do provedor.
- Validar cadastro, confirmação de e-mail, login e preservação de um perfil existente.
- Enviar uma pergunta conhecida e verificar a resposta e a gravação em analyses.
- Verificar conta bloqueada, limite diário e duas solicitações concorrentes no último uso disponível.
- Verificar comportamento em timeout, falha do provedor e falha ao salvar a resposta.
- Validar layout e envio em computador e Android.

Essas verificações não estão declaradas como executadas. Imagens, PDFs e recuperação do restante do fluxo anterior não fazem parte desta primeira entrega.
