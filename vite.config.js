import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

// 게임 버전: package.json 의 version 하나만 기준으로 쓰고, 코드에서는 __APP_VERSION__ 으로 읽는다
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));

// GitHub Pages는 https://<user>.github.io/<repo>/ 아래에서 서빙되므로
// Actions에서 빌드할 때는 base를 '/<repo>/'로 맞춘다. 로컬에서는 '/'.
// GITHUB_REPOSITORY 는 Actions가 넣어 주는 'owner/repo' 값이라 저장소 이름을 바꿔도 따라간다.
const repo = process.env.GITHUB_REPOSITORY?.split('/')[1];

export default defineConfig({
  base: process.env.GITHUB_ACTIONS && repo ? `/${repo}/` : '/',
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
});
