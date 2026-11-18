# Publicar o repositório no GitHub

Esta pasta é um repositório Git independente com a branch principal `main` e um commit inicial. A branch `codex/crm-em-desenvolvimento` guarda o piloto implementado da Fase 1. Abra o terminal na pasta que contém este README e o diretório `.git`.

1. Confira a branch, o conteúdo e os remotos locais.

   ```sh
   git status --short --branch
   git branch --list
   git remote -v
   ```

2. No GitHub, crie um repositório vazio na conta ou organização correta. A visibilidade privada é uma opção adequada para o piloto interno da EBA. Deixe README, licença e gitignore iniciais desmarcados, pois o conteúdo local já tem histórico próprio.
3. Copie a URL HTTPS ou SSH exibida pelo GitHub. Substitua o valor entre aspas abaixo pela URL copiada e execute com a sua própria autenticação.

   ```sh
   git remote add origin "URL-COPIADA-DO-GITHUB"
   git push -u origin main
   ```

4. Para levar também a implementação do CRM ao mesmo repositório, envie a branch separadamente.

   ```sh
   git push -u origin codex/crm-em-desenvolvimento
   ```

No GitHub, confirme o README em português, os documentos em `docs/` e as branches desejadas. Para publicar a aplicação acessível pelo navegador, use o fluxo da hospedagem do Site com o Worker e o D1. O GitHub Pages oferece hospedagem estática e, sozinho, não executa essas APIs.
