# Atalho de saída individual

## Implementação

A página inicial oferece Configurações do perfil > Atalho de saída para contas autenticadas. O padrão é desativado. Somente F8 e F9 são aceitas.

A preferência é gravada pela API oficial do Supabase Auth, com updateUser, na chave ws_exit_shortcut dos metadados do próprio usuário. Não há tabela nova, armazenamento local de preferências, credencial administrativa ou autorização baseada nesses metadados. A atualização envia somente essa chave, preservando display_name e os demais metadados.

O salvamento exige confirmação do Auth. A recuperação usa getUser, não apenas a sessão em cache. Há atualização ao abrir a conta, receber eventos de autenticação, retornar à aba, recuperar a conexão e a cada 30 segundos enquanto a aba está visível. Uma falha de leitura desativa o atalho até nova confirmação. Outro dispositivo deve usar a mesma conta; a sincronização não é instantânea em segundo plano. Edições locais não salvas são mantidas no formulário; salvar substitui apenas a preferência de saída.

A escuta fica na raiz da aplicação, incluindo a administração. Campos, formulários, elementos editáveis, editores conhecidos e regiões com data-ws-shortcuts="off" não acionam a saída. Eventos repetidos, composição, eventos já tratados e combinações com modificadores são ignorados. Teclas reservadas pelo sistema ou navegador podem não chegar à página.

A saída usa signOut com scope local, sem desconectar outros dispositivos. Após confirmação, tenta window.close. Se a página continuar aberta, mostra a orientação para fechar a aba manualmente. Falhas de logout apresentam uma opção de nova tentativa e não afirmam que a sessão terminou. Nenhuma pergunta não enviada é salva por esse fluxo.

## Testes automatizados

Executar após instalar as dependências:

    node --test tests/exit-shortcut.test.mjs
    npm run build

A suíte cobre normalização segura, seleção F8/F9, desativação, modificadores, repetição, composição, eventos tratados e seleção de regiões protegidas. O teste de regiões usa um substituto de Element; a interação real com o DOM deve ser validada no navegador.

## Validação integrada pendente

Estes testes não foram executados nesta entrega:

1. Entrar na conta A, ativar F8, salvar e atualizar a página. Conferir a preferência recuperada do Auth.
2. Sair pelo botão normal, entrar novamente e conferir a mesma preferência.
3. Abrir A em outro dispositivo. Alterar para F9 no primeiro e retornar à aba do segundo; conferir a recuperação. Repetir com a aba visível e aguardar 30 segundos.
4. Entrar na conta B e confirmar que a configuração de A não aparece. Verificar que salvar o atalho não modifica nome ou outros metadados.
5. Alterar sem salvar e confirmar que somente a tecla previamente salva continua válida fora do formulário.
6. Confirmar que F8/F9 não saem durante edição da pergunta, login, busca administrativa, campos numéricos, selects, formulários ou editores. Testar teclas modificadas e pressionamento contínuo.
7. Fora dos campos, pressionar a tecla selecionada. Confirmar a saída local e a permanência da sessão no outro dispositivo.
8. Testar uma aba normal e uma janela aberta por script. Conferir a tela de fechamento manual e o fechamento automático quando permitido.
9. Interromper a conexão durante a leitura e durante o salvamento. Conferir ausência de confirmação falsa. Interromper durante a saída e conferir a mensagem de falha.
10. Trocar de conta durante uma leitura ou gravação e conferir que respostas antigas não atualizam a interface da nova conta.

## Escopo restante

Esta etapa não adiciona upload, limites administrativos de arquivos nem configurações de resolução, cor ou tamanho do texto. O serviço de IA permanece exclusivamente textual. A persistência administrativa, a validação de anexos no servidor e os testes correspondentes dependem da próxima etapa, com conexão de banco e capacidades reais do provedor e armazenamento definidas.
