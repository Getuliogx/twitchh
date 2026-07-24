# Twitch simples — Oracle

Esta versão não usa `.env`, `HLS_URL`, `TWITCH_CLIENT_ID` nem `TWITCH_CLIENT_SECRET`.

O site, o player e o servidor de transmissão ficam juntos na mesma máquina Oracle. O público abre apenas o seu site. O chat oficial da Twitch aparece dentro da página.

## O que o público usa

Somente este endereço:

```text
http://IP_DA_ORACLE/
```

## Instalação

1. Crie uma máquina Ubuntu na Oracle.
2. Na rede da máquina, libere as portas TCP `80` e `1935`.
3. Envie esta pasta para a máquina.
4. Dentro da pasta, execute:

```bash
sudo bash instalar.sh
```

5. Abra:

```text
http://IP_DA_ORACLE/admin
```

Na primeira abertura, informe apenas:

- nome do seu canal da Twitch;
- título que aparecerá no site;
- uma senha para o painel.

O painel criará automaticamente o servidor e a chave do OBS.

## Configuração no OBS

No painel `/admin`, copie os dois campos mostrados:

- **Servidor do OBS**
- **Chave de transmissão**

No OBS:

1. Abra **Configurações > Transmissão**.
2. Em **Serviço**, escolha **Personalizado**.
3. Cole o servidor e a chave.
4. Clique em **Iniciar transmissão**.

O player do site detecta a live sozinho.

## O que funciona

- player próprio;
- chat oficial da Twitch incorporado;
- emotes, badges e moderação dentro do chat;
- contador de pessoas que estão no seu site;
- painel simples para alterar canal e título;
- geração automática da chave de transmissão;
- funcionamento em celular e computador.

## Limitação da Twitch

Como o canal oficial da Twitch fica offline, recursos que dependem de uma live oficial da Twitch não são ativados, como espectadores oficiais, Drops, raids, anúncios e pontos ganhos por assistir. O projeto não abre `twitch.tv` como página principal e não usa player oculto.

## Atualizar ou reiniciar

Dentro da pasta:

```bash
docker compose restart
```

Para ver os registros:

```bash
docker compose logs -f
```
