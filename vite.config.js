import { defineConfig } from 'vite';

// GitHub Pages는 https://<user>.github.io/<repo>/ 아래에서 서빙되므로
// Actions에서 빌드할 때는 base를 '/<repo>/'로 맞춘다. 로컬에서는 '/'.
// GITHUB_REPOSITORY 는 Actions가 넣어 주는 'owner/repo' 값이라 저장소 이름을 바꿔도 따라간다.
const repo = process.env.GITHUB_REPOSITORY?.split('/')[1];

export default defineConfig({
  base: process.env.GITHUB_ACTIONS && repo ? `/${repo}/` : '/',
});
