/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * 'artifact'이면 claude.ai Artifact(온라인 링크)용 빌드:
   * meshopt 디코더(WebAssembly) 없이 양자화 모델을 쓰고, 모델은 .glb 대신
   * base64로 감싼 .glb.json으로 받음 (Artifact가 .glb 파일을 서빙하지 않음)
   */
  readonly VITE_TARGET?: 'artifact';
}
