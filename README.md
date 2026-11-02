# Lyric Studio — letras de música em código, animadas pelo áudio

React + TypeScript + Tailwind (Vite). Transforma a letra em um terminal ou código Python digitado,
reage ao áudio e exporta vídeo 9:16 (1080×1920) para Reels.

## Rodar

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # checa tipos e gera o build de produção
```

## Formatos do vídeo

**Terminal** (padrão, igual à referência): preto liso e só o código sendo escrito. Comando `$ play "Título"`,
versos como saída, rótulos `[refrão]` em laranja, `(ok.)` em verde e o cursor em bloco no `$` final.
Sem ondas sonoras, brilho, esmaecimento nem rodapé. O áudio define o ritmo da digitação.

**Python**: `class`, `def play(self)`, cada verso em `print("…")` (ou `self.sing`, `lyrics.append`, `yield`),
terminando em `# Executar`. Mantém o brilho que reage à batida e as ondas sonoras.

O botão **Ondas sonoras** liga ou desliga o espectro em qualquer formato (desligado no Terminal, ligado no Python).
O efeito de vidro fosco existe só na interface do app, nunca no vídeo.

## Como usar

1. **Áudio** — carregue mp3/wav/m4a. Sem áudio, o preview roda em modo demonstração.
2. **Música** — título, artista e ano alimentam o cabeçalho do código.
3. **Letra** — um verso por linha; linha em branco separa estrofes; `[Refrão]` nomeia a estrofe.
   Versos com `[mm:ss.xx]` usam esse tempo (importa `.lrc`); os demais são distribuídos pela duração.
   **Sincronização**: o áudio toca e você aperta **Espaço** no início de cada verso (**Backspace** desfaz).
4. **Aparência** — formato, ondas sonoras, tema, tamanho do texto, rótulos, números de linha.
5. **Exportar** — grava canvas + áudio em tempo real (MediaRecorder) e baixa o arquivo.

## O que o áudio controla

- tempo: define quando cada linha é digitada e a rolagem
- espectro (32 barras) no rodapé, quando "Ondas sonoras" está ligado
- brilho do fundo e do texto ativo (só no formato Python)
- cursor e brilho pulsam na batida (só no formato Python)

## Exportação e Instagram

O app escolhe MP4 com H.264/AAC quando o navegador suporta. Quando não suporta, avisa depois da gravação
e mostra o comando de conversão:

```bash
ffmpeg -i video.mp4 -c:v libx264 -pix_fmt yuv420p -c:a aac reels.mp4
```

A gravação é em tempo real: mantenha a aba aberta e visível até terminar. As guias da zona segura do Reels
aparecem só no preview, nunca no vídeo.

## Estrutura

```
src/lib/lyrics.ts     parser (LRC, estrofes) e distribuição de tempos
src/lib/codegen.ts    letra -> linhas de terminal/Python com tempos
src/lib/tokenize.ts   colorização de sintaxe
src/lib/renderer.ts   canvas 1080x1920: digitação, foco, rolagem, cursor, espectro, janela de vidro
src/lib/audio.ts      AudioContext, analisador FFT, batida, stream para gravação
src/lib/exporter.ts   MediaRecorder (canvas + áudio) e detecção de H.264
src/components/ui.tsx controles estilo Apple (grupos, segmentado, switch, slider)
src/App.tsx           interface
```
